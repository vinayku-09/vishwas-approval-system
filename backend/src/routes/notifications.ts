import { Hono } from 'hono';
import { store } from '../db/store.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';

export const notificationsRouter = new Hono();

notificationsRouter.use('*', optionalAuthMiddleware);

// GET /notifications - list in-app notifications scoped to the caller.
//
// Institutions only see their own alerts; regional officers see their region;
// CHIEF / region ALL see everything. Unauthenticated callers (demo/legacy UI)
// receive the full list for backward compatibility.
notificationsRouter.get('/', async (c) => {
  const user = c.get('user');
  let list = await store.listNotifications();

  if (user?.role === 'INSTITUTION' && user.institutionName) {
    list = list.filter(
      (n) => !n.institutionName || n.institutionName === user.institutionName
    );
  } else if (
    user?.role !== 'CHIEF' &&
    user?.region &&
    user.region !== 'ALL'
  ) {
    list = list.filter(
      (n) => !n.region || n.region === user.region || n.region === 'ALL'
    );
  }

  return c.json(list);
});

// POST /notifications/:id/read - mark notification as read
notificationsRouter.post('/:id/read', async (c) => {
  const id = c.req.param('id');
  const success = await store.markNotificationRead(id);
  if (!success) {
    return c.json({ error: `Notification '${id}' not found` }, 404);
  }
  return c.json({ success: true, id });
});
