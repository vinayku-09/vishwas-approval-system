import { newDb } from 'pg-mem';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../db/schema.js';
import { applyMigrations } from '../../db/migrate.js';
import { PostgresStore } from '../../db/postgresStore.js';

type MemQueryConfig = {
  text: string;
  values?: unknown[];
  types?: unknown;
  rowMode?: string;
  [key: string]: unknown;
};

type MemQueryResult = {
  rows: unknown[];
  [key: string]: unknown;
};

type MemPool = {
  query: (query: string | MemQueryConfig, ...args: unknown[]) => Promise<MemQueryResult>;
  end: () => Promise<void>;
};

export interface TestDatabase {
  store: PostgresStore;
  kind: 'pg-mem' | 'postgres';
  close: () => Promise<void>;
}

/**
 * pg-mem does not implement the node-postgres `rowMode`/`getTypeParser`
 * options that Drizzle uses, so translate array rows back into the shape
 * Drizzle expects while keeping the rest of the adapter intact.
 */
function wrapPgMemPool(pool: MemPool): void {
  const originalQuery = pool.query.bind(pool);

  pool.query = async (query, ...args) => {
    if (query && typeof query === 'object') {
      const { types: _types, rowMode, ...rest } = query;
      const result = await originalQuery(rest, ...args);

      if (rowMode === 'array') {
        const objectRows = result.rows as Array<Record<string, unknown>>;
        const keys = objectRows.length > 0 ? Object.keys(objectRows[0]) : [];
        return {
          ...result,
          rows: objectRows.map((row) => keys.map((key) => row[key])),
        };
      }

      return result;
    }

    return originalQuery(query, ...args);
  };
}

/**
 * Runs the same migration and store code against a real Postgres instance when
 * TEST_DATABASE_URL is provided. Otherwise uses pg-mem so the suite remains
 * self-contained.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const databaseUrl = process.env.TEST_DATABASE_URL?.trim();

  if (databaseUrl) {
    const pool = new Pool({ connectionString: databaseUrl, max: 2 });
    await pool.query('drop schema if exists public cascade');
    await pool.query('create schema public');
    const db = drizzle(pool, { schema });
    await applyMigrations(db);
    return {
      store: new PostgresStore(pool),
      kind: 'postgres',
      close: () => pool.end(),
    };
  }

  const memory = newDb();
  const adapter = memory.adapters.createPg();
  const memPool = new adapter.Pool() as MemPool;
  wrapPgMemPool(memPool);

  const pool = memPool as unknown as Pool;
  const db = drizzle(pool, { schema });
  await applyMigrations(db);

  return {
    store: new PostgresStore(pool),
    kind: 'pg-mem',
    close: () => pool.end(),
  };
}
