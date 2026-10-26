import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from './schema.js';

type Db = NodePgDatabase<typeof schema>;

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'drizzle');

/** Splits a drizzle-kit SQL migration into executable statements. */
export function splitMigrationSql(source: string): string[] {
  return source
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

/** Applies every generated SQL migration directly (used by pg-mem tests). */
export async function applyMigrations(db: Db): Promise<void> {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const source = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    for (const statement of splitMigrationSql(source)) {
      await db.execute(sql.raw(statement));
    }
  }
}
