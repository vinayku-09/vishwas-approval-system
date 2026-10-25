import { pgTable, text, timestamp, jsonb, integer, boolean, doublePrecision } from 'drizzle-orm/pg-core';

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
  extracted: jsonb('extracted'),
  extractedDetails: jsonb('extracted_details'),
  deficiencies: jsonb('deficiencies').notNull().default('[]'),
  signoff: jsonb('signoff'),
  locked: boolean('locked').notNull().default(false),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  domain: text('domain'), // CIVIL | CSE | ELECTRICAL | MECHANICAL
  scheduledInspection: jsonb('scheduled_inspection'),
});

export const inspectorsTable = pgTable('inspectors', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  domain: text('domain').notNull(), // CIVIL | CSE | ELECTRICAL | MECHANICAL
  homeCity: text('home_city').notNull(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  availableDates: jsonb('available_dates').notNull().default('[]'),
});

export const affiliationsTable = pgTable('affiliations', {
  id: text('id').primaryKey(),
  inspectorId: text('inspector_id').notNull(),
  institutionName: text('institution_name').notNull(),
  reason: text('reason').notNull(),
});

export const inspectionsTable = pgTable('inspections', {
  id: text('id').primaryKey(),
  applicationId: text('application_id').notNull(),
  institutionName: text('institution_name').notNull(),
  domain: text('domain').notNull(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  scheduledDate: text('scheduled_date').notNull(),
  inspectors: jsonb('inspectors').notNull(),
  status: text('status').notNull(), // SCHEDULED | COMPLETED
  report: jsonb('report'),
  source: text('source').notNull().default('fallback'), // ortools | fallback | manual
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const documentsTable = pgTable('documents', {
  id: text('id').primaryKey(),
  applicationId: text('application_id').notNull(),
  docType: text('doc_type').notNull(), // LEASE_DEED | FIRE_NOC | LAND_RECORD
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  sha256: text('sha256').notNull(),
  storageUrl: text('storage_url').notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
});

export const complianceDocumentsTable = pgTable('compliance_documents', {
  id: text('id').primaryKey(),
  applicationId: text('application_id').notNull(),
  docType: text('doc_type').notNull(),
  expiryDate: text('expiry_date').notNull(),
  state: text('state').notNull(), // VALID | WARNING | OVERDUE
  tier: integer('tier'), // 90 | 60 | 30
  daysRemaining: integer('days_remaining').notNull(),
  lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notificationsTable = pgTable('notifications', {
  id: text('id').primaryKey(),
  applicationId: text('application_id').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // WARNING | OVERDUE | INFO
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
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
