import { Hono } from 'hono';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { store } from '../db/store.js';
import {
  ApplicationType,
  ComplianceDocument,
  EvcReport,
  ReturnRecord,
  SignoffDecision,
  SignoffRecord,
  Status,
} from '../types.js';
import { authMiddleware, resolveActorRole } from '../middleware/auth.js';
import { canReadApplication } from '../services/access.js';
import { evaluateRules } from '../services/rules.js';
import { validateTransition } from '../services/workflow.js';
import { extractApplicationDocuments } from '../services/extractor.js';
import { computeExpiryState } from '../services/expiry.js';
import { canonicalJson, verifyLedgerChain } from '../services/ledger.js';
import { scheduleSingleEvc } from '../services/scheduler.js';
import {
  decorateApplication,
  getAutoNextStatus,
  getPostScrutinyStatus,
  getRouteDefinition,
  getRouteState,
} from '../services/routing.js';
import { createDecisionNotice, createReturnNotice, issueNotice } from '../services/notices.js';
import { RETURN_CATEGORY_IDS, SAFEGUARD_NOTICE } from '../config/routes.js';
import { sendNotificationEmail } from '../services/mailer.js';

export const applicationsRouter = new Hono();

applicationsRouter.use('*', authMiddleware);

const scheduleEvcSchema = z.object({
  inspectorIds: z.tuple([z.string(), z.string()]),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'scheduledDate must be in format YYYY-MM-DD'),
  source: z.enum(['ortools', 'fallback', 'manual']).optional(),
});

const evcReportSchema = z.object({
  findings: z.object({
    infrastructure: z.string().min(3, 'Infrastructure evaluation required'),
    faculty: z.string().min(3, 'Faculty evaluation required'),
    labs: z.string().min(3, 'Laboratories evaluation required'),
    remarks: z.string().min(3, 'Remarks required'),
  }),
  recommendation: z.enum(['RECOMMENDED', 'DEFICIENT'] as const),
});

const createApplicationSchema = z.object({
  institutionName: z.string().min(3, 'Institution name must be at least 3 characters'),
  type: z.enum(['NEW', 'EXTENSION_OF_APPROVAL', 'INTAKE_CHANGE', 'APPEAL'] as const),
  extracted: z
    .object({
      landAreaSqm: z.number().positive().optional(),
      leaseEndDate: z.string().optional(),
      fireNocExpiry: z.string().optional(),
    })
    .optional(),
});

const scrutinySchema = z.object({
  landAreaSqm: z.number().positive().optional(),
  leaseEndDate: z.string().optional(),
  fireNocExpiry: z.string().optional(),
});

const advanceSchema = z.object({
  to: z
    .enum([
      'SUBMITTED',
      'SCRUTINY',
      'DEFICIENT',
      'EVC_REQUIRED',
      'EVC_DONE',
      'DECISION',
      'APPROVED',
      'REJECTED',
      'APPEAL_SHC',
      'APPEAL_SAC',
    ] as const)
    .optional(),
  remarks: z.string().optional(),
  override: z.boolean().optional(),
  overrideRemarks: z.string().optional(),
});

const returnSchema = z.object({
  to: z.enum([
    'SUBMITTED',
    'SCRUTINY',
    'DEFICIENT',
    'EVC_REQUIRED',
    'EVC_DONE',
    'DECISION',
  ] as const),
  category: z.enum(RETURN_CATEGORY_IDS),
  reason: z.string().trim().min(10, 'A recorded return reason of at least 10 characters is required'),
});

const signoffSchema = z.object({
  decision: z.enum(['CONFIRM', 'OVERRIDE'] as const),
  deficiencyIds: z.array(z.string()).default([]),
  remarks: z.string().optional(),
});

// GET /applications - list with optional filters, scoped to the caller
applicationsRouter.get('/', async (c) => {
  const user = c.get('user');
  const status = c.req.query('status') as Status | undefined;
  const type = c.req.query('type') as ApplicationType | undefined;

  const applications = await store.listApplications({ status, type });
  return c.json(
    applications
      .filter((application) => canReadApplication(user, application))
      .map((application) => decorateApplication(application))
  );
});

