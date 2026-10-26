import { Hono } from 'hono';
import { store } from '../db/store.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { AlertEventType, AuthTokenPayload, Escalation, EscalationStatus } from '../types.js';

export const escalationsRouter = new Hono();

escalationsRouter.use('*', authMiddleware);
escalationsRouter.use('*', requireRole('OFFICER', 'COMMITTEE', 'CHIEF'));

const VALID_STATUS: EscalationStatus[] = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'];
const VALID_EVENT_TYPES: AlertEventType[] = [
  'PENDENCY',
  'EVC_SCHEDULING',
  'REPORT_SUBMISSION',
  'UNDERTAKING',
  'DOCUMENT_EXPIRY',
  'DOCUMENT_AUTHENTICITY',
];

/** Applies the caller's region scope to an escalation. */
function isVisible(escalation: Escalation, user: AuthTokenPayload): boolean {
  if (user.role === 'CHIEF') return true;
  if (!user.region || user.region === 'ALL') return true;
  return escalation.region === user.region || escalation.region === 'ALL';
}

// GET /escalations?status=OPEN&eventType=PENDENCY - list escalations in scope
escalationsRouter.get('/', async (c) => {
  const user = c.get('user');
  const statusParam = c.req.query('status')?.toUpperCase();
  const eventTypeParam = c.req.query('eventType')?.toUpperCase();

  if (statusParam && !VALID_STATUS.includes(statusParam as EscalationStatus)) {
    return c.json({ error: `Invalid status '${statusParam}'` }, 400);
  }
  if (eventTypeParam && !VALID_EVENT_TYPES.includes(eventTypeParam as AlertEventType)) {
    return c.json({ error: `Invalid eventType '${eventTypeParam}'` }, 400);
  }

  const escalations = await store.listEscalations({
    status: statusParam as EscalationStatus | undefined,
    eventType: eventTypeParam as AlertEventType | undefined,
  });

  const visible = escalations.filter((escalation) => isVisible(escalation, user));
  return c.json({ escalations: visible, total: visible.length });
});

// POST /escalations/:id/acknowledge
escalationsRouter.post('/:id/acknowledge', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const escalation = await store.getEscalation(id);

  if (!escalation) {
    return c.json({ error: `Escalation '${id}' not found` }, 404);
  }
  if (!isVisible(escalation, user)) {
    return c.json({ error: 'Forbidden: Escalation is outside your region' }, 403);
  }
  if (escalation.status === 'RESOLVED') {
    return c.json({ error: 'Escalation is already resolved' }, 409);
  }

  const updated = await store.updateEscalation(id, {
    status: 'ACKNOWLEDGED',
    acknowledgedAt: new Date().toISOString(),
  });
  await store.recordLedger(escalation.applicationId, 'ESCALATION_ACKNOWLEDGED', user.email, {
    escalationId: id,
    eventType: escalation.eventType,
    level: escalation.level,
  });

  return c.json({ success: true, escalation: updated });
});

// POST /escalations/:id/resolve - remarks are mandatory
escalationsRouter.post('/:id/resolve', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const escalation = await store.getEscalation(id);

  if (!escalation) {
    return c.json({ error: `Escalation '${id}' not found` }, 404);
  }
  if (!isVisible(escalation, user)) {
    return c.json({ error: 'Forbidden: Escalation is outside your region' }, 403);
  }
  if (escalation.status === 'RESOLVED') {
    return c.json({ error: 'Escalation is already resolved' }, 409);
  }

  let body: { remarks?: unknown } = {};
  try {
    body = (await c.req.json()) as { remarks?: unknown };
  } catch {
    body = {};
  }
  const remarks = typeof body.remarks === 'string' ? body.remarks.trim() : '';
  if (!remarks) {
    return c.json({ error: 'Remarks are required to resolve an escalation' }, 400);
  }

  const now = new Date().toISOString();
  const updated = await store.updateEscalation(id, {
    status: 'RESOLVED',
    remarks,
    resolvedAt: now,
    acknowledgedAt: escalation.acknowledgedAt || now,
  });
  await store.recordLedger(escalation.applicationId, 'ESCALATION_RESOLVED', user.email, {
    escalationId: id,
    eventType: escalation.eventType,
    level: escalation.level,
    remarks,
  });

  return c.json({ success: true, escalation: updated });
});
