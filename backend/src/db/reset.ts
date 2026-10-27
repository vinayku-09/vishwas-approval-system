import 'dotenv/config';
import { PostgresStore } from './postgresStore.js';

export async function resetDatabaseSafely(): Promise<void> {
  if (process.env.ALLOW_DB_RESET !== 'true') {
    throw new Error(
      'Database reset refused: ALLOW_DB_RESET=true must be explicitly set to reset database tables.'
    );
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to reset Postgres.');
  }

  const store = new PostgresStore(databaseUrl);
  try {
    await store.resetDatabase();
    console.log('[reset] Database reset completed successfully.');
  } finally {
    await store.close();
  }
}

// If executed directly from CLI:
if (process.argv[1]?.endsWith('reset.ts') || process.argv[1]?.endsWith('reset.js')) {
  resetDatabaseSafely()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[reset] Refused:', err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
