/**
 * alerts.ts - Config-driven reminder & escalation engine.
 *
 * A single run:
 *   1. Collects every open, date-bound item (pendency, EVC scheduling, report
 *      submission, undertaking, document expiry, authenticity).
 *   2. Emits reminders at the configured offsets (config/alerts.ts).
 *   3. Raises escalation levels once their delay has elapsed.
 *
 * Every dispatch is keyed by `${eventId}:${kind}:${level}`, stored in the
 * alert log, so re-running the cron can never duplicate a notification, email
 * or ledger entry.
 */

import {
  ALERT_REMINDER_OFFSETS_DAYS,
  ALERT_REMINDER_RECIPIENT_ROLE,
  ESCALATION_MATRIX,
} from '../config/alerts.js';
import { store } from '../db/store.js';
import {
  AlertItem,
  AlertLog,
  AlertKind,
  Escalation,
  Notification,
  Region,
  User,
  UserRole,
} from '../types.js';
import { buildAlertEmail, describeAlertReason, sendAlertEmail } from './mailer.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const OPEN_APPLICATION_STATUSES = new Set([
  'SUBMITTED',
  'SCRUTINY',
  'DEFICIENT',
  'EVC_REQUIRED',
]);

const PENDENCY_STATUSES = new Set(['SUBMITTED', 'SCRUTINY', 'DEFICIENT', 'EVC_REQUIRED']);

export interface AlertRunResult {
  success: boolean;
  remindersCreated: number;
  escalationsCreated: number;
  notificationsCreated: number;
  emailsQueued: number;
  emailsFailed: number;
  emailsSkipped: number;
  duplicatesSkipped: number;
  itemsScanned: number;
  runAt: string;
}

interface PendingEmail {
  logId: string;
  promise: Promise<void>;
}

let pendingEmails: PendingEmail[] = [];
let lastRunFailedEmails = 0;
let lastRunSkippedEmails = 0;

/** Date-only (UTC) parsing to keep day math stable across time zones. */
function dayNumber(value: string): number {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return Date.UTC(year, (month || 1) - 1, day || 1) / DAY_MS;
}

function daysUntil(dueDate: string, now: Date): number {
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ) / DAY_MS;
  return dayNumber(dueDate) - today;
}

function normalizeRegion(region?: Region | 'ALL'): Region {
  return region || 'ALL';
}

function isClosed(status: string): boolean {
  return status === 'APPROVED' || status === 'REJECTED';
}

/**
 * Collects every open item that is bound to a due date. Pure read-only helper
 * (also useful in tests).
 */
export async function buildAlertItems(now: Date = new Date()): Promise<AlertItem[]> {
  const items: AlertItem[] = [];
  const applications = await store.listApplications();

  for (const app of applications) {
    if (isClosed(app.status)) continue;

    // 1. Application pendency (SLA due date)
    if (PENDENCY_STATUSES.has(app.status) && app.slaDueAt) {
      items.push({
        eventId: `PENDENCY:${app.id}`,
        applicationId: app.id,
        eventType: 'PENDENCY',
        dueDate: app.slaDueAt,
        reason: describeAlertReason('PENDENCY'),
        region: normalizeRegion(app.region),
        institutionName: app.institutionName,
      });
    }

    // 2. EVC inspection not yet scheduled
    if (app.status === 'EVC_REQUIRED' && !app.scheduledInspection) {
      const due = app.slaDueAt || new Date(now).toISOString();
      items.push({
        eventId: `EVC_SCHEDULING:${app.id}`,
        applicationId: app.id,
        eventType: 'EVC_SCHEDULING',
        dueDate: due,
        reason: describeAlertReason('EVC_SCHEDULING'),
        region: normalizeRegion(app.region),
        institutionName: app.institutionName,
      });
    }

    // 3. Pending institutional undertaking
    if (app.undertakingDueAt && OPEN_APPLICATION_STATUSES.has(app.status)) {
      items.push({
        eventId: `UNDERTAKING:${app.id}`,
        applicationId: app.id,
        eventType: 'UNDERTAKING',
        dueDate: app.undertakingDueAt,
        reason: describeAlertReason('UNDERTAKING'),
        region: normalizeRegion(app.region),
        institutionName: app.institutionName,
      });
    }

    // 4. Document expiry (state driven) + authenticity checks
    const docs = await store.getComplianceDocuments(app.id);
    for (const doc of docs) {
      if (doc.state === 'WARNING' || doc.state === 'OVERDUE') {
        items.push({
          eventId: `DOCUMENT_EXPIRY:${doc.id}`,
          applicationId: app.id,
          eventType: 'DOCUMENT_EXPIRY',
          dueDate: doc.expiryDate,
          reason: describeAlertReason('DOCUMENT_EXPIRY'),
          region: normalizeRegion(app.region),
          institutionName: app.institutionName,
        });
      }
      if (doc.authenticityDueAt) {
        items.push({
          eventId: `DOCUMENT_AUTHENTICITY:${doc.id}`,
          applicationId: app.id,
          eventType: 'DOCUMENT_AUTHENTICITY',
          dueDate: doc.authenticityDueAt,
          reason: describeAlertReason('DOCUMENT_AUTHENTICITY'),
          region: normalizeRegion(app.region),
          institutionName: app.institutionName,
        });
      }
    }
  }

  // 5. EVC report submission (scheduled visit, report still missing)
  const inspections = await store.getInspections();
  for (const inspection of inspections) {
    if (inspection.status !== 'SCHEDULED' || inspection.report) continue;
    if (!inspection.reportDueAt) continue;
    const app = applications.find((a) => a.id === inspection.applicationId);
    if (app && isClosed(app.status)) continue;
    items.push({
      eventId: `REPORT_SUBMISSION:${inspection.id}`,
      applicationId: inspection.applicationId,
      eventType: 'REPORT_SUBMISSION',
      dueDate: inspection.reportDueAt,
      reason: describeAlertReason('REPORT_SUBMISSION'),
      region: normalizeRegion(app?.region),
      institutionName: inspection.institutionName,
    });
  }

  return items;
}

