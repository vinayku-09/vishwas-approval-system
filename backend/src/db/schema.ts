import { pgTable, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';

/**
 * Neon Postgres schema definition using Drizzle ORM
 */
export const applicationsTable = pgTable('applications', {
  id: text('id').primaryKey(),
  institutionName: text('institution_name').notNull(),
  type: text('type').notNull(), // NEW | EXTENSION_OF_APPROVAL | INTAKE_CHANGE
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  slaDueAt: timestamp('sla_due_at', { withTimezone: true }).notNull(),
  extracted: jsonb('extracted'), // { landAreaSqm, leaseEndDate, fireNocExpiry }
  deficiencies: jsonb('deficiencies').notNull().default('[]'),
});

export const ledgerTable = pgTable('ledger', {
  id: text('id').primaryKey(),
  applicationId: text('application_id').notNull(),
  eventType: text('event_type').notNull(),
  actor: text('actor').notNull(),
  payload: jsonb('payload').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  prevHash: text('prev_hash').notNull(),
  hash: text('hash').notNull(),
  index: integer('chain_index').notNull(),
});
