import 'dotenv/config';
import { PostgresStore } from './postgresStore.js';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to seed Postgres.');
  }

  const store = new PostgresStore(databaseUrl);
  try {
    await store.seed();
    console.log('[seed] Seeded applications, users, inspections, ledger and notifications.');
  } finally {
    await store.close();
  }
}

main().catch((error: unknown) => {
  console.error('[seed] Failed:', error);
  process.exitCode = 1;
});