/** Finds the best recipient for a role/region/institution. */
async function resolveRecipient(
  role: UserRole,
  region: Region,
  institutionName?: string
): Promise<User | undefined> {
  const users = await store.listUsers();
  return users.find((user) => {
    if (user.role !== role) return false;
    if (role === 'INSTITUTION') {
      return !!institutionName && user.institutionName === institutionName;
    }
    return normalizeRegion(user.region) === 'ALL' || region === 'ALL' || user.region === region;
  });
}

function resolvedRegion(itemRegion: Region, ruleRegion: Region | 'ALL'): Region {
  return ruleRegion === 'ALL' ? itemRegion : ruleRegion;
}

function makeLogId(eventId: string, kind: AlertKind, level: number): string {
  return `${eventId}:${kind}:${level}`;
}

function queueEmail(log: AlertLog, to?: string): void {
  const email = buildAlertEmail({
    to: to || '',
    applicationId: log.applicationId,
    eventType: log.eventType,
    escalationLevel: log.kind === 'ESCALATION' ? log.level : undefined,
    kind: log.kind === 'ESCALATION' ? 'Escalation' : 'Reminder',
    reason: log.reason,
  });

  const promise = sendAlertEmail(email)
    .then(async (result) => {
      if (result.status === 'SENT') {
        await store.updateAlertLog(log.id, { mailStatus: 'SENT' });
      } else if (result.status === 'SKIPPED') {
        lastRunSkippedEmails += 1;
        await store.updateAlertLog(log.id, { mailStatus: 'SKIPPED' });
      } else {
        lastRunFailedEmails += 1;
        await store.updateAlertLog(log.id, {
          mailStatus: 'FAILED',
          mailError: result.error,
        });
      }
    })
    .catch(async (err: unknown) => {
      lastRunFailedEmails += 1;
      await store.updateAlertLog(log.id, {
        mailStatus: 'FAILED',
        mailError: err instanceof Error ? err.message : String(err),
      });
    });

  pendingEmails.push({ logId: log.id, promise });
}

/**
 * Dispatches a single alert exactly once. Returns the created log or null when
 * the alert was already handled.
 */
async function dispatchAlert(params: {
  item: AlertItem;
  kind: AlertKind;
  level: number;
  recipientRole: UserRole;
  region: Region;
  now: Date;
  escalation?: Escalation;
}): Promise<{ log: AlertLog; won: boolean } | null> {
  const logId = makeLogId(params.item.eventId, params.kind, params.level);
  const existing = await store.getAlertLog(logId);
  if (existing) return null;

  const recipient = await resolveRecipient(
    params.recipientRole,
    params.region,
    params.item.institutionName
  );

  const title =
    params.kind === 'ESCALATION'
      ? `Escalation L${params.level}: ${params.item.applicationId}`
      : `Reminder: ${params.item.applicationId}`;
  const message =
    params.kind === 'ESCALATION'
      ? `Level ${params.level} escalation raised. ${params.item.reason}`
      : params.item.reason;

  const notification: Notification = {
    id: `NOTIF-${logId}`,
    applicationId: params.item.applicationId,
    title,
    message,
    type: params.kind === 'ESCALATION' ? 'OVERDUE' : 'WARNING',
    read: false,
    createdAt: params.now.toISOString(),
    idempotencyKey: logId,
    recipientRole: params.recipientRole,
    region: params.region,
    institutionName: params.item.institutionName,
    eventId: params.item.eventId,
    escalationId: params.escalation?.id,
  };
  await store.addNotification(notification);

  const log: AlertLog = {
    id: logId,
    eventId: params.item.eventId,
    applicationId: params.item.applicationId,
    eventType: params.item.eventType,
    kind: params.kind,
    level: params.level,
    dueDate: params.item.dueDate,
    region: params.region,
    recipientRole: params.recipientRole,
    recipientEmail: recipient?.email,
    title,
    reason: params.item.reason,
    institutionName: params.item.institutionName,
    createdAt: params.now.toISOString(),
    mailStatus: 'SKIPPED',
    escalationId: params.escalation?.id,
    notificationId: notification.id,
  };
  await store.saveAlertLog(log);

  await store.recordLedger(
    params.item.applicationId,
    params.kind === 'ESCALATION' ? 'ALERT_ESCALATION' : 'ALERT_REMINDER',
    'system:alert-engine',
    {
      eventId: params.item.eventId,
      eventType: params.item.eventType,
      kind: params.kind,
      level: params.level,
      dueDate: params.item.dueDate,
      recipientRole: params.recipientRole,
      region: params.region,
    }
  );

  queueEmail(log, recipient?.email);
  return { log, won: true };
}

