import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { applicationsRouter } from './routes/applications.js';
import { ledgerRouter } from './routes/ledger.js';

export const app = new Hono();

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-role'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
  })
);

// Liveness & healthcheck endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'aicte-approval-backend',
    version: '1.0.0',
  });
});

// Mount modular subrouters
app.route('/applications', applicationsRouter);
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
