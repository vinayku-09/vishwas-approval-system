import { Hono } from 'hono';
import { store } from '../db/store.js';
import { authMiddleware } from '../middleware/auth.js';
import type { Notification } from '../types.js';

export const notificationsRouter = new Hono();

notificationsRouter.use('*', authMiddleware);

/** Returns only notifications the authenticated principal may see. */
function visibleToUser(notification: Notification, user: {
  role: string;
  region?: string;
  institutionName?: string;
}): boolean {
  if (user.role === 'CHIEF') return true;

  if (user.role === 'INSTITUTION') {
    return (
      !notification.institutionName ||
      notification.institutionName === user.institutionName
    );
  }

  if (user.region && user.region !== 'ALL') {
    return (
      !notification.region ||
      notification.region === 'ALL' ||
      notification.region === user.region
    );
  }

  return true;
}

// GET /notifications - list in-app notifications scoped to the caller.
//
// Institutions only see their own alerts; regional officers/committee members
// see their region; CHIEF (or region ALL) sees everything. Unauthenticated
// callers receive 401.
notificationsRouter.get('/', async (c) => {
  const user = c.get('user');
  const list = (await store.listNotifications()).filter((notification) =>
    visibleToUser(notification, user)
  );
  return c.json(list);
});

// POST /notifications/:id/read - mark a visible notification as read
notificationsRouter.post('/:id/read', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const notification = (await store.listNotifications()).find((item) => item.id === id);

  if (!notification) {
    return c.json({ error: `Notification '${id}' not found` }, 404);
  }
  if (!visibleToUser(notification, user)) {
    return c.json({ error: 'Forbidden: notification belongs to another scope' }, 403);
  }

  const success = await store.markNotificationRead(id);
  if (!success) {
    return c.json({ error: `Notification '${id}' not found` }, 404);
  }
  return c.json({ success: true, id });
});
