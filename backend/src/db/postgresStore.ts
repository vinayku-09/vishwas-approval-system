import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import {
  Affiliation,
  AlertEventType,
  AlertLog,
  Application,
  ApplicationType,
  ComplianceDocument,
  DocumentMetadata,
  Domain,
  Escalation,
  EscalationStatus,
  EvcReport,
  ExtractedFields,
  InspectionAssignment,
  Inspector,
  LedgerEntry,
  Notification,
  Region,
  SignoffRecord,
  Status,
  Undertaking,
  UndertakingEvidence,
  UndertakingStatus,
  UndertakingVerification,
  User,
  InstitutionProfile,
  ProfileStatus,
  RegistrationOtp,
} from '../types.js';
import { createLedgerEntry, GENESIS_HASH } from '../services/ledger.js';
import { SLA_WINDOW_DAYS_NEW } from '../config/timelines.js';
import { DEFAULT_UNDERTAKING_DURATION_DAYS } from '../config/undertakings.js';
import { InMemoryStore, type IStore } from './store.js';
import * as schema from './schema.js';

type Db = NodePgDatabase<typeof schema>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function chunk<T>(items: T[], size = 500): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

/**
 * Drizzle/Neon Postgres implementation of the repository contract.
 *
 * All domain objects are stored in JSONB payload columns; the additional
 * relational columns exist for filtering, ordering and database-enforced
 * idempotency. The in-memory store remains the zero-setup fallback.
 */
export class PostgresStore implements IStore {
  private readonly pool: Pool;
  private readonly db: Db;
  private otps: Map<string, RegistrationOtp> = new Map();
  private profiles: Map<string, InstitutionProfile> = new Map();

  constructor(connection: string | Pool) {
    this.pool =
      typeof connection === 'string'
        ? new Pool({ connectionString: connection, max: 5 })
        : connection;
    this.db = drizzle(this.pool, { schema });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private applicationRow(app: Application) {
    return {
      id: app.id,
      status: app.status,
      type: app.type,
      createdAt: app.createdAt,
      data: app,
    };
  }

  private notificationRow(notification: Notification) {
    return {
      id: notification.id,
      applicationId: notification.applicationId,
      createdAt: notification.createdAt,
      idempotencyKey: notification.idempotencyKey,
      recipientRole: notification.recipientRole ?? null,
      region: notification.region ?? null,
      institutionName: notification.institutionName ?? null,
      data: notification,
    };
  }

  private alertLogRow(log: AlertLog) {
    return {
      id: log.id,
      idempotencyKey: log.id,
      applicationId: log.applicationId,
      createdAt: log.createdAt,
      data: log,
    };
  }

  private escalationRow(escalation: Escalation) {
    return {
      id: escalation.id,
      applicationId: escalation.applicationId,
      eventType: escalation.eventType,
      status: escalation.status,
      region: escalation.region,
      createdAt: escalation.createdAt,
      data: escalation,
    };
  }

  private undertakingRow(u: Undertaking) {
    return {
      id: u.id,
      applicationId: u.applicationId,
      status: u.status,
      dueDate: u.dueDate,
      data: u,
    };
  }

  private evidenceRow(e: UndertakingEvidence) {
    return {
      id: e.id,
      undertakingId: e.undertakingId,
      data: e,
    };
  }

  private verificationRow(v: UndertakingVerification) {
    return {
      id: v.id,
      undertakingId: v.undertakingId,
      data: v,
    };
  }

  async listApplications(filters?: {
    status?: Status;
    type?: ApplicationType;
  }): Promise<Application[]> {
    const conditions: SQL[] = [];
    if (filters?.status) conditions.push(eq(schema.applicationsTable.status, filters.status));
    if (filters?.type) conditions.push(eq(schema.applicationsTable.type, filters.type));

    const rows = await this.db
      .select({ data: schema.applicationsTable.data })
      .from(schema.applicationsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(schema.applicationsTable.createdAt));

    return rows.map((row) => clone(row.data));
  }

  async getApplication(id: string): Promise<Application | null> {
    const rows = await this.db
      .select({ data: schema.applicationsTable.data })
      .from(schema.applicationsTable)
      .where(eq(schema.applicationsTable.id, id))
      .limit(1);
    return rows[0] ? clone(rows[0].data) : null;
  }

  async createApplication(data: {
    institutionName: string;
    type: ApplicationType;
    extracted?: ExtractedFields;
    actor?: string;
    lat?: number;
    lng?: number;
    domain?: Domain;
  }): Promise<Application> {
    const countRows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.applicationsTable);
    const nextSeq = (countRows[0]?.count ?? 0) + 1;
    const year = new Date().getFullYear();
    const id = `APP-${year}-${String(nextSeq).padStart(3, '0')}`;

    const now = new Date();
    const createdAt = now.toISOString();
    const slaDue = new Date(now.getTime() + SLA_WINDOW_DAYS_NEW * 24 * 60 * 60 * 1000);
    const slaDueAt = slaDue.toISOString();

    const application: Application = {
      id,
      institutionName: data.institutionName,
      type: data.type,
      status: 'SUBMITTED',
      createdAt,
      slaDueAt,
      extracted: data.extracted || {},
      deficiencies: [],
      locked: false,
      lat: data.lat || 19.076,
      lng: data.lng || 72.877,
      domain: data.domain || 'CSE',
      region: 'ALL',
    };

    await this.db.insert(schema.applicationsTable).values(this.applicationRow(application));
    await this.recordLedger(id, 'APPLICATION_CREATED', data.actor || 'institution', {
      institutionName: application.institutionName,
      type: application.type,
      status: application.status,
      slaDueAt: application.slaDueAt,
      domain: application.domain,
      lat: application.lat,
      lng: application.lng,
    });

    return clone(application);
  }

