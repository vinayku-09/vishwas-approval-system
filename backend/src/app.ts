import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { applicationsRouter } from './routes/applications.js';
import { documentsRouter } from './routes/documents.js';
import { cronRouter } from './routes/cron.js';
import { notificationsRouter } from './routes/notifications.js';
import { ledgerRouter } from './routes/ledger.js';
import { schedulingRouter } from './routes/scheduling.js';

export const app = new Hono();

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-role', 'x-actor'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
  })
);

// Liveness & healthcheck endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'vishwas-approval-backend',
    version: '1.2.0',
  });
});

// Mount modular subrouters
app.route('/applications', documentsRouter);
app.route('/applications', applicationsRouter);
app.route('/scheduling', schedulingRouter);
app.route('/', schedulingRouter); // Exposes GET /inspections
app.route('/cron', cronRouter);
app.route('/notifications', notificationsRouter);
app.route('/ledger', ledgerRouter);

// Global 404 handler
app.notFound((c) => {
  return c.json({ error: `Not found: ${c.req.method} ${c.req.url}` }, 404);
});

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled API Error:', err);
  return c.json(
    {
      error: err.message || 'Internal Server Error',
    },
    500
  );
});

export default app;
