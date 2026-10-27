import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { applicationsRouter } from './routes/applications.js';
import { documentsRouter } from './routes/documents.js';
import { cronRouter } from './routes/cron.js';
import { notificationsRouter } from './routes/notifications.js';
import { ledgerRouter } from './routes/ledger.js';
import { schedulingRouter } from './routes/scheduling.js';
import { authRouter } from './routes/auth.js';
import { escalationsRouter } from './routes/escalations.js';
import { dashboardsRouter } from './routes/dashboards.js';
import { undertakingsRouter, complianceRouter, officerQueueRouter } from './routes/undertakings.js';
import { reportsRouter } from './routes/reports.js';
import { configRouter } from './routes/config.js';
import { profileRouter } from './routes/profile.js';
import { proposalsRouter } from './routes/proposals.js';
import { filesRouter } from './routes/files.js';
import { getMailHealth } from './services/mailer.js';
import { initializeStore } from './db/index.js';

// Select Postgres when DATABASE_URL is configured; otherwise use the in-memory
// repository seeded with demo records.
initializeStore();

export const app = new Hono();

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-role', 'x-actor', 'x-region'],
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
    version: '1.4.0',
    mail: getMailHealth(),
  });
});

// Mount modular subrouters
app.route('/auth', authRouter);
app.route('/applications', documentsRouter);
app.route('/applications', applicationsRouter);
app.route('/scheduling', schedulingRouter);
app.route('/', schedulingRouter); // Exposes GET /inspections
app.route('/cron', cronRouter);
app.route('/notifications', notificationsRouter);
app.route('/escalations', escalationsRouter);
app.route('/ledger', ledgerRouter);
app.route('/dashboards', dashboardsRouter);
app.route('/undertakings', undertakingsRouter);
app.route('/compliance', complianceRouter);
app.route('/officer/verification-queue', officerQueueRouter);
app.route('/reports', reportsRouter);
app.route('/config', configRouter);
app.route('/institution/profile', profileRouter);
app.route('/', profileRouter);
app.route('/proposals', proposalsRouter);
app.route('/files', filesRouter);

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
