import { Hono } from 'hono';
import { store } from '../db/store.js';
import { verifyLedgerChain } from '../services/ledger.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { canReadApplication } from '../services/access.js';

export const ledgerRouter = new Hono();

// GET /ledger - Head office & scoped audit trail query with filters and verification status.
ledgerRouter.get('/', authMiddleware, async (c) => {
  const user = c.get('user');
  const eventType = c.req.query('eventType') || undefined;
  const actor = c.req.query('actor') || undefined;
  const fromDate = c.req.query('fromDate') || undefined;
  const toDate = c.req.query('toDate') || undefined;
  const applicationIdQuery = c.req.query('applicationId')?.trim() || undefined;
  const regionQuery = c.req.query('region') || undefined;

  const allApps = await store.listApplications();
  const scopedApps = allApps.filter((app) => {
    if (!canReadApplication(user, app)) return false;
    if (applicationIdQuery && !app.id.toLowerCase().includes(applicationIdQuery.toLowerCase())) {
      return false;
    }
    if (regionQuery && regionQuery !== 'ALL') {
      if (app.region && app.region !== 'ALL' && app.region !== regionQuery) return false;
    }
    return true;
  });

  const matchingEntries: Array<{
    id: string;
    applicationId: string;
    institutionName: string;
    region: string;
    eventType: string;
    actor: string;
    payload: Record<string, unknown>;
    timestamp: string;
    prevHash: string;
    hash: string;
    verification: ReturnType<typeof verifyLedgerChain>;
  }> = [];

  const allEventTypes = new Set<string>();
  const allActors = new Set<string>();
  let verifiedChains = 0;
  let brokenChains = 0;

  for (const app of scopedApps) {
    const entries = await store.getLedger(app.id);
    const verification = verifyLedgerChain(entries);

    if (verification.valid) verifiedChains += 1;
    else brokenChains += 1;

    for (const entry of entries) {
      allEventTypes.add(entry.eventType);
      allActors.add(entry.actor);

      // Apply filters
      if (eventType && entry.eventType !== eventType) continue;
      if (actor && entry.actor.toLowerCase() !== actor.toLowerCase()) continue;
      if (fromDate && entry.timestamp.slice(0, 10) < fromDate) continue;
      if (toDate && entry.timestamp.slice(0, 10) > toDate) continue;

      matchingEntries.push({
        ...entry,
        institutionName: app.institutionName,
        region: app.region || 'ALL',
        verification,
      });
    }
  }

  // Sort descending by timestamp (newest first)
  matchingEntries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return c.json({
    totalMatching: matchingEntries.length,
    summary: {
      totalEntries: matchingEntries.length,
      applicationsAudited: scopedApps.length,
      verifiedChains,
      brokenChains,
      allEventTypes: Array.from(allEventTypes).sort(),
      allActors: Array.from(allActors).sort(),
    },
    entries: matchingEntries,
  });
});

// GET /ledger/:applicationId/verify - public integrity check.
// Returns only validity metadata, never ledger payloads.
ledgerRouter.get('/:applicationId/verify', async (c) => {
  const applicationId = c.req.param('applicationId')!;
  const entries = await store.getLedger(applicationId);

  if (!entries || entries.length === 0) {
    return c.json(
      {
        valid: false,
        brokenAt: null,
        totalEntries: 0,
        message: `No ledger entries found for application '${applicationId}'`,
      },
      404
    );
  }

  const result = verifyLedgerChain(entries);
  return c.json(result);
});

// GET /ledger/:applicationId - retrieve the full cryptographic audit chain.
// Requires authentication and application-level scope.
ledgerRouter.get('/:applicationId', authMiddleware, async (c) => {
  const user = c.get('user');
  const applicationId = c.req.param('applicationId')!;
  const application = await store.getApplication(applicationId);

  if (!application) {
    return c.json({ error: `Application '${applicationId}' not found` }, 404);
  }
  if (!canReadApplication(user, application)) {
    return c.json({ error: 'Forbidden: Application is outside your scope' }, 403);
  }

  const entries = await store.getLedger(applicationId);
  return c.json(entries);
});

// POST /ledger/:applicationId/tamper - CHIEF-only evaluation helper.
// Mutates an entry without updating its hash so the verify endpoint can detect it.
ledgerRouter.post(
  '/:applicationId/tamper',
  authMiddleware,
  requireRole('CHIEF'),
  async (c) => {
    const applicationId = c.req.param('applicationId')!;
    const body = await c.req.json().catch(() => ({}));
    const index = typeof body.index === 'number' ? body.index : 0;

    const result = await store.tamperLedger(applicationId, index);
    if (!result.tampered) {
      return c.json(
        { error: `Application '${applicationId}' has no ledger entries to tamper` },
        404
      );
    }

    return c.json({
      success: true,
      message: `Tampered payload of block ${result.entryId}. The verify endpoint will now detect cryptographic discrepancy.`,
      entryId: result.entryId,
    });
  }
);