  async updateApplication(
    id: string,
    updates: Partial<Application>
  ): Promise<Application | null> {
    const app = await this.getApplication(id);
    if (!app) return null;

    const updated: Application = {
      ...app,
      ...updates,
      extracted: updates.extracted ? { ...app.extracted, ...updates.extracted } : app.extracted,
      extractedDetails: updates.extractedDetails ?? app.extractedDetails,
      deficiencies: updates.deficiencies ?? app.deficiencies,
      signoff: updates.signoff ?? app.signoff,
      locked: updates.locked !== undefined ? updates.locked : app.locked,
      lat: updates.lat !== undefined ? updates.lat : app.lat,
      lng: updates.lng !== undefined ? updates.lng : app.lng,
      domain: updates.domain ?? app.domain,
      scheduledInspection: updates.scheduledInspection ?? app.scheduledInspection,
    };

    await this.db
      .update(schema.applicationsTable)
      .set(this.applicationRow(updated))
      .where(eq(schema.applicationsTable.id, id));

    return clone(updated);
  }

  async saveDocument(doc: DocumentMetadata): Promise<DocumentMetadata> {
    await this.db
      .insert(schema.documentsTable)
      .values({ id: doc.id, applicationId: doc.applicationId, data: doc })
      .onConflictDoUpdate({
        target: schema.documentsTable.id,
        set: { applicationId: doc.applicationId, data: doc },
      });
    return clone(doc);
  }

  async getDocuments(applicationId: string): Promise<DocumentMetadata[]> {
    const rows = await this.db
      .select({ data: schema.documentsTable.data })
      .from(schema.documentsTable)
      .where(eq(schema.documentsTable.applicationId, applicationId))
      .orderBy(asc(schema.documentsTable.id));
    return rows.map((row) => clone(row.data));
  }

  async saveComplianceDocument(doc: ComplianceDocument): Promise<ComplianceDocument> {
    await this.db
      .insert(schema.complianceDocumentsTable)
      .values({ id: doc.id, applicationId: doc.applicationId, data: doc })
      .onConflictDoUpdate({
        target: schema.complianceDocumentsTable.id,
        set: { applicationId: doc.applicationId, data: doc },
      });
    return clone(doc);
  }

  async getComplianceDocuments(applicationId?: string): Promise<ComplianceDocument[]> {
    const rows = await this.db
      .select({ data: schema.complianceDocumentsTable.data })
      .from(schema.complianceDocumentsTable)
      .where(
        applicationId
          ? eq(schema.complianceDocumentsTable.applicationId, applicationId)
          : undefined
      )
      .orderBy(asc(schema.complianceDocumentsTable.id));
    return rows.map((row) => clone(row.data));
  }

  async addNotification(
    notification: Notification
  ): Promise<{ created: boolean; notification: Notification }> {
    const inserted = await this.db
      .insert(schema.notificationsTable)
      .values(this.notificationRow(notification))
      .onConflictDoNothing()
      .returning({ data: schema.notificationsTable.data });

    if (inserted[0]) {
      return { created: true, notification: clone(inserted[0].data) };
    }

    const existing = await this.findNotificationByKey(notification.idempotencyKey);
    return {
      created: false,
      notification: existing ?? clone(notification),
    };
  }