// POST /applications - create new application
applicationsRouter.post('/', async (c) => {
  const user = c.get('user');
  const role = resolveActorRole(c, 'institution');
  const body = await c.req.json().catch(() => null);

  const parsed = createApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.errors.map((e) => e.message).join(', ') }, 400);
  }

  // An institution account can only submit applications under its own name.
  const institutionName =
    user.role === 'INSTITUTION' && user.institutionName
      ? user.institutionName
      : parsed.data.institutionName;

  const application = await store.createApplication({
    institutionName,
    type: parsed.data.type,
    extracted: parsed.data.extracted,
    actor: role,
  });

  return c.json(decorateApplication(application), 201);
});

// GET /applications/:id - get details
applicationsRouter.get('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const application = await store.getApplication(id);

  if (!application) {
    return c.json({ error: `Application '${id}' not found` }, 404);
  }

  if (!canReadApplication(user, application)) {
    return c.json({ error: 'Forbidden: Application is outside your scope' }, 403);
  }

  return c.json(decorateApplication(application));
});

// GET /applications/:id/route - configured route, stage and return options
applicationsRouter.get('/:id/route', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const application = await store.getApplication(id);
  if (!application) {
    return c.json({ error: `Application '${id}' not found` }, 404);
  }
  if (!canReadApplication(user, application)) {
    return c.json({ error: 'Forbidden: Application is outside your scope' }, 403);
  }

  return c.json(getRouteState(application));
});

// GET /applications/:id/case-summary - read-only electronic case summary
applicationsRouter.get('/:id/case-summary', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const application = await store.getApplication(id);
  if (!application) {
    return c.json({ error: `Application '${id}' not found` }, 404);
  }
  if (!canReadApplication(user, application)) {
    return c.json({ error: 'Forbidden: Application is outside your scope' }, 403);
  }

  const [documents, complianceDocuments, allInspections, allNotifications, ledger, signoff] =
    await Promise.all([
      store.getDocuments(id),
      store.getComplianceDocuments(id),
      store.getInspections(),
      store.listNotifications(),
      store.getLedger(id),
      store.getSignoff(id),
    ]);

  const verification = verifyLedgerChain(ledger);
  const route = getRouteState(application);

  return c.json({
    generatedAt: new Date().toISOString(),
    readOnly: true,
    safeguardNotice: SAFEGUARD_NOTICE,
    application,
    route,
    timeline: ledger.map((entry) => {
      const payload = entry.payload as Record<string, unknown>;
      const status = (payload.newStatus ?? payload.status ?? payload.initialStatus) as
        | Status
        | undefined;
      return {
        id: entry.id,
        at: entry.timestamp,
        eventType: entry.eventType,
        actor: entry.actor,
        status,
      };
    }),
    returns: application.returns ?? [],
    signoff: application.signoff ?? signoff ?? undefined,
    documents,
    complianceDocuments,
    inspections: allInspections.filter((inspection) => inspection.applicationId === id),
    notices: allNotifications.filter((notification) => notification.applicationId === id),
    ledger: {
      totalEntries: ledger.length,
      valid: verification.valid,
      brokenAt: verification.brokenAt,
      message: verification.message,
    },
  });
});

