import { InMemoryStore, setStore, store, type IStore } from './store.js';
import { PostgresStore } from './postgresStore.js';

let postgresStore: PostgresStore | undefined;

/**
 * Selects the repository implementation at process start.
 *
 * DATABASE_URL set   -> Drizzle/Neon Postgres store
 * DATABASE_URL unset -> zero-setup in-memory store
 */
export function initializeStore(): IStore {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    if (!(store instanceof InMemoryStore)) {
      setStore(new InMemoryStore());
    }
    console.log('[AICTE Approval Backend] Store: IN-MEMORY (DATABASE_URL not set)');
    return store;
  }

  if (!postgresStore) {
    postgresStore = new PostgresStore(databaseUrl);
    setStore(postgresStore);
    console.log('[AICTE Approval Backend] Store: POSTGRES (DATABASE_URL configured)');
  }
  return store;
}

export function getPostgresStore(): PostgresStore | undefined {
  return postgresStore;
}

export async function closeStore(): Promise<void> {
  if (postgresStore) {
    await postgresStore.close();
    postgresStore = undefined;
  }
}
