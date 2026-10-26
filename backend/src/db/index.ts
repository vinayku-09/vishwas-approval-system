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
    return store;
  }

  if (!postgresStore) {
    postgresStore = new PostgresStore(databaseUrl);
    setStore(postgresStore);
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