// POST /applications/:id/extract - AI Extraction + Rule Evaluation (Officer role)
applicationsRouter.post('/:id/extract', async (c) => {
  const role = resolveActorRole(c, 'institution');
  if (role !== 'officer') {
    return c.json({ error: 'Forbidden: Extraction action requires officer role' }, 403);
  }

  const user = c.get('user');
  const id = c.req.param('id');
  const application = await store.getApplication(id);
  if (!application) {
    return c.json({ error: `Application '${id}' not found` }, 404);
  }
  if (!canReadApplication(user, application)) {
    return c.json({ error: 'Forbidden: Application is outside your scope' }, 403);
  }

  // Fetch uploaded documents for this application
  const docs = await store.getDocuments(id);

  // Run AI Vision / Mock extraction
  const extractionResult = await extractApplicationDocuments(application, docs);

  // Write EXTRACTION_COMPLETED ledger entry
  await store.recordLedger(id, 'EXTRACTION_COMPLETED', role, {
    source: extractionResult.source,
    model: extractionResult.model,
    extractedAt: extractionResult.extractedAt,
    documentCount: docs.length,
    fields: extractionResult.fields,
  });

  // Feed extracted values into existing AICTE rules
  const { results, deficiencies, allPassed } = evaluateRules(extractionResult.fields);

  // Determine next state from the configured route, not the application type.
  const nextStatus: Status = getPostScrutinyStatus(application, !allPassed);

  const extractedScalars = {
    landAreaSqm: extractionResult.fields.landAreaSqm.value,
    leaseEndDate: extractionResult.fields.leaseEndDate.value,
    fireNocExpiry: extractionResult.fields.fireNocExpiry.value,
  };

  const updated = await store.updateApplication(id, {
    status: nextStatus,
    extracted: extractedScalars,
    extractedDetails: extractionResult,
    deficiencies,
  });

  // Create or update ComplianceDocument entities from extracted dates
  const now = new Date();
  if (extractedScalars.leaseEndDate) {
    const compState = computeExpiryState(extractedScalars.leaseEndDate, now);
    const compDoc: ComplianceDocument = {
      id: `COMP-${id}-LEASE`,
      applicationId: id,
      docType: 'LEASE_DEED',
      expiryDate: extractedScalars.leaseEndDate,
      ...compState,
      lastCheckedAt: now.toISOString(),
    };
    await store.saveComplianceDocument(compDoc);
  }

  if (extractedScalars.fireNocExpiry) {
    const compState = computeExpiryState(extractedScalars.fireNocExpiry, now);
    const compDoc: ComplianceDocument = {
      id: `COMP-${id}-FIRE`,
      applicationId: id,
      docType: 'FIRE_NOC',
      expiryDate: extractedScalars.fireNocExpiry,
      ...compState,
      lastCheckedAt: now.toISOString(),
    };
    await store.saveComplianceDocument(compDoc);
  }

  // Write SCRUTINY_COMPLETED ledger entry
  await store.recordLedger(id, 'SCRUTINY_COMPLETED', role, {
    previousStatus: application.status,
    newStatus: nextStatus,
    passed: allPassed,
    deficienciesCount: deficiencies.length,
    deficiencies,
    ruleResults: results,
  });

  return c.json({
    application: decorateApplication(updated!),
    extraction: extractionResult,
    deficiencies,
    results,
    allPassed,
  });
});

// POST /applications/:id/signoff - Human Officer Sign-Off (Officer only)
applicationsRouter.post('/:id/signoff', async (c) => {
  const role = resolveActorRole(c, 'institution');
  if (role !== 'officer') {
    return c.json({ error: 'Forbidden: Sign-off requires officer role' }, 403);
  }

  const user = c.get('user');
  const id = c.req.param('id');
  const application = await store.getApplication(id);
  if (!application) {
    return c.json({ error: `Application '${id}' not found` }, 404);
  }
  if (!canReadApplication(user, application)) {
    return c.json({ error: 'Forbidden: Application is outside your scope' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = signoffSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.errors.map((e) => e.message).join(', ') }, 400);
  }

  const { decision, deficiencyIds, remarks } = parsed.data;

  if (decision === 'OVERRIDE' && (!remarks || remarks.trim().length === 0)) {
    return c.json({ error: 'Remarks are strictly required for an OVERRIDE sign-off' }, 400);
  }

  const signoffRecord: SignoffRecord = {
    id: `SIGNOFF-${id}-${Date.now().toString().slice(-6)}`,
    applicationId: id,
    officer: role,
    decision,
    deficiencyIds,
    remarks: remarks || '',
    timestamp: new Date().toISOString(),
  };

  await store.recordSignoff(signoffRecord);
  const updated = await store.updateApplication(id, { signoff: signoffRecord });

  // Record ledger entry
  const eventType = decision === 'CONFIRM' ? 'SIGNOFF' : 'OVERRIDE';
  await store.recordLedger(id, eventType, role, {
    signoffId: signoffRecord.id,
    decision,
    deficiencyIds,
    remarks: signoffRecord.remarks,
    officer: role,
  });

  return c.json({
    success: true,
    signoff: signoffRecord,
    application: decorateApplication(updated!),
  });
});