  private async findNotificationByKey(key: string): Promise<Notification | null> {
    const rows = await this.db
      .select({ data: schema.notificationsTable.data })
      .from(schema.notificationsTable)
      .where(eq(schema.notificationsTable.idempotencyKey, key))
      .limit(1);
    return rows[0] ? clone(rows[0].data) : null;
  }

  async listNotifications(): Promise<Notification[]> {
    const rows = await this.db
      .select({ data: schema.notificationsTable.data })
      .from(schema.notificationsTable)
      .orderBy(desc(schema.notificationsTable.createdAt));
    return rows.map((row) => clone(row.data));
  }

  async markNotificationRead(id: string): Promise<boolean> {
    const rows = await this.db
      .select({ data: schema.notificationsTable.data })
      .from(schema.notificationsTable)
      .where(eq(schema.notificationsTable.id, id))
      .limit(1);
    if (!rows[0]) return false;

    const notification: Notification = { ...rows[0].data, read: true };
    await this.db
      .update(schema.notificationsTable)
      .set({ data: notification })
      .where(eq(schema.notificationsTable.id, id));
    return true;
  }

  async listAlertLogs(): Promise<AlertLog[]> {
    const rows = await this.db
      .select({ data: schema.alertLogsTable.data })
      .from(schema.alertLogsTable)
      .orderBy(desc(schema.alertLogsTable.createdAt));
    return rows.map((row) => clone(row.data));
  }

  async getAlertLog(id: string): Promise<AlertLog | null> {
    const rows = await this.db
      .select({ data: schema.alertLogsTable.data })
      .from(schema.alertLogsTable)
      .where(eq(schema.alertLogsTable.id, id))
      .limit(1);
    return rows[0] ? clone(rows[0].data) : null;
  }

  async claimAlertLog(log: AlertLog): Promise<{ created: boolean; log: AlertLog }> {
    const inserted = await this.db
      .insert(schema.alertLogsTable)
      .values(this.alertLogRow(log))
      .onConflictDoNothing()
      .returning({ data: schema.alertLogsTable.data });

    if (inserted[0]) {
      return { created: true, log: clone(inserted[0].data) };
    }

    const rows = await this.db
      .select({ data: schema.alertLogsTable.data })
      .from(schema.alertLogsTable)
      .where(eq(schema.alertLogsTable.idempotencyKey, log.id))
      .limit(1);
    return { created: false, log: rows[0] ? clone(rows[0].data) : log };
  }

  async saveAlertLog(log: AlertLog): Promise<AlertLog> {
    await this.db
      .insert(schema.alertLogsTable)
      .values(this.alertLogRow(log))
      .onConflictDoUpdate({
        target: schema.alertLogsTable.id,
        set: { idempotencyKey: log.id, applicationId: log.applicationId, data: log },
      });
    return clone(log);
  }

  async updateAlertLog(id: string, updates: Partial<AlertLog>): Promise<AlertLog | null> {
    const existing = await this.getAlertLog(id);
    if (!existing) return null;
    const updated: AlertLog = { ...existing, ...updates, id: existing.id };
    await this.db
      .update(schema.alertLogsTable)
      .set({ data: updated, applicationId: updated.applicationId })
      .where(eq(schema.alertLogsTable.id, id));
    return clone(updated);
  }

  async listEscalations(filters?: {
    status?: EscalationStatus;
    eventType?: AlertEventType;
    region?: Region;
  }): Promise<Escalation[]> {
    const conditions: SQL[] = [];
    if (filters?.status) conditions.push(eq(schema.escalationsTable.status, filters.status));
    if (filters?.eventType) {
      conditions.push(eq(schema.escalationsTable.eventType, filters.eventType));
    }
    if (filters?.region) conditions.push(eq(schema.escalationsTable.region, filters.region));

    const rows = await this.db
      .select({ data: schema.escalationsTable.data })
      .from(schema.escalationsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(schema.escalationsTable.createdAt));
    return rows.map((row) => clone(row.data));
  }

  async getEscalation(id: string): Promise<Escalation | null> {
    const rows = await this.db
      .select({ data: schema.escalationsTable.data })
      .from(schema.escalationsTable)
      .where(eq(schema.escalationsTable.id, id))
      .limit(1);
    return rows[0] ? clone(rows[0].data) : null;
  }

  async saveEscalation(escalation: Escalation): Promise<Escalation> {
    await this.db
      .insert(schema.escalationsTable)
      .values(this.escalationRow(escalation))
      .onConflictDoUpdate({
        target: schema.escalationsTable.id,
        set: this.escalationRow(escalation),
      });
    return clone(escalation);
  }

