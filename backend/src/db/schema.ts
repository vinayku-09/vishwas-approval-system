import {
  pgTable,
  text,
  jsonb,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import type {
  Affiliation,
  AlertLog,
  Application,
  ComplianceDocument,
  DocumentMetadata,
  Escalation,
  InspectionAssignment,
  Inspector,
  LedgerEntry,
  Notification,
  SignoffRecord,
  Undertaking,
  UndertakingEvidence,
  UndertakingVerification,
  User,
  CourseProposal,
  ProposedBranch,
  StoredFileRecord,
} from '../types.js';

/**
 * Neon Postgres schema for the application repository.
 *
 * Each entity table keeps the columns used for filtering/ordering and a JSONB
 * `data` payload that is the canonical domain object. This keeps the existing
 * TypeScript domain contracts as the single source of truth while still giving
 * every collection a real, queryable Postgres table. Mutation-critical keys
 * (notification idempotency key, alert-log idempotency key, user email) have
 * database-level unique constraints so concurrent cron runs cannot duplicate.
 */

export const applicationsTable = pgTable(
  'applications',
  {
    id: text('id').primaryKey(),
    status: text('status').notNull(),
    type: text('type').notNull(),
    createdAt: text('created_at').notNull(),
    data: jsonb('data').$type<Application>().notNull(),
  },
  (table) => [index('applications_status_idx').on(table.status)]
);

export const documentsTable = pgTable(
  'documents',
  {
    id: text('id').primaryKey(),
    applicationId: text('application_id').notNull(),
    data: jsonb('data').$type<DocumentMetadata>().notNull(),
  },
  (table) => [index('documents_application_idx').on(table.applicationId)]
);

export const complianceDocumentsTable = pgTable(
  'compliance_documents',
  {
    id: text('id').primaryKey(),
    applicationId: text('application_id').notNull(),
    data: jsonb('data').$type<ComplianceDocument>().notNull(),
  },
  (table) => [index('compliance_documents_application_idx').on(table.applicationId)]
);

export const notificationsTable = pgTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    applicationId: text('application_id').notNull(),
    createdAt: text('created_at').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    recipientRole: text('recipient_role'),
    region: text('region'),
    institutionName: text('institution_name'),
    data: jsonb('data').$type<Notification>().notNull(),
  },
  (table) => [
    uniqueIndex('notifications_idempotency_key_uq').on(table.idempotencyKey),
    index('notifications_created_at_idx').on(table.createdAt),
  ]
);

export const alertLogsTable = pgTable(
  'alert_logs',
  {
    id: text('id').primaryKey(),
    idempotencyKey: text('idempotency_key').notNull(),
    applicationId: text('application_id').notNull(),
    createdAt: text('created_at').notNull(),
    data: jsonb('data').$type<AlertLog>().notNull(),
  },
  (table) => [
    uniqueIndex('alert_logs_idempotency_key_uq').on(table.idempotencyKey),
    index('alert_logs_application_idx').on(table.applicationId),
  ]
);

export const escalationsTable = pgTable(
  'escalations',
  {
    id: text('id').primaryKey(),
    applicationId: text('application_id').notNull(),
    eventType: text('event_type').notNull(),
    status: text('status').notNull(),
    region: text('region').notNull(),
    createdAt: text('created_at').notNull(),
    data: jsonb('data').$type<Escalation>().notNull(),
  },
  (table) => [
    index('escalations_status_idx').on(table.status),
    index('escalations_region_idx').on(table.region),
  ]
);

export const signoffsTable = pgTable('signoffs', {
  applicationId: text('application_id').primaryKey(),
  data: jsonb('data').$type<SignoffRecord>().notNull(),
});

export const ledgerTable = pgTable(
  'ledger',
  {
    id: text('id').primaryKey(),
    applicationId: text('application_id').notNull(),
    chainIndex: integer('chain_index').notNull(),
    data: jsonb('data').$type<LedgerEntry>().notNull(),
  },
  (table) => [
    uniqueIndex('ledger_application_index_uq').on(table.applicationId, table.chainIndex),
    index('ledger_application_idx').on(table.applicationId),
  ]
);