/** Runs the alert engine for a given "now" (defaults to the current time). */
export async function runAlertEngine(now: Date = new Date()): Promise<AlertRunResult> {
  const items = await buildAlertItems(now);
  const result: AlertRunResult = {
    success: true,
    remindersCreated: 0,
    escalationsCreated: 0,
    notificationsCreated: 0,
    emailsQueued: 0,
    emailsFailed: 0,
    emailsSkipped: 0,
    duplicatesSkipped: 0,
    itemsScanned: items.length,
    runAt: now.toISOString(),
  };

  lastRunFailedEmails = 0;
  lastRunSkippedEmails = 0;

  for (const item of items) {
    const remaining = daysUntil(item.dueDate, now);

    // Reminders: fire the first (largest) offset that has been crossed and not
    // yet dispatched. Re-runs are guarded by the alert log id.
    if (remaining >= 0) {
      const applicable = ALERT_REMINDER_OFFSETS_DAYS.filter((offset) => remaining <= offset);
      if (applicable.length > 0) {
        const offset = applicable[0];
        const dispatched = await dispatchAlert({
          item,
          kind: 'REMINDER',
          level: offset,
          recipientRole: ALERT_REMINDER_RECIPIENT_ROLE[item.eventType],
          region: item.region,
          now,
        });
        if (dispatched) {
          result.remindersCreated += 1;
          result.notificationsCreated += 1;
          result.emailsQueued += 1;
        } else {
          result.duplicatesSkipped += 1;
        }
      }
    }

    // Escalations: every rule whose delay has elapsed, each exactly once.
    if (remaining < 0) {
      const overdueBy = -remaining;
      const rules = ESCALATION_MATRIX.filter(
        (rule) => rule.eventType === item.eventType && overdueBy >= rule.delayDays
      ).sort((a, b) => a.level - b.level);

      for (const rule of rules) {
        const level = rule.level;
        const region = resolvedRegion(item.region, rule.region);
        const escalationId = `ESC-${item.eventId}-${level}`;
        let escalation = await store.getEscalation(escalationId);
        const alreadyLogged = await store.getAlertLog(
          makeLogId(item.eventId, 'ESCALATION', level)
        );
        if (alreadyLogged) {
          result.duplicatesSkipped += 1;
          continue;
        }
        if (!escalation) {
          escalation = {
            id: escalationId,
            applicationId: item.applicationId,
            eventType: item.eventType,
            level,
            status: 'OPEN',
            createdAt: now.toISOString(),
            remarks: '',
            region,
            recipientRole: rule.recipientRole,
            reason: item.reason,
            institutionName: item.institutionName,
          };
          await store.saveEscalation(escalation);
          result.escalationsCreated += 1;
        }

        const dispatched = await dispatchAlert({
          item,
          kind: 'ESCALATION',
          level,
          recipientRole: rule.recipientRole,
          region,
          now,
          escalation,
        });
        if (dispatched) {
          result.notificationsCreated += 1;
          result.emailsQueued += 1;
        }
      }
    }
  }

  // Delivery is queued (never blocks unrelated request paths); the dedicated
  // cron run waits for settlement so it can report accurate statuses.
  await flushAlertEmails();

  result.emailsFailed = lastRunFailedEmails;
  result.emailsSkipped = lastRunSkippedEmails;
  return result;
}

/**
 * Waits for all queued emails to settle. The cron handler calls this so tests
 * (and operators) observe final mail statuses, while normal HTTP requests are
 * never blocked on SMTP in production thanks to the bounded retry.
 */
export async function flushAlertEmails(): Promise<void> {
  const queued = pendingEmails;
  pendingEmails = [];
  await Promise.all(queued.map((entry) => entry.promise));
}

/** Test/reset helper: clears queued email work. */
export function resetAlertEngineForTests(): void {
  pendingEmails = [];
  lastRunFailedEmails = 0;
  lastRunSkippedEmails = 0;
}

