import { serve } from '@hono/node-server';
import 'dotenv/config';
import { app } from './app.js';

const port = Number(process.env.PORT) || 4000;

console.log(`[AICTE Approval Backend] Running on http://localhost:${port}`);
console.log(`[AICTE Approval Backend] Healthcheck at http://localhost:${port}/health`);

serve({
  fetch: app.fetch,
  port,
});
