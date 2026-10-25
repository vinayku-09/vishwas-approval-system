import { Hono } from 'hono';
import { z } from 'zod';
import { store } from '../db/store.js';
import { ApplicationType, Role, Status } from '../types.js';
import { evaluateRules } from '../services/rules.js';
import { validateTransition } from '../services/workflow.js';

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

// POST /applications/:id/scrutiny - run automated rules scrutiny (Officer only)
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

  // Merge any incoming extracted data with existing
  const body = await c.req.json().catch(() => ({}));
  const parsed = scrutinySchema.safeParse(body);
  const updatedExtracted = {
    ...application.extracted,
    ...(parsed.success ? parsed.data : {}),
  };

  // Run AICTE rules scrutiny
  const { results, deficiencies, allPassed } = evaluateRules(updatedExtracted);

  // Determine next state
  let nextStatus: Status;
  if (!allPassed) {
    nextStatus = 'DEFICIENT';
  } else {
    // If no deficiencies: NEW institutions require physical EVC inspection; others can proceed to DECISION
    nextStatus = application.type === 'NEW' ? 'EVC_REQUIRED' : 'DECISION';
  }

  const updated = await store.updateApplication(id, {
    status: nextStatus,
    extracted: updatedExtracted,
    deficiencies,
  });

  // Write immutable ledger entry
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