// POST /applications/:id/advance - advance state machine (Officer only)
applicationsRouter.post('/:id/advance', async (c) => {
  const role = resolveActorRole(c, 'institution');
  if (role !== 'officer') {
    return c.json({ error: 'Forbidden: Advancing workflow requires officer role' }, 403);
  }

  const user = c.get('user');
  const id = c.req.param('id');
  const application = await store.getApplication(id);
  if (!application) {
    return c.json({ error: `Application '${id}' not found` }, 404);
  }
  if (!canReadApplication(user, application)) {
    return c.json({ error: 'Forbidden: Application is outside your scope' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = advanceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.errors.map((e) => e.message).join(', ') }, 400);
  }

  const targetStatus = parsed.data.to ?? getAutoNextStatus(application);
  if (!targetStatus) {
    return c.json(
      {
        error:
          'No automatic next stage is available. Select an explicit target; decisions and EVC reports require human action.',
      },
      400
    );
  }

  // Rule 1: Check if application is locked due to expired document
  if (application.locked) {
    const hasOverrideRemarks =
      parsed.data.overrideRemarks && parsed.data.overrideRemarks.trim().length > 0;
    const hasOverrideSignoff =
      application.signoff?.decision === 'OVERRIDE' &&
      application.signoff?.remarks &&
      application.signoff.remarks.trim().length > 0;

    if (!hasOverrideRemarks && !hasOverrideSignoff) {
      return c.json(
        {
          error:
            'Application is locked due to expired compliance document(s). Officer override with remarks required to advance.',
        },
        423
      );
    }

    // Write OVERRIDE ledger entry for advancing a locked application
    await store.recordLedger(id, 'OVERRIDE', role, {
      action: 'ADVANCE_LOCKED_APPLICATION',
      targetStatus,
      remarks: parsed.data.overrideRemarks || application.signoff?.remarks || 'Officer override of lock',
    });
  }

  // Rule 2: Advancing to REJECTED requires an officer CONFIRM sign-off
  if (targetStatus === 'REJECTED') {
    const hasConfirmSignoff = application.signoff?.decision === 'CONFIRM';
    if (!hasConfirmSignoff) {
      return c.json({ error: 'Officer sign-off required' }, 409);
    }
  }

  // State machine transition validation
  const validation = validateTransition(application.status, targetStatus);
  if (!validation.valid) {
    return c.json({ error: validation.error }, 400);
  }

  // Route validation: a globally valid transition must also belong to the
  // configured PS route (for example ONLY_SCRUTINY cannot jump to EVC).
  const routeState = getRouteState(application);
  if (!routeState.nextStatuses.includes(targetStatus)) {
    return c.json(
      {
        error: `Invalid transition from '${application.status}' to '${targetStatus}' for route '${routeState.name}'. Allowed next stages: [${
          routeState.nextStatuses.join(', ') || 'None'
        }]`,
      },
      400
    );
  }

  const updated = await store.updateApplication(id, {
    status: targetStatus,
  });
  if (!updated) {
    return c.json({ error: `Application '${id}' not found` }, 404);
  }

  const route = getRouteDefinition(application);

  // Record ledger entry
  await store.recordLedger(id, 'WORKFLOW_STATE_ADVANCED', role, {
    previousStatus: application.status,
    newStatus: targetStatus,
    routeId: route.id,
    automatic: parsed.data.to === undefined,
    remarks: parsed.data.remarks || `Status transitioned from ${application.status} to ${targetStatus}`,
  });

  // Standard decision notice for a final outcome.
  if (targetStatus === 'APPROVED' || targetStatus === 'REJECTED') {
    await issueNotice(
      updated,
      createDecisionNotice(updated, targetStatus, parsed.data.remarks),
      role
    );
  }

  // Real email notification for status change (server-side only, never break user action)
  store.listUsers().then((users) => {
    const instUser = users.find((u) => u.institutionName === updated.institutionName);
    const targetEmail = instUser?.email || process.env.ALERT_EMAIL_OVERRIDE || 'vinaysingh6916@gmail.com';
    return sendNotificationEmail({
      to: targetEmail,
      applicationId: id,
      subject: `Status changed to ${targetStatus}`,
      reason: parsed.data.remarks || `Status transitioned from ${application.status} to ${targetStatus}`,
      portalPath: '/institution',
    });
  }).catch((err) => {
    console.error('[applications:notify:failed]', err?.message || err);
  });

  return c.json(decorateApplication(updated));
});

