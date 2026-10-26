/**
 * notices.ts — Standard system notices for returns, decisions and route
 * assignment. Every notice is delivered in-app and anchored in the ledger.
 *
 * Wording is generic and deliberately labels policy as placeholder pending the
 * AICTE Approval Process Handbook.
 */

import { randomUUID } from 'node:crypto';
import type {
  Application,
  Notification,
  ReturnRecord,
  StandardNotice,
  Status,
} from '../types.js';
import { RETURN_CATEGORY_MAP, SAFEGUARD_NOTICE } from '../config/routes.js';
import { getRouteDefinition } from './routing.js';
import { store } from '../db/store.js';

function noticeReference(application: Application, kind: string): string {
  return `AICTE/VISHWAS/${kind}/${application.id}/${Date.now().toString(36).toUpperCase()}`;
}

export function createReturnNotice(
  application: Application,
  record: ReturnRecord
): StandardNotice {
  const category = RETURN_CATEGORY_MAP[record.category];
  const route = getRouteDefinition(application);

  return {
    id: `NOTICE-${randomUUID()}`,
    applicationId: application.id,
    noticeType: 'RETURN',
    reference: noticeReference(application, 'RETURN'),
    subject: `Application ${application.id} returned to ${record.toStatus}`,
    body: [
      `Application ${application.id} for ${application.institutionName} has been returned from ${record.fromStatus} to ${record.toStatus}.`,
      `Category: ${category.label}.`,
      `Recorded reason: ${record.reason}`,
      `Route: ${route.name}.`,
      SAFEGUARD_NOTICE,
    ].join(' '),
    issuedAt: record.timestamp,
    issuedBy: record.actor,
    issuedTo: application.institutionName,
    category: record.category,
  };
}

export function createDecisionNotice(
  application: Application,
  outcome: Extract<Status, 'APPROVED' | 'REJECTED'>,
  remarks?: string
): StandardNotice {
  const route = getRouteDefinition(application);
  const reason = remarks?.trim() || 'No additional officer remarks were recorded.';

  return {
    id: `NOTICE-${randomUUID()}`,
    applicationId: application.id,
    noticeType: 'DECISION',
    reference: noticeReference(application, 'DECISION'),
    subject: `Decision recorded for application ${application.id}: ${outcome}`,
    body: [
      `A competent authority has recorded a ${outcome} outcome for application ${application.id} (${application.institutionName}).`,
      `Route: ${route.name}.`,
      `Recorded reason: ${reason}`,
      SAFEGUARD_NOTICE,
    ].join(' '),
    issuedAt: new Date().toISOString(),
    issuedBy: 'competent-authority',
    issuedTo: application.institutionName,
  };
}

/**
 * Delivers the notice as an in-app notification and writes an immutable
 * NOTICE_ISSUED ledger entry. The ledger write is part of issuing the notice,
 * so a notice can never exist without an audit trail.
 */
export async function issueNotice(
  application: Application,
  notice: StandardNotice,
  actor: string
): Promise<StandardNotice> {
  const notification: Notification = {
    id: `NOTIF-${notice.id}`,
    applicationId: application.id,
    title: notice.subject,
    message: notice.body,
    type: notice.noticeType === 'RETURN' || notice.subject.endsWith('REJECTED') ? 'WARNING' : 'INFO',
    read: false,
    createdAt: notice.issuedAt,
    idempotencyKey: notice.id,
    recipientRole: 'INSTITUTION',
    region: application.region ?? 'ALL',
    institutionName: application.institutionName,
    eventId: notice.id,
  };

  await store.addNotification(notification);
  await store.recordLedger(application.id, 'NOTICE_ISSUED', actor, {
    noticeId: notice.id,
    noticeType: notice.noticeType,
    reference: notice.reference,
    subject: notice.subject,
    issuedTo: notice.issuedTo,
    category: notice.category,
  });

  return notice;
}
