/**
 * dashboards.ts - Routes for pendency dashboards and EVC board
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { buildPendencyDashboard, buildEvcBoard } from '../services/dashboards.js';
import type { PendencyStatus } from '../config/sla-config.js';

export const dashboardsRouter = new Hono();

dashboardsRouter.use('*', authMiddleware);

const PENDENCY_STATUSES: PendencyStatus[] = ['On time', 'Approaching', 'Overdue'];

function parsePendencyStatus(value?: string): PendencyStatus | undefined {
  if (!value) return undefined;
  return PENDENCY_STATUSES.includes(value as PendencyStatus) ? (value as PendencyStatus) : undefined;
}

dashboardsRouter.get('/pendency', async (c) => {
  const user = c.get('user');
  const region = c.req.query('region') || undefined;
  const status = parsePendencyStatus(c.req.query('status') || undefined);
  const stage = c.req.query('stage') || undefined;
  const officerId = c.req.query('officerId') || undefined;

  try {
    const dashboard = await buildPendencyDashboard(user, {
      region,
      status,
      stage,
      officerId,
    });
    return c.json(dashboard);
  } catch (err) {
    console.error('Error building pendency dashboard:', err);
    return c.json({ error: 'Failed to build pendency dashboard' }, 500);
  }
});

dashboardsRouter.get('/evc-board', async (c) => {
  const user = c.get('user');
  const region = c.req.query('region') || undefined;
  try {
    const board = await buildEvcBoard(user, { region });
    return c.json(board);
  } catch (err) {
    console.error('Error building EVC board:', err);
    return c.json({ error: 'Failed to build EVC board' }, 500);
  }
});

export default dashboardsRouter;
