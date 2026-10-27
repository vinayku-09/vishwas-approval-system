/**
 * One-time idempotent migration script.
 * Creates course_proposals, proposed_branches, stored_files tables
 * using CREATE TABLE IF NOT EXISTS so it can be re-run safely.
 *
 * Usage: npx tsx src/db/migrate_missing.ts
 */

import 'dotenv/config';
import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set. Exiting.');
  process.exit(1);
}

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sql = `
  CREATE TABLE IF NOT EXISTS "course_proposals" (
    "id" text PRIMARY KEY NOT NULL,
    "institution_id" text NOT NULL,
    "application_id" text NOT NULL,
    "type" text NOT NULL,
    "status" text NOT NULL,
    "data" jsonb NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "proposed_branches" (
    "id" text PRIMARY KEY NOT NULL,
    "proposal_id" text NOT NULL,
    "data" jsonb NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "stored_files" (
    "id" text PRIMARY KEY NOT NULL,
    "pathname" text NOT NULL,
    "sha256" text NOT NULL,
    "size" integer NOT NULL,
    "content_type" text NOT NULL,
    "institution_id" text NOT NULL,
    "region" text NOT NULL,
    "is_draft" integer DEFAULT 1 NOT NULL,
    "uploaded_at" text NOT NULL,
    "data" jsonb NOT NULL
  );

  CREATE INDEX IF NOT EXISTS "course_proposals_institution_idx" ON "course_proposals" ("institution_id");
  CREATE INDEX IF NOT EXISTS "course_proposals_application_idx" ON "course_proposals" ("application_id");
  CREATE INDEX IF NOT EXISTS "course_proposals_status_idx" ON "course_proposals" ("status");
  CREATE INDEX IF NOT EXISTS "proposed_branches_proposal_idx" ON "proposed_branches" ("proposal_id");
  CREATE INDEX IF NOT EXISTS "stored_files_institution_idx" ON "stored_files" ("institution_id");
  CREATE INDEX IF NOT EXISTS "stored_files_region_idx" ON "stored_files" ("region");
  CREATE INDEX IF NOT EXISTS "stored_files_sha256_idx" ON "stored_files" ("sha256");
  CREATE INDEX IF NOT EXISTS "stored_files_pathname_idx" ON "stored_files" ("pathname");
`;

async function run() {
  await client.connect();
  console.log('[migrate_missing] Connected to Postgres');
  await client.query(sql);
  console.log('[migrate_missing] Tables created (idempotent — safe to re-run)');
  await client.end();
}

run().catch((err) => {
  console.error('[migrate_missing] Error:', err.message);
  process.exit(1);
});