// POST /applications/:id/return - return/revert with category and reason
applicationsRouter.post('/:id/return', async (c) => {
  const role = resolveActorRole(c, 'institution');
  if (role !== 'officer' && role !== 'chief') {
    return c.json({ error: 'Forbidden: Return/revert requires officer or CHIEF role' }, 403);
  }

  const user = c.get('user');
  const id = c.req.param('id');
  const application = await store.getApplication(id);
  if (!application) {
    return c.json({ error: `Application '${id}' not found` }, 404);
  }
  if (!canReadApplication(user, application)) {
    return c.json({ error: 'Forbidden: Application is outside your scope' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = returnSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.errors.map((e) => e.message).join(', ') }, 400);
  }

  const targetStatus = parsed.data.to;
  const allowedTargets = getRouteState(application).returnTargets;
  if (!allowedTargets.includes(targetStatus)) {
    return c.json(
      {
        error: `Invalid return from '${application.status}' to '${targetStatus}'. Allowed targets: [${
          allowedTargets.join(', ') || 'None'
        }]`,
      },
      400
    );
  }

  const record: ReturnRecord = {
    id: `RETURN-${id}-${Date.now()}`,
    applicationId: id,
    fromStatus: application.status,
    toStatus: targetStatus,
    category: parsed.data.category,
    reason: parsed.data.reason,
    actor: role,
    timestamp: new Date().toISOString(),
  };

  const updated = await store.updateApplication(id, {
    status: targetStatus,
    lastReturn: record,
    returns: [...(application.returns ?? []), record],
  });
  if (!updated) {
    return c.json({ error: `Application '${id}' not found` }, 404);
  }

  await store.recordLedger(id, 'APPLICATION_RETURNED', role, {
    returnId: record.id,
    previousStatus: record.fromStatus,
    newStatus: record.toStatus,
    category: record.category,
    reason: record.reason,
    routeId: getRouteDefinition(application).id,
  });

  const notice = await issueNotice(updated, createReturnNotice(updated, record), role);

  // Real email notification for return (server-side only, never break user action)
  store.listUsers().then((users) => {
    const instUser = users.find((u) => u.institutionName === updated.institutionName);
    const targetEmail = instUser?.email || process.env.ALERT_EMAIL_OVERRIDE || 'vinaysingh6916@gmail.com';
    return sendNotificationEmail({
      to: targetEmail,
      applicationId: id,
      subject: `Application Returned: ${parsed.data.category}`,
      reason: parsed.data.reason,
      portalPath: '/institution',
    });
  }).catch((err) => {
    console.error('[applications:return:notify:failed]', err?.message || err);
  });

  return c.json({
    application: decorateApplication(updated),
    return: record,
    notice,
    message: 'Return recorded with reason and category; standard notice issued to the institution.',
  });
});