  async updateEscalation(
    id: string,
    updates: Partial<Escalation>
  ): Promise<Escalation | null> {
    const existing = await this.getEscalation(id);
    if (!existing) return null;
    const updated: Escalation = { ...existing, ...updates, id: existing.id };
    await this.db
      .update(schema.escalationsTable)
      .set(this.escalationRow(updated))
      .where(eq(schema.escalationsTable.id, id));
    return clone(updated);
  }

  async recordSignoff(record: SignoffRecord): Promise<SignoffRecord> {
    await this.db
      .insert(schema.signoffsTable)
      .values({ applicationId: record.applicationId, data: record })
      .onConflictDoUpdate({
        target: schema.signoffsTable.applicationId,
        set: { data: record },
      });
    return clone(record);
  }

  async getSignoff(applicationId: string): Promise<SignoffRecord | null> {
    const rows = await this.db
      .select({ data: schema.signoffsTable.data })
      .from(schema.signoffsTable)
      .where(eq(schema.signoffsTable.applicationId, applicationId))
      .limit(1);
    return rows[0] ? clone(rows[0].data) : null;
  }

  async getInspectors(domain?: Domain): Promise<Inspector[]> {
    const rows = await this.db
      .select({ data: schema.inspectorsTable.data })
      .from(schema.inspectorsTable)
      .where(
        domain
          ? sql`lower(${schema.inspectorsTable.domain}) = ${domain.toLowerCase()}`
          : undefined
      )
      .orderBy(asc(schema.inspectorsTable.id));
    return rows.map((row) => clone(row.data));
  }

  async getInspector(id: string): Promise<Inspector | null> {
    const rows = await this.db
      .select({ data: schema.inspectorsTable.data })
      .from(schema.inspectorsTable)
      .where(eq(schema.inspectorsTable.id, id))
      .limit(1);
    return rows[0] ? clone(rows[0].data) : null;
  }

  async getAffiliations(): Promise<Affiliation[]> {
    const rows = await this.db
      .select({ data: schema.affiliationsTable.data })
      .from(schema.affiliationsTable)
      .orderBy(asc(schema.affiliationsTable.id));
    return rows.map((row) => clone(row.data));
  }

  async getInspections(inspectorId?: string): Promise<InspectionAssignment[]> {
    const rows = await this.db
      .select({ data: schema.inspectionsTable.data })
      .from(schema.inspectionsTable)
      .orderBy(asc(schema.inspectionsTable.id));
    const list = rows.map((row) => clone(row.data));
    return inspectorId
      ? list.filter((inspection) =>
          inspection.inspectors.some((inspector) => inspector.id === inspectorId)
        )
      : list;
  }

  async saveInspection(inspection: InspectionAssignment): Promise<InspectionAssignment> {
    await this.db
      .insert(schema.inspectionsTable)
      .values({
        id: inspection.id,
        applicationId: inspection.applicationId,
        data: inspection,
      })
      .onConflictDoUpdate({
        target: schema.inspectionsTable.id,
        set: { applicationId: inspection.applicationId, data: inspection },
      });

    const app = await this.getApplication(inspection.applicationId);
    if (app) {
      app.scheduledInspection = inspection;
      await this.updateApplication(inspection.applicationId, {
        scheduledInspection: inspection,
      });
    }
    return clone(inspection);
  }

  async saveEvcReport(applicationId: string, report: EvcReport): Promise<EvcReport> {
    const inspectionId = `INSP-${applicationId}`;
    const rows = await this.db
      .select({ data: schema.inspectionsTable.data })
      .from(schema.inspectionsTable)
      .where(eq(schema.inspectionsTable.id, inspectionId))
      .limit(1);

    if (rows[0]) {
      const inspection: InspectionAssignment = {
        ...rows[0].data,
        status: 'COMPLETED',
        report,
      };
      await this.db
        .update(schema.inspectionsTable)
        .set({ data: inspection })
        .where(eq(schema.inspectionsTable.id, inspectionId));
    }

    const app = await this.getApplication(applicationId);
    if (app?.scheduledInspection) {
      const scheduledInspection: InspectionAssignment = {
        ...app.scheduledInspection,
        status: 'COMPLETED',
        report,
      };
      await this.updateApplication(applicationId, { scheduledInspection });
    }
    return clone(report);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const rows = await this.db
      .select({ data: schema.usersTable.data })
      .from(schema.usersTable)
      .where(sql`lower(${schema.usersTable.email}) = ${email.toLowerCase().trim()}`)
      .limit(1);
    return rows[0] ? clone(rows[0].data) : null;
  }

