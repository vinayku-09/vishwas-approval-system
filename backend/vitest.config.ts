import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Environment variables for the test suite:
    //  - ALLOW_DEMO_HEADER_ROLE: lets existing x-role header tests bypass JWT check (preserves
    //    pre-Phase-B test compatibility; production default is 'false').
    //  - NODE_ENV=test: activates the JWT dev-fallback secret from config/timelines.ts so
    //    auth tests work without a JWT_SECRET env var configured.
    env: {
      ALLOW_DEMO_HEADER_ROLE: 'true',
      NODE_ENV: 'test',
    },
  },
});