// POST /applications/:id/reply-return - Institution replies to a return notice
const replyReturnSchema = z.object({
  remarks: z.string().trim().min(5, 'Clarification remarks required (at least 5 characters)'),
});

applicationsRouter.post('/:id/reply-return', async (c) => {
  const user = c.get('user');
  const role = resolveActorRole(c, 'institution');
  const id = c.req.param('id');
  const application = await store.getApplication(id);
  if (!application) {
    return c.json({ error: `Application '${id}' not found` }, 404);
  }
  if (!canReadApplication(user, application)) {
    return c.json({ error: 'Forbidden: Application is outside your scope' }, 403);
  }
  if (!application.lastReturn) {
    return c.json({ error: 'Application does not have any active return to reply to' }, 400);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = replyReturnSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.errors.map((e) => e.message).join(', ') }, 400);
  }

  const reply = {
    returnId: application.lastReturn.id,
    remarks: parsed.data.remarks,
    repliedAt: new Date().toISOString(),
    actor: user.email || role,
  };

  const updated = await store.updateApplication(id, {
    returnReply: reply,
  });

  await store.recordLedger(id, 'RETURN_REPLIED', role, {
    returnId: application.lastReturn.id,
    remarks: parsed.data.remarks,
    actor: user.email || role,
  });

  return c.json({
    success: true,
    application: decorateApplication(updated!),
    reply,
  });
});

// GET /applications/:id/compliance - list compliance documents with expiry states
applicationsRouter.get('/:id/compliance', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const app = await store.getApplication(id);
  if (!app) {
    return c.json({ error: `Application '${id}' not found` }, 404);
  }
  if (!canReadApplication(user, app)) {
    return c.json({ error: 'Forbidden: Application is outside your scope' }, 403);
  }

  const docs = await store.getComplianceDocuments(id);
  return c.json({
    applicationId: id,
    locked: app.locked || false,
    documents: docs,
  });
});