  async getUserById(id: string): Promise<User | null> {
    const rows = await this.db
      .select({ data: schema.usersTable.data })
      .from(schema.usersTable)
      .where(eq(schema.usersTable.id, id))
      .limit(1);
    return rows[0] ? clone(rows[0].data) : null;
  }

  async saveUser(user: User): Promise<User> {
    await this.db
      .insert(schema.usersTable)
      .values({ id: user.id, email: user.email, role: user.role, data: user })
      .onConflictDoUpdate({
        target: schema.usersTable.id,
        set: { email: user.email, role: user.role, data: user },
      });
    return clone(user);
  }

  async listUsers(): Promise<User[]> {
    const rows = await this.db
      .select({ data: schema.usersTable.data })
      .from(schema.usersTable)
      .orderBy(asc(schema.usersTable.id));
    return rows.map((row) => clone(row.data));
  }

  async getLedger(applicationId: string): Promise<LedgerEntry[]> {
    const rows = await this.db
      .select({ data: schema.ledgerTable.data })
      .from(schema.ledgerTable)
      .where(eq(schema.ledgerTable.applicationId, applicationId))
      .orderBy(asc(schema.ledgerTable.chainIndex));
    return rows.map((row) => clone(row.data));
  }

  async recordLedger(
    applicationId: string,
    eventType: string,
    actor: string,
    payload: Record<string, unknown>
  ): Promise<LedgerEntry> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select({ data: schema.ledgerTable.data })
        .from(schema.ledgerTable)
        .where(eq(schema.ledgerTable.applicationId, applicationId))
        .orderBy(asc(schema.ledgerTable.chainIndex));

      const prevHash = rows.length > 0 ? rows[rows.length - 1].data.hash : GENESIS_HASH;
      const entryId = `LEDGER-${applicationId}-${rows.length + 1}`;
      const entry = createLedgerEntry({
        id: entryId,
        applicationId,
        eventType,
        actor,
        payload,
        prevHash,
      });