export const inspectorsTable = pgTable(
  'inspectors',
  {
    id: text('id').primaryKey(),
    domain: text('domain').notNull(),
    data: jsonb('data').$type<Inspector>().notNull(),
  },
  (table) => [index('inspectors_domain_idx').on(table.domain)]
);

export const affiliationsTable = pgTable(
  'affiliations',
  {
    id: text('id').primaryKey(),
    inspectorId: text('inspector_id').notNull(),
    data: jsonb('data').$type<Affiliation>().notNull(),
  },
  (table) => [index('affiliations_inspector_idx').on(table.inspectorId)]
);

export const inspectionsTable = pgTable(
  'inspections',
  {
    id: text('id').primaryKey(),
    applicationId: text('application_id').notNull(),
    data: jsonb('data').$type<InspectionAssignment>().notNull(),
  },
  (table) => [index('inspections_application_idx').on(table.applicationId)]
);

export const usersTable = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    role: text('role').notNull(),
    data: jsonb('data').$type<User>().notNull(),
  },
  (table) => [
    uniqueIndex('users_email_uq').on(table.email),
    index('users_role_idx').on(table.role),
  ]
);

export const undertakingsTable = pgTable(
  'undertakings',
  {
    id: text('id').primaryKey(),
    applicationId: text('application_id').notNull(),
    status: text('status').notNull(),
    dueDate: text('due_date').notNull(),
    data: jsonb('data').$type<Undertaking>().notNull(),
  },
  (table) => [
    index('undertakings_application_idx').on(table.applicationId),
    index('undertakings_status_idx').on(table.status),
  ]
);

export const evidenceTable = pgTable(
  'evidence',
  {
    id: text('id').primaryKey(),
    undertakingId: text('undertaking_id').notNull(),
    data: jsonb('data').$type<UndertakingEvidence>().notNull(),
  },
  (table) => [index('evidence_undertaking_idx').on(table.undertakingId)]
);

export const verificationsTable = pgTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    undertakingId: text('undertaking_id').notNull(),
    data: jsonb('data').$type<UndertakingVerification>().notNull(),
  },
  (table) => [index('verifications_undertaking_idx').on(table.undertakingId)]
);

export const courseProposalsTable = pgTable(
  'course_proposals',
  {
    id: text('id').primaryKey(),
    institutionId: text('institution_id').notNull(),
    applicationId: text('application_id').notNull(),
    type: text('type').notNull(),
    status: text('status').notNull(),
    data: jsonb('data').$type<CourseProposal>().notNull(),
  },
  (table) => [
    index('course_proposals_institution_idx').on(table.institutionId),
    index('course_proposals_application_idx').on(table.applicationId),
    index('course_proposals_status_idx').on(table.status),
  ]
);

export const proposedBranchesTable = pgTable(
  'proposed_branches',
  {
    id: text('id').primaryKey(),
    proposalId: text('proposal_id').notNull(),
    data: jsonb('data').$type<ProposedBranch>().notNull(),
  },
  (table) => [index('proposed_branches_proposal_idx').on(table.proposalId)]
);

export const storedFilesTable = pgTable(
  'stored_files',
  {
    id: text('id').primaryKey(),
    pathname: text('pathname').notNull(),
    sha256: text('sha256').notNull(),
    size: integer('size').notNull(),
    contentType: text('content_type').notNull(),
    institutionId: text('institution_id').notNull(),
    region: text('region').notNull(),
    isDraft: integer('is_draft').notNull().default(1),
    uploadedAt: text('uploaded_at').notNull(),
    data: jsonb('data').$type<StoredFileRecord>().notNull(),
  },
  (table) => [
    index('stored_files_institution_idx').on(table.institutionId),
    index('stored_files_region_idx').on(table.region),
    index('stored_files_sha256_idx').on(table.sha256),
    index('stored_files_pathname_idx').on(table.pathname),
  ]
);