// Legacy / Direct POST /applications/:id/scrutiny (backwards compatible)
applicationsRouter.post('/:id/scrutiny', async (c) => {
  const role = resolveActorRole(c, 'institution');
  if (role !== 'officer') {
    return c.json({ error: 'Forbidden: Scrutiny action requires officer role' }, 403);
  }

  const user = c.get('user');
  const id = c.req.param('id');
  const application = await store.getApplication(id);
  if (!application) {
    return c.json({ error: `Application '${id}' not found` }, 404);
  }
  if (!canReadApplication(user, application)) {
    return c.json({ error: 'Forbidden: Application is outside your scope' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = scrutinySchema.safeParse(body);
  const updatedExtracted = {
    ...application.extracted,
    ...(parsed.success ? parsed.data : {}),
  };

  const { results, deficiencies, allPassed } = evaluateRules(updatedExtracted);

  const nextStatus: Status = getPostScrutinyStatus(application, !allPassed);

  const updated = await store.updateApplication(id, {
    status: nextStatus,
    extracted: updatedExtracted,
    deficiencies,
  });

  await store.recordLedger(id, 'SCRUTINY_RULE_EVALUATION', role, {
    previousStatus: application.status,
    newStatus: nextStatus,
    passed: allPassed,
    deficienciesCount: deficiencies.length,
    deficiencies,
    ruleResults: results,
  });

  return c.json({
    application: decorateApplication(updated!),
    deficiencies,
    results,
    allPassed,
  });
});

// POST /applications/:id/schedule-evc (Officer role)
// Schedules 2 distinct, conflict-free, domain-qualified inspectors for physical inspection
applicationsRouter.post('/:id/schedule-evc', async (c) => {
  const role = resolveActorRole(c, 'officer');
  if (role !== 'officer') {
    return c.json({ error: 'Forbidden: EVC scheduling requires officer role' }, 403);
  }

  const user = c.get('user');
  const id = c.req.param('id');
  const application = await store.getApplication(id);
  if (!application) {
    return c.json({ error: `Application '${id}' not found` }, 404);
  }
  if (!canReadApplication(user, application)) {
    return c.json({ error: 'Forbidden: Application is outside your scope' }, 403);
  }

  if (application.locked) {
    return c.json({ error: 'Application is locked due to expired compliance documents' }, 423);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = scheduleEvcSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.errors.map((e) => e.message).join(', ') }, 400);
  }

  const scheduleRes = await scheduleSingleEvc(
    application,
    parsed.data.inspectorIds,
    parsed.data.scheduledDate,
    parsed.data.source || 'fallback'
  );

  if (!scheduleRes.success || !scheduleRes.assignment) {
    return c.json({ error: scheduleRes.error || 'Failed to schedule inspection' }, 400);
  }

  // Record ledger entry
  await store.recordLedger(id, 'EVC_SCHEDULED', role, {
    inspectorIds: parsed.data.inspectorIds,
    scheduledDate: parsed.data.scheduledDate,
    source: parsed.data.source || 'fallback',
    institutionName: application.institutionName,
    teamSize: 2,
    domain: application.domain || 'CSE',
  });

  const updatedApp = await store.updateApplication(id, {
    scheduledInspection: scheduleRes.assignment,
  });

  return c.json({
    application: decorateApplication(updatedApp!),
    assignment: scheduleRes.assignment,
    message: 'Inspection team successfully scheduled and recorded in audit ledger',
  }, 201);
});

// POST /applications/:id/evc-report (Committee role)
// Submits physical inspection findings, hashes the report, and advances state to EVC_DONE
applicationsRouter.post('/:id/evc-report', async (c) => {
  const role = resolveActorRole(c, 'committee');
  if (role !== 'committee' && role !== 'officer') {
    return c.json({ error: 'Forbidden: EVC report submission requires committee or officer role' }, 403);
  }

  const user = c.get('user');
  const id = c.req.param('id');
  const application = await store.getApplication(id);
  if (!application) {
    return c.json({ error: `Application '${id}' not found` }, 404);
  }
  if (!canReadApplication(user, application)) {
    return c.json({ error: 'Forbidden: Application is outside your scope' }, 403);
  }

  if (application.status !== 'EVC_REQUIRED') {
    return c.json({
      error: `Invalid application status '${application.status}'. EVC report can only be submitted for applications in 'EVC_REQUIRED'`,
    }, 400);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = evcReportSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.errors.map((e) => e.message).join(', ') }, 400);
  }

  // Compute canonical cryptographic hash of report findings
  const reportHash = createHash('sha256')
    .update(canonicalJson(parsed.data.findings))
    .digest('hex');

  const reportId = `REP-${id}-${Date.now()}`;
  const actorId = c.req.header('x-actor') || 'INS-002';

  const report: EvcReport = {
    id: reportId,
    applicationId: id,
    inspectorId: actorId,
    findings: parsed.data.findings,
    recommendation: parsed.data.recommendation,
    reportHash,
    submittedAt: new Date().toISOString(),
  };

  // State machine transition: EVC_REQUIRED -> EVC_DONE
  const transitionCheck = validateTransition(application.status, 'EVC_DONE');
  if (!transitionCheck.valid) {
    return c.json({ error: transitionCheck.error }, 400);
  }

  await store.saveEvcReport(id, report);
  const updatedApp = await store.updateApplication(id, {
    status: 'EVC_DONE',
  });

  // Record ledger entry
  await store.recordLedger(id, 'EVC_REPORT_SUBMITTED', role, {
    reportId,
    reportHash,
    recommendation: parsed.data.recommendation,
    actorId,
    previousStatus: 'EVC_REQUIRED',
    newStatus: 'EVC_DONE',
    findingsSummary: {
      infrastructure: parsed.data.findings.infrastructure.slice(0, 100),
      faculty: parsed.data.findings.faculty.slice(0, 100),
      labs: parsed.data.findings.labs.slice(0, 100),
    },
  });

  return c.json({
    application: decorateApplication(updatedApp!),
    report,
    message: 'EVC inspection report submitted and hashed to tamper-evident ledger',
  }, 201);
});