      await tx.insert(schema.ledgerTable).values({
        id: entry.id,
        applicationId,
        chainIndex: rows.length + 1,
        data: entry,
      });
      return clone(entry);
    });
  }

  async tamperLedger(
    applicationId: string,
    index = 0
  ): Promise<{ tampered: boolean; entryId?: string }> {
    const chain = await this.getLedger(applicationId);
    if (chain.length === 0) return { tampered: false };

    const targetIdx = Math.min(Math.max(0, index), chain.length - 1);
    const targetEntry = chain[targetIdx];
    const tampered: LedgerEntry = {
      ...targetEntry,
      payload: {
        ...targetEntry.payload,
        _tampered: true,
        tamperedAt: new Date().toISOString(),
        fraudulentNote: 'Unauthorized status overwrite bypass in database record',
      },
    };

    await this.db
      .update(schema.ledgerTable)
      .set({ data: tampered })
      .where(eq(schema.ledgerTable.id, targetEntry.id));

    return { tampered: true, entryId: targetEntry.id };
  }

  // Undertakings & Renewals (Part 4)
  async createUndertaking(data: {
    applicationId: string;
    conditionText: string;
    dueDate?: string;
    createdBy?: string;
    id?: string;
    status?: UndertakingStatus;
  }): Promise<Undertaking> {
    const id = data.id || `UT-${data.applicationId}-${Date.now().toString().slice(-6)}`;
    const now = new Date();
    const dueDate =
      data.dueDate ||
      new Date(now.getTime() + DEFAULT_UNDERTAKING_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const undertaking: Undertaking = {
      id,
      applicationId: data.applicationId,
      conditionText: data.conditionText,
      dueDate,
      status: data.status || 'PENDING',
      createdBy: data.createdBy || 'system',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    await this.db
      .insert(schema.undertakingsTable)
      .values(this.undertakingRow(undertaking))
      .onConflictDoUpdate({
        target: schema.undertakingsTable.id,
        set: {
          applicationId: undertaking.applicationId,
          status: undertaking.status,
          dueDate: undertaking.dueDate,
          data: undertaking,
        },
      });
    return clone(undertaking);
  }

  async getUndertaking(id: string): Promise<Undertaking | null> {
    const rows = await this.db
      .select()
      .from(schema.undertakingsTable)
      .where(eq(schema.undertakingsTable.id, id))
      .limit(1);
    if (!rows[0]) return null;
    const undertaking = clone(rows[0].data);
    undertaking.evidence = await this.getEvidence(id);
    undertaking.verifications = await this.getVerifications(id);
    return undertaking;
  }

  async listUndertakings(filters?: {
    applicationId?: string;
    status?: UndertakingStatus;
  }): Promise<Undertaking[]> {
    const conditions: SQL[] = [];
    if (filters?.applicationId) {
      conditions.push(eq(schema.undertakingsTable.applicationId, filters.applicationId));
    }
    if (filters?.status) {
      conditions.push(eq(schema.undertakingsTable.status, filters.status));
    }
    const query = conditions.length
      ? this.db.select().from(schema.undertakingsTable).where(and(...conditions))
      : this.db.select().from(schema.undertakingsTable);

    const rows = await query;
    const populated = await Promise.all(
      rows.map(async (r) => {
        const u = clone(r.data);
        u.evidence = await this.getEvidence(u.id);
        u.verifications = await this.getVerifications(u.id);
        return u;
      })
    );
    return populated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async updateUndertaking(id: string, updates: Partial<Undertaking>): Promise<Undertaking | null> {
    const existing = await this.getUndertaking(id);
    if (!existing) return null;
    const updated: Undertaking = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    const { evidence: _e, verifications: _v, ...payload } = updated;
    await this.db
      .update(schema.undertakingsTable)
      .set({
        status: updated.status,
        dueDate: updated.dueDate,
        data: payload as Undertaking,
      })
      .where(eq(schema.undertakingsTable.id, id));
    return this.getUndertaking(id);
  }

  async saveEvidence(evidence: UndertakingEvidence): Promise<UndertakingEvidence> {
    await this.db
      .insert(schema.evidenceTable)
      .values(this.evidenceRow(evidence));
    return clone(evidence);
  }

  async getEvidence(undertakingId: string): Promise<UndertakingEvidence[]> {
    const rows = await this.db
      .select()
      .from(schema.evidenceTable)
      .where(eq(schema.evidenceTable.undertakingId, undertakingId));
    return rows.map((r) => clone(r.data));
  }

  async saveVerification(verification: UndertakingVerification): Promise<UndertakingVerification> {
    await this.db
      .insert(schema.verificationsTable)
      .values(this.verificationRow(verification));
    return clone(verification);
  }

  async getVerifications(undertakingId: string): Promise<UndertakingVerification[]> {
    const rows = await this.db
      .select()
      .from(schema.verificationsTable)
      .where(eq(schema.verificationsTable.undertakingId, undertakingId));
    return rows.map((r) => clone(r.data));
  }

  async resetDatabase(): Promise<void> {
    if (process.env.ALLOW_DB_RESET !== 'true') {
      throw new Error(
        'Database reset refused: ALLOW_DB_RESET=true must be explicitly set to reset database.'
      );
    }
    await this.db.delete(schema.verificationsTable);
    await this.db.delete(schema.evidenceTable);
    await this.db.delete(schema.undertakingsTable);
    await this.db.delete(schema.alertLogsTable);
    await this.db.delete(schema.escalationsTable);
    await this.db.delete(schema.notificationsTable);
    await this.db.delete(schema.signoffsTable);
    await this.db.delete(schema.ledgerTable);
    await this.db.delete(schema.documentsTable);
    await this.db.delete(schema.complianceDocumentsTable);
    await this.db.delete(schema.inspectionsTable);
    await this.db.delete(schema.inspectorsTable);
    await this.db.delete(schema.affiliationsTable);
    await this.db.delete(schema.usersTable);
    await this.db.delete(schema.applicationsTable);
  }

  async seed(): Promise<void> {
    // Insert-only idempotent demo seed: never deletes or resets existing data.
    const source = new InMemoryStore();

    const applications = await source.listApplications();
    const existingApps = await this.listApplications();
    const existingAppIds = new Set(existingApps.map((a) => a.id));
    const toInsertApps = applications.filter((app) => !existingAppIds.has(app.id));
    for (const batch of chunk(toInsertApps)) {
      if (batch.length) {
        await this.db.insert(schema.applicationsTable).values(batch.map((app) => this.applicationRow(app)));
      }
    }

    const documents = (
      await Promise.all(applications.map((app) => source.getDocuments(app.id)))
    ).flat();
    const existingDocs = (
      await Promise.all(existingApps.map((app) => this.getDocuments(app.id)))
    ).flat();
    const existingDocIds = new Set(existingDocs.map((d) => d.id));
    const toInsertDocs = documents.filter((d) => !existingDocIds.has(d.id));
    for (const batch of chunk(toInsertDocs)) {
      if (batch.length) {
        await this.db.insert(schema.documentsTable).values(
          batch.map((doc) => ({ id: doc.id, applicationId: doc.applicationId, data: doc }))
        );
      }
    }

    const compliance = (
      await Promise.all(applications.map((app) => source.getComplianceDocuments(app.id)))
    ).flat();
    const existingComp = await this.getComplianceDocuments();
    const existingCompIds = new Set(existingComp.map((c) => c.id));
    const toInsertComp = compliance.filter((c) => !existingCompIds.has(c.id));
    for (const batch of chunk(toInsertComp)) {
      if (batch.length) {
        await this.db.insert(schema.complianceDocumentsTable).values(
          batch.map((doc) => ({ id: doc.id, applicationId: doc.applicationId, data: doc }))
        );
      }
    }

    const notifications = await source.listNotifications();
    const existingNotifs = await this.listNotifications();
    const existingNotifIds = new Set(existingNotifs.map((n) => n.id));
    const toInsertNotifs = notifications.filter((n) => !existingNotifIds.has(n.id));
    for (const batch of chunk(toInsertNotifs)) {
      if (batch.length) {
        await this.db
          .insert(schema.notificationsTable)
          .values(batch.map((notification) => this.notificationRow(notification)));
      }
    }

    const inspectors = await source.getInspectors();
    const existingInspectors = await this.getInspectors();
    const existingInspectorIds = new Set(existingInspectors.map((i) => i.id));
    const toInsertInspectors = inspectors.filter((i) => !existingInspectorIds.has(i.id));
    for (const batch of chunk(toInsertInspectors)) {
      if (batch.length) {
        await this.db.insert(schema.inspectorsTable).values(
          batch.map((inspector) => ({
            id: inspector.id,
            domain: inspector.domain,
            data: inspector,
          }))
        );
      }
    }

    const affiliations = await source.getAffiliations();
    const existingAffiliations = await this.getAffiliations();
    const existingAffiliationIds = new Set(existingAffiliations.map((a) => a.id));
    const toInsertAffiliations = affiliations.filter((a) => !existingAffiliationIds.has(a.id));
    for (const batch of chunk(toInsertAffiliations)) {
      if (batch.length) {
        await this.db.insert(schema.affiliationsTable).values(
          batch.map((affiliation) => ({
            id: affiliation.id,
            inspectorId: affiliation.inspectorId,
            data: affiliation,
          }))
        );
      }
    }

    const inspections = await source.getInspections();
    const existingInspections = await this.getInspections();
    const existingInspectionIds = new Set(existingInspections.map((i) => i.id));
    const toInsertInspections = inspections.filter((i) => !existingInspectionIds.has(i.id));
    for (const batch of chunk(toInsertInspections)) {
      if (batch.length) {
        await this.db.insert(schema.inspectionsTable).values(
          batch.map((inspection) => ({
            id: inspection.id,
            applicationId: inspection.applicationId,
            data: inspection,
          }))
        );
      }
    }

    const users = await source.listUsers();
    const existingUsers = await this.listUsers();
    const existingUserIds = new Set(existingUsers.map((u) => u.id));
    const toInsertUsers = users.filter((u) => !existingUserIds.has(u.id));
    for (const batch of chunk(toInsertUsers)) {
      if (batch.length) {
        await this.db.insert(schema.usersTable).values(
          batch.map((user) => ({
            id: user.id,
            email: user.email,
            role: user.role,
            data: user,
          }))
        );
      }
    }

    for (const app of applications) {
      const existingLedger = await this.getLedger(app.id);
      const existingLedgerIds = new Set(existingLedger.map((e) => e.id));
      const ledger = await source.getLedger(app.id);
      const toInsertLedger = ledger.filter((e) => !existingLedgerIds.has(e.id));
      let chainIndex = existingLedger.length;
      for (const batch of chunk(toInsertLedger)) {
        if (batch.length) {
          await this.db.insert(schema.ledgerTable).values(
            batch.map((entry) => {
              chainIndex += 1;
              return {
                id: entry.id,
                applicationId: app.id,
                chainIndex,
                data: entry,
              };
            })
          );
        }
      }
    }

    const undertakings = await source.listUndertakings();
    const existingUndertakings = await this.listUndertakings();
    const existingUtIds = new Set(existingUndertakings.map((u) => u.id));
    const toInsertUts = undertakings.filter((u) => !existingUtIds.has(u.id));
    for (const batch of chunk(toInsertUts)) {
      if (batch.length) {
        await this.db.insert(schema.undertakingsTable).values(batch.map((u) => this.undertakingRow(u)));
      }
    }

    const allEvidence = (
      await Promise.all(undertakings.map((u) => source.getEvidence(u.id)))
    ).flat();
    const existingEvidence = (
      await Promise.all(existingUndertakings.map((u) => this.getEvidence(u.id)))
    ).flat();
    const existingEvdIds = new Set(existingEvidence.map((e) => e.id));
    const toInsertEvidence = allEvidence.filter((e) => !existingEvdIds.has(e.id));
    for (const batch of chunk(toInsertEvidence)) {
      if (batch.length) {
        await this.db.insert(schema.evidenceTable).values(batch.map((e) => this.evidenceRow(e)));
      }
    }

    const allVerifications = (
      await Promise.all(undertakings.map((u) => source.getVerifications(u.id)))
    ).flat();
    const existingVerifications = (
      await Promise.all(existingUndertakings.map((u) => this.getVerifications(u.id)))
    ).flat();
    const existingVerifIds = new Set(existingVerifications.map((v) => v.id));
    const toInsertVerifications = allVerifications.filter((v) => !existingVerifIds.has(v.id));
    for (const batch of chunk(toInsertVerifications)) {
      if (batch.length) {
        await this.db.insert(schema.verificationsTable).values(batch.map((v) => this.verificationRow(v)));
      }
    }
  }

  // R1: Registration OTP & Institution Profiles
  async saveOtp(otp: RegistrationOtp): Promise<void> {
    this.otps.set(otp.email.toLowerCase().trim(), clone(otp));
  }

  async getOtp(email: string): Promise<RegistrationOtp | null> {
    const found = this.otps.get(email.toLowerCase().trim());
    return found ? clone(found) : null;
  }

  async deleteOtp(email: string): Promise<void> {
    this.otps.delete(email.toLowerCase().trim());
  }

  async getProfile(idOrInstitution: string): Promise<InstitutionProfile | null> {
    if (!idOrInstitution) return null;
    const target = idOrInstitution.toLowerCase().trim();
    for (const p of this.profiles.values()) {
      if (
        (p.id && p.id.toLowerCase() === target) ||
        (p.institutionId && p.institutionId.toLowerCase() === target) ||
        (p.institutionName && p.institutionName.toLowerCase() === target) ||
        (p.college?.name && p.college.name.toLowerCase() === target)
      ) {
        return clone(p);
      }
    }
    return null;
  }

  async saveProfile(profile: InstitutionProfile): Promise<InstitutionProfile> {
    this.profiles.set(profile.id, clone(profile));
    return clone(profile);
  }

  async listProfiles(filters?: { region?: Region; status?: ProfileStatus }): Promise<InstitutionProfile[]> {
    let list = Array.from(this.profiles.values());
    if (filters?.region && filters.region !== 'ALL') {
      list = list.filter((p) => p.college.region === filters.region || p.college.region === 'ALL');
    }
    if (filters?.status) {
      list = list.filter((p) => p.status === filters.status);
    }
    return list
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((p) => clone(p));
  }

  async getAllDocumentHashesExcept(institutionName: string): Promise<Set<string>> {
    const hashes = new Set<string>();
    const norm = institutionName.toLowerCase().trim();

    // From applications & documents
    const allApps = await this.listApplications();
    for (const app of allApps) {
      if (app.institutionName.toLowerCase().trim() !== norm) {
        const docs = await this.getDocuments(app.id);
        for (const d of docs) {
          if (d.sha256) hashes.add(d.sha256);
        }
      }
    }

    // From other institution profiles
    for (const prof of this.profiles.values()) {
      if (prof.institutionName.toLowerCase().trim() !== norm) {
        if (prof.fdr?.documentHash) hashes.add(prof.fdr.documentHash);
        if (prof.land?.stateLandRecord?.hash) hashes.add(prof.land.stateLandRecord.hash);
        if (prof.land?.titleDeed?.hash) hashes.add(prof.land.titleDeed.hash);
        if (prof.land?.mutationEntry?.hash) hashes.add(prof.land.mutationEntry.hash);
        if (prof.land?.conversionOrder?.hash) hashes.add(prof.land.conversionOrder.hash);
        if (prof.land?.leaseDeed?.hash) hashes.add(prof.land.leaseDeed.hash);
        if (prof.land?.ownerNoc?.hash) hashes.add(prof.land.ownerNoc.hash);
        for (const doc of Object.values(prof.documents)) {
          if (doc?.hash) hashes.add(doc.hash);
        }
      }
    }

    return hashes;
  }
}

