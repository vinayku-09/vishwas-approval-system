import { Hono } from 'hono';
import { store } from '../db/store.js';
import { verifyLedgerChain } from '../services/ledger.js';

export const ledgerRouter = new Hono();

// GET /ledger/:applicationId - retrieve full cryptographic audit chain
ledgerRouter.get('/:applicationId', async (c) => {
  const applicationId = c.req.param('applicationId');
  const entries = await store.getLedger(applicationId);
  return c.json(entries);
});

// GET /ledger/:applicationId/verify - recompute and verify entire SHA-256 hash chain
ledgerRouter.get('/:applicationId/verify', async (c) => {
  const applicationId = c.req.param('applicationId');
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

// POST /ledger/:applicationId/tamper - test helper to mutate an entry without updating its hash
ledgerRouter.post('/:applicationId/tamper', async (c) => {
  const applicationId = c.req.param('applicationId');
  const body = await c.req.json().catch(() => ({}));
  const index = typeof body.index === 'number' ? body.index : 0;

  const result = await store.tamperLedger(applicationId, index);
  if (!result.tampered) {
    return c.json({ error: `Application '${applicationId}' has no ledger entries to tamper` }, 404);
  }

  return c.json({
    success: true,
    message: `Tampered payload of block ${result.entryId}. The verify endpoint will now detect cryptographic discrepancy.`,
    entryId: result.entryId,
  });
});
