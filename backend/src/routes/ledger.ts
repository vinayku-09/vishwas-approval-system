import { Hono } from 'hono';
import { store } from '../db/store.js';
import { verifyLedgerChain } from '../services/ledger.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { canReadApplication } from '../services/access.js';

export const ledgerRouter = new Hono();

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
