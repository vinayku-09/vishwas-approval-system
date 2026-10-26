import { Hono } from 'hono';
import { z } from 'zod';
import { store } from '../db/store.js';
import { optimizeEvcSchedule } from '../services/scheduler.js';
import { optionalAuthMiddleware, resolveActorRole } from '../middleware/auth.js';

export const schedulingRouter = new Hono();

const optimizeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  applicationIds: z.array(z.string()).optional(),
});

// POST /scheduling/optimize - Runs route optimization for EVC_REQUIRED applications (Officer role)
schedulingRouter.post('/optimize', optionalAuthMiddleware, async (c) => {
  const role = resolveActorRole(c, 'institution');
  if (role !== 'officer') {
    return c.json({ error: 'Forbidden: EVC scheduling optimization requires officer role' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = optimizeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.errors.map((e) => e.message).join(', ') }, 400);
  }

  const result = await optimizeEvcSchedule({
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    applicationIds: parsed.data.applicationIds,
  });

  return c.json(result);
});

// GET /inspections - Lists scheduled or completed inspections (Committee / Officer role)
schedulingRouter.get('/inspections', async (c) => {
  const inspectorId = c.req.query('inspectorId');
  const inspections = await store.getInspections(inspectorId || undefined);
  return c.json(inspections);
});
