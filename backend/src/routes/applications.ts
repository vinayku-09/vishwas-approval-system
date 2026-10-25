import { Hono } from 'hono';
import { z } from 'zod';
import { store } from '../db/store.js';
import { ApplicationType, ComplianceDocument, Role, SignoffDecision, SignoffRecord, Status } from '../types.js';
import { evaluateRules } from '../services/rules.js';
import { validateTransition } from '../services/workflow.js';
import { extractApplicationDocuments } from '../services/extractor.js';
import { computeExpiryState } from '../services/expiry.js';

export const applicationsRouter = new Hono();

const createApplicationSchema = z.object({
  institutionName: z.string().min(3, 'Institution name must be at least 3 characters'),
  type: z.enum(['NEW', 'EXTENSION_OF_APPROVAL', 'INTAKE_CHANGE'] as const),
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
  to: z.enum([
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
  ] as const),
  remarks: z.string().optional(),
  override: z.boolean().optional(),
  overrideRemarks: z.string().optional(),
});

const signoffSchema = z.object({
  decision: z.enum(['CONFIRM', 'OVERRIDE'] as const),
  deficiencyIds: z.array(z.string()).default([]),
  remarks: z.string().optional(),
});

// GET /applications - list with optional filters
applicationsRouter.get('/', async (c) => {
  const status = c.req.query('status') as Status | undefined;
  const type = c.req.query('type') as ApplicationType | undefined;

  const applications = await store.listApplications({ status, type });
  return c.json(applications);
});

// POST /applications - create new application
applicationsRouter.post('/', async (c) => {
  const role = (c.req.header('x-role') || 'institution') as Role;
  const body = await c.req.json().catch(() => null);

  const parsed = createApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.errors.map((e) => e.message).join(', ') }, 400);
  }

  const application = await store.createApplication({
    institutionName: parsed.data.institutionName,
    type: parsed.data.type,
    extracted: parsed.data.extracted,
    actor: role,
  });

  return c.json(application, 201);
});

// GET /applications/:id - get details
applicationsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const application = await store.getApplication(id);

  if (!application) {
    return c.json({ error: `Application '${id}' not found` }, 404);
  }

  return c.json(application);
});

// POST /applications/:id/extract - AI Extraction + Rule Evaluation (Officer role)
applicationsRouter.post('/:id/extract', async (c) => {
  const role = (c.req.header('x-role') || 'institution') as Role;
  if (role !== 'officer') {
    return c.json({ error: 'Forbidden: Extraction action requires officer role' }, 403);
  }

  const id = c.req.param('id');
  const application = await store.getApplication(id);
  if (!application) {
    return c.json({ error: `Application '${id}' not found` }, 404);
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

  // Determine next state
  let nextStatus: Status;
  if (!allPassed) {
    nextStatus = 'DEFICIENT';
  } else {
    nextStatus = application.type === 'NEW' ? 'EVC_REQUIRED' : 'DECISION';
  }

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
    application: updated,
    extraction: extractionResult,
    deficiencies,
    results,
    allPassed,
  });
});

// POST /applications/:id/signoff - Human Officer Sign-Off (Officer only)
applicationsRouter.post('/:id/signoff', async (c) => {
  const role = (c.req.header('x-role') || 'institution') as Role;
  if (role !== 'officer') {
    return c.json({ error: 'Forbidden: Sign-off requires officer role' }, 403);
  }

  const id = c.req.param('id');
  const application = await store.getApplication(id);
  if (!application) {
    return c.json({ error: `Application '${id}' not found` }, 404);
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
    application: updated,
  });
});

// POST /applications/:id/advance - advance state machine (Officer only)
applicationsRouter.post('/:id/advance', async (c) => {
  const role = (c.req.header('x-role') || 'institution') as Role;
  if (role !== 'officer') {
    return c.json({ error: 'Forbidden: Advancing workflow requires officer role' }, 403);
  }

  const id = c.req.param('id');
  const application = await store.getApplication(id);
  if (!application) {
    return c.json({ error: `Application '${id}' not found` }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = advanceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.errors.map((e) => e.message).join(', ') }, 400);
  }

  const targetStatus = parsed.data.to;

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

  const updated = await store.updateApplication(id, {
    status: targetStatus,
  });

  // Record ledger entry
  await store.recordLedger(id, 'WORKFLOW_STATE_ADVANCED', role, {
    previousStatus: application.status,
    newStatus: targetStatus,
    remarks: parsed.data.remarks || `Status transitioned from ${application.status} to ${targetStatus}`,
  });

  return c.json(updated);
});

// GET /applications/:id/compliance - list compliance documents with expiry states
applicationsRouter.get('/:id/compliance', async (c) => {
  const id = c.req.param('id');
  const app = await store.getApplication(id);
  if (!app) {
    return c.json({ error: `Application '${id}' not found` }, 404);
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
  const role = (c.req.header('x-role') || 'institution') as Role;
  if (role !== 'officer') {
    return c.json({ error: 'Forbidden: Scrutiny action requires officer role' }, 403);
  }

  const id = c.req.param('id');
  const application = await store.getApplication(id);
  if (!application) {
    return c.json({ error: `Application '${id}' not found` }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = scrutinySchema.safeParse(body);
  const updatedExtracted = {
    ...application.extracted,
    ...(parsed.success ? parsed.data : {}),
  };

  const { results, deficiencies, allPassed } = evaluateRules(updatedExtracted);

  let nextStatus: Status;
  if (!allPassed) {
    nextStatus = 'DEFICIENT';
  } else {
    nextStatus = application.type === 'NEW' ? 'EVC_REQUIRED' : 'DECISION';
  }

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
    application: updated,
    deficiencies,
    results,
    allPassed,
  });
});
