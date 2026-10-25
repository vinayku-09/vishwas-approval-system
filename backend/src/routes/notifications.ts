import { Hono } from 'hono';
import { store } from '../db/store.js';

export const notificationsRouter = new Hono();

// GET /notifications - list all in-app compliance & expiry notifications
notificationsRouter.get('/', async (c) => {
  const list = await store.listNotifications();
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
