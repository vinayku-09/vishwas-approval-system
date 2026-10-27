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
  CourseProposal,
  ProposalStatus,
} from '../types.js';
import bcrypt from 'bcryptjs';
import { createLedgerEntry, GENESIS_HASH } from '../services/ledger.js';
import { computeExpiryState } from '../services/expiry.js';
import { SLA_WINDOW_DAYS_NEW } from '../config/timelines.js';
import { DEFAULT_UNDERTAKING_DURATION_DAYS } from '../config/undertakings.js';
import { populatePart6DemoData } from './demoSeedPart6.js';

export interface IStore {
  listApplications(filters?: { status?: Status; type?: ApplicationType }): Promise<Application[]>;
  getApplication(id: string): Promise<Application | null>;
  createApplication(data: {
    institutionName: string;
    type: ApplicationType;
    extracted?: ExtractedFields;
    actor?: string;
    lat?: number;
    lng?: number;
    domain?: Domain;
  }): Promise<Application>;
  updateApplication(id: string, updates: Partial<Application>): Promise<Application | null>;
  
  // Documents
  saveDocument(doc: DocumentMetadata): Promise<DocumentMetadata>;
  getDocuments(applicationId: string): Promise<DocumentMetadata[]>;

  // Compliance
  saveComplianceDocument(doc: ComplianceDocument): Promise<ComplianceDocument>;
  getComplianceDocuments(applicationId?: string): Promise<ComplianceDocument[]>;

  // Notifications
  addNotification(notification: Notification): Promise<{ created: boolean; notification: Notification }>;
  listNotifications(): Promise<Notification[]>;
  markNotificationRead(id: string): Promise<boolean>;

  // Alerts & Escalations (Phase C)
  listAlertLogs(): Promise<AlertLog[]>;
  getAlertLog(id: string): Promise<AlertLog | null>;
  /**
   * Atomically claims an alert idempotency key. Returns created=false when the
   * key was already claimed by another run.
   */
  claimAlertLog(log: AlertLog): Promise<{ created: boolean; log: AlertLog }>;
  saveAlertLog(log: AlertLog): Promise<AlertLog>;
  updateAlertLog(id: string, updates: Partial<AlertLog>): Promise<AlertLog | null>;
  listEscalations(filters?: {
    status?: EscalationStatus;
    eventType?: AlertEventType;
    region?: Region;
  }): Promise<Escalation[]>;
  getEscalation(id: string): Promise<Escalation | null>;
  saveEscalation(escalation: Escalation): Promise<Escalation>;
  updateEscalation(id: string, updates: Partial<Escalation>): Promise<Escalation | null>;

  // Signoff
  recordSignoff(record: SignoffRecord): Promise<SignoffRecord>;
  getSignoff(applicationId: string): Promise<SignoffRecord | null>;

  // Scheduling & EVC Inspections (Phase A)
  getInspectors(domain?: Domain): Promise<Inspector[]>;
  getInspector(id: string): Promise<Inspector | null>;
  getAffiliations(): Promise<Affiliation[]>;
  getInspections(inspectorId?: string): Promise<InspectionAssignment[]>;
  saveInspection(inspection: InspectionAssignment): Promise<InspectionAssignment>;
  saveEvcReport(applicationId: string, report: EvcReport): Promise<EvcReport>;

  // Users & Auth (Phase B)
  getUserByEmail(email: string): Promise<User | null>;
  getUserById(id: string): Promise<User | null>;
  saveUser(user: User): Promise<User>;
  listUsers(): Promise<User[]>;

  // Ledger
  getLedger(applicationId: string): Promise<LedgerEntry[]>;
  recordLedger(
    applicationId: string,
    eventType: string,
    actor: string,
    payload: Record<string, unknown>
  ): Promise<LedgerEntry>;
  tamperLedger(applicationId: string, index?: number): Promise<{ tampered: boolean; entryId?: string }>;
  // Undertakings & Renewals (Part 4)
  createUndertaking(data: {
    applicationId: string;
    conditionText: string;
    dueDate?: string;
    createdBy?: string;
    id?: string;
    status?: UndertakingStatus;
  }): Promise<Undertaking>;
  getUndertaking(id: string): Promise<Undertaking | null>;
  listUndertakings(filters?: {
    applicationId?: string;
    status?: UndertakingStatus;
  }): Promise<Undertaking[]>;
  updateUndertaking(id: string, updates: Partial<Undertaking>): Promise<Undertaking | null>;
  saveEvidence(evidence: UndertakingEvidence): Promise<UndertakingEvidence>;
  getEvidence(undertakingId: string): Promise<UndertakingEvidence[]>;
  saveVerification(verification: UndertakingVerification): Promise<UndertakingVerification>;
  getVerifications(undertakingId: string): Promise<UndertakingVerification[]>;

  // R1: Registration OTP & Institution Profiles
  saveOtp(otp: RegistrationOtp): Promise<void>;
  getOtp(email: string): Promise<RegistrationOtp | null>;
  deleteOtp(email: string): Promise<void>;
  getProfile(idOrInstitution: string): Promise<InstitutionProfile | null>;
  saveProfile(profile: InstitutionProfile): Promise<InstitutionProfile>;
  listProfiles(filters?: { region?: Region; status?: ProfileStatus }): Promise<InstitutionProfile[]>;
  // Course & Intake Proposals
  saveCourseProposal(proposal: CourseProposal): Promise<CourseProposal>;
  getCourseProposal(id: string): Promise<CourseProposal | null>;
  listCourseProposals(filters?: {
    institutionId?: string;
    region?: Region;
    status?: ProposalStatus;
  }): Promise<CourseProposal[]>;
  deleteCourseProposal(id: string): Promise<boolean>;

  seed(): Promise<void> | void;
  resetDatabase?(): Promise<void> | void;
}

export class InMemoryStore implements IStore {
  private applications: Map<string, Application> = new Map();
  private documents: Map<string, DocumentMetadata[]> = new Map();
  private complianceDocuments: Map<string, ComplianceDocument> = new Map();
  private notifications: Map<string, Notification> = new Map();
  private signoffs: Map<string, SignoffRecord> = new Map();
  private ledger: Map<string, LedgerEntry[]> = new Map();
  private inspectors: Map<string, Inspector> = new Map();
  private affiliations: Map<string, Affiliation> = new Map();
  private inspections: Map<string, InspectionAssignment> = new Map();
  private users: Map<string, User> = new Map();
  private alertLogs: Map<string, AlertLog> = new Map();
  private escalations: Map<string, Escalation> = new Map();
  private undertakings: Map<string, Undertaking> = new Map();
  private evidence: Map<string, UndertakingEvidence[]> = new Map();
  private verifications: Map<string, UndertakingVerification[]> = new Map();
  private otps: Map<string, RegistrationOtp> = new Map();
  private profiles: Map<string, InstitutionProfile> = new Map();
  private courseProposals: Map<string, CourseProposal> = new Map();

  constructor() {
    this.seed();
  }

  async listApplications(filters?: { status?: Status; type?: ApplicationType }): Promise<Application[]> {
    let list = Array.from(this.applications.values());
    if (filters?.status) {
      list = list.filter((app) => app.status === filters.status);
    }
    if (filters?.type) {
      list = list.filter((app) => app.type === filters.type);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getApplication(id: string): Promise<Application | null> {
    const app = this.applications.get(id);
    return app ? JSON.parse(JSON.stringify(app)) : null;
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
    const nextSeq = this.applications.size + 1;
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

    this.applications.set(id, application);

    await this.recordLedger(
      id,
      'APPLICATION_CREATED',
      data.actor || 'institution',
      {
        institutionName: application.institutionName,
        type: application.type,
        status: application.status,
        slaDueAt: application.slaDueAt,
        domain: application.domain,
        lat: application.lat,
        lng: application.lng,
      }
    );

    return JSON.parse(JSON.stringify(application));
  }

  async updateApplication(id: string, updates: Partial<Application>): Promise<Application | null> {
    const app = this.applications.get(id);
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

    this.applications.set(id, updated);
    return JSON.parse(JSON.stringify(updated));
  }

  // Phase A: Scheduling & EVC Inspection Methods
  async getInspectors(domain?: Domain): Promise<Inspector[]> {
    let list = Array.from(this.inspectors.values());
    if (domain) {
      list = list.filter((i) => i.domain.toUpperCase() === domain.toUpperCase());
    }
    return JSON.parse(JSON.stringify(list));
  }

  async getInspector(id: string): Promise<Inspector | null> {
    const ins = this.inspectors.get(id);
    return ins ? JSON.parse(JSON.stringify(ins)) : null;
  }

  async getAffiliations(): Promise<Affiliation[]> {
    return JSON.parse(JSON.stringify(Array.from(this.affiliations.values())));
  }

  async getInspections(inspectorId?: string): Promise<InspectionAssignment[]> {
    let list = Array.from(this.inspections.values());
    if (inspectorId) {
      list = list.filter((i) => i.inspectors.some((ins) => ins.id === inspectorId));
    }
    return JSON.parse(JSON.stringify(list));
  }

  async saveInspection(inspection: InspectionAssignment): Promise<InspectionAssignment> {
    this.inspections.set(inspection.id, JSON.parse(JSON.stringify(inspection)));
    const app = this.applications.get(inspection.applicationId);
    if (app) {
      app.scheduledInspection = inspection;
      this.applications.set(inspection.applicationId, app);
    }
    return JSON.parse(JSON.stringify(inspection));
  }

  async saveEvcReport(applicationId: string, report: EvcReport): Promise<EvcReport> {
    const inspectionId = `INSP-${applicationId}`;
    const insp = this.inspections.get(inspectionId);
    if (insp) {
      insp.status = 'COMPLETED';
      insp.report = report;
      this.inspections.set(inspectionId, insp);
    }
    const app = this.applications.get(applicationId);
    if (app && app.scheduledInspection) {
      app.scheduledInspection.status = 'COMPLETED';
      app.scheduledInspection.report = report;
      this.applications.set(applicationId, app);
    }
    return JSON.parse(JSON.stringify(report));
  }

  // Users & Auth (Phase B)
  async getUserByEmail(email: string): Promise<User | null> {
    const target = email.toLowerCase().trim();
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === target) {
        return JSON.parse(JSON.stringify(u));
      }
    }
    return null;
  }

  async getUserById(id: string): Promise<User | null> {
    const u = this.users.get(id);
    return u ? JSON.parse(JSON.stringify(u)) : null;
  }

  async saveUser(user: User): Promise<User> {
    this.users.set(user.id, JSON.parse(JSON.stringify(user)));
    return JSON.parse(JSON.stringify(user));
  }

  async listUsers(): Promise<User[]> {
    return Array.from(this.users.values()).map((u) => JSON.parse(JSON.stringify(u)));
  }

  async saveDocument(doc: DocumentMetadata): Promise<DocumentMetadata> {
    const list = this.documents.get(doc.applicationId) || [];
    list.push(doc);
    this.documents.set(doc.applicationId, list);
    return JSON.parse(JSON.stringify(doc));
  }

  async getDocuments(applicationId: string): Promise<DocumentMetadata[]> {
    const list = this.documents.get(applicationId) || [];
    return JSON.parse(JSON.stringify(list));
  }

  async saveComplianceDocument(doc: ComplianceDocument): Promise<ComplianceDocument> {
    this.complianceDocuments.set(doc.id, JSON.parse(JSON.stringify(doc)));
    return JSON.parse(JSON.stringify(doc));
  }

  async getComplianceDocuments(applicationId?: string): Promise<ComplianceDocument[]> {
    let list = Array.from(this.complianceDocuments.values());
    if (applicationId) {
      list = list.filter((d) => d.applicationId === applicationId);
    }
    return JSON.parse(JSON.stringify(list));
  }

  async addNotification(notification: Notification): Promise<{ created: boolean; notification: Notification }> {
    for (const existing of this.notifications.values()) {
      if (existing.idempotencyKey === notification.idempotencyKey) {
        return { created: false, notification: JSON.parse(JSON.stringify(existing)) };
      }
    }
    this.notifications.set(notification.id, JSON.parse(JSON.stringify(notification)));
    return { created: true, notification: JSON.parse(JSON.stringify(notification)) };
  }

  async listNotifications(): Promise<Notification[]> {
    const list = Array.from(this.notifications.values());
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async markNotificationRead(id: string): Promise<boolean> {
    const n = this.notifications.get(id);
    if (!n) return false;
    n.read = true;
    this.notifications.set(id, n);
    return true;
  }

  // Alerts & Escalations (Phase C)
  async listAlertLogs(): Promise<AlertLog[]> {
    return JSON.parse(JSON.stringify(Array.from(this.alertLogs.values())));
  }

  async getAlertLog(id: string): Promise<AlertLog | null> {
    const log = this.alertLogs.get(id);
    return log ? JSON.parse(JSON.stringify(log)) : null;
  }

  async claimAlertLog(log: AlertLog): Promise<{ created: boolean; log: AlertLog }> {
    const existing = this.alertLogs.get(log.id);
    if (existing) {
      return { created: false, log: JSON.parse(JSON.stringify(existing)) };
    }
    this.alertLogs.set(log.id, JSON.parse(JSON.stringify(log)));
    return { created: true, log: JSON.parse(JSON.stringify(log)) };
  }

  async saveAlertLog(log: AlertLog): Promise<AlertLog> {
    this.alertLogs.set(log.id, JSON.parse(JSON.stringify(log)));
    return JSON.parse(JSON.stringify(log));
  }

  async updateAlertLog(id: string, updates: Partial<AlertLog>): Promise<AlertLog | null> {
    const existing = this.alertLogs.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, id: existing.id };
    this.alertLogs.set(id, updated);
    return JSON.parse(JSON.stringify(updated));
  }

  async listEscalations(filters?: {
    status?: EscalationStatus;
    eventType?: AlertEventType;
    region?: Region;
  }): Promise<Escalation[]> {
    let list = Array.from(this.escalations.values());
    if (filters?.status) {
      list = list.filter((e) => e.status === filters.status);
    }
    if (filters?.eventType) {
      list = list.filter((e) => e.eventType === filters.eventType);
    }
    if (filters?.region) {
      list = list.filter((e) => e.region === filters.region);
    }
    return list
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((e) => JSON.parse(JSON.stringify(e)));
  }

  async getEscalation(id: string): Promise<Escalation | null> {
    const escalation = this.escalations.get(id);
    return escalation ? JSON.parse(JSON.stringify(escalation)) : null;
  }

  async saveEscalation(escalation: Escalation): Promise<Escalation> {
    this.escalations.set(escalation.id, JSON.parse(JSON.stringify(escalation)));
    return JSON.parse(JSON.stringify(escalation));
  }

  async updateEscalation(
    id: string,
    updates: Partial<Escalation>
  ): Promise<Escalation | null> {
    const existing = this.escalations.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, id: existing.id };
    this.escalations.set(id, updated);
    return JSON.parse(JSON.stringify(updated));
  }

  async recordSignoff(record: SignoffRecord): Promise<SignoffRecord> {
    this.signoffs.set(record.applicationId, JSON.parse(JSON.stringify(record)));
    return JSON.parse(JSON.stringify(record));
  }

  async getSignoff(applicationId: string): Promise<SignoffRecord | null> {
    const s = this.signoffs.get(applicationId);
    return s ? JSON.parse(JSON.stringify(s)) : null;
  }

  async getLedger(applicationId: string): Promise<LedgerEntry[]> {
    const entries = this.ledger.get(applicationId) || [];
    return JSON.parse(JSON.stringify(entries));
  }

  async recordLedger(
    applicationId: string,
    eventType: string,
    actor: string,
    payload: Record<string, unknown>
  ): Promise<LedgerEntry> {
    const chain = this.ledger.get(applicationId) || [];
    const prevHash = chain.length > 0 ? chain[chain.length - 1].hash : GENESIS_HASH;
    const entryId = `LEDGER-${applicationId}-${chain.length + 1}`;

    const entry = createLedgerEntry({
      id: entryId,
      applicationId,
      eventType,
      actor,
      payload,
      prevHash,
    });

    chain.push(entry);
    this.ledger.set(applicationId, chain);
    return JSON.parse(JSON.stringify(entry));
  }

  async tamperLedger(applicationId: string, index = 0): Promise<{ tampered: boolean; entryId?: string }> {
    const chain = this.ledger.get(applicationId);
    if (!chain || chain.length === 0) {
      return { tampered: false };
    }

    const targetIdx = Math.min(Math.max(0, index), chain.length - 1);
    const targetEntry = chain[targetIdx];

    targetEntry.payload = {
      ...targetEntry.payload,
      _tampered: true,
      tamperedAt: new Date().toISOString(),
      fraudulentNote: 'Unauthorized status overwrite bypass in database record',
    };

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
    this.undertakings.set(id, undertaking);
    return JSON.parse(JSON.stringify(undertaking));
  }

  async getUndertaking(id: string): Promise<Undertaking | null> {
    const u = this.undertakings.get(id);
    if (!u) return null;
    const cloned = JSON.parse(JSON.stringify(u)) as Undertaking;
    cloned.evidence = await this.getEvidence(id);
    cloned.verifications = await this.getVerifications(id);
    return cloned;
  }

  async listUndertakings(filters?: {
    applicationId?: string;
    status?: UndertakingStatus;
  }): Promise<Undertaking[]> {
    let list = Array.from(this.undertakings.values());
    if (filters?.applicationId) {
      list = list.filter((u) => u.applicationId === filters.applicationId);
    }
    if (filters?.status) {
      list = list.filter((u) => u.status === filters.status);
    }
    const populated = await Promise.all(
      list.map(async (u) => {
        const cloned = JSON.parse(JSON.stringify(u)) as Undertaking;
        cloned.evidence = await this.getEvidence(u.id);
        cloned.verifications = await this.getVerifications(u.id);
        return cloned;
      })
    );
    return populated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async updateUndertaking(id: string, updates: Partial<Undertaking>): Promise<Undertaking | null> {
    const existing = this.undertakings.get(id);
    if (!existing) return null;
    const updated: Undertaking = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.undertakings.set(id, updated);
    return this.getUndertaking(id);
  }

  async saveEvidence(evidence: UndertakingEvidence): Promise<UndertakingEvidence> {
    const list = this.evidence.get(evidence.undertakingId) || [];
    list.push(JSON.parse(JSON.stringify(evidence)));
    this.evidence.set(evidence.undertakingId, list);
    return JSON.parse(JSON.stringify(evidence));
  }

  async getEvidence(undertakingId: string): Promise<UndertakingEvidence[]> {
    const list = this.evidence.get(undertakingId) || [];
    return JSON.parse(JSON.stringify(list));
  }

  async saveVerification(verification: UndertakingVerification): Promise<UndertakingVerification> {
    const list = this.verifications.get(verification.undertakingId) || [];
    list.push(JSON.parse(JSON.stringify(verification)));
    this.verifications.set(verification.undertakingId, list);
    return JSON.parse(JSON.stringify(verification));
  }

  async getVerifications(undertakingId: string): Promise<UndertakingVerification[]> {
    const list = this.verifications.get(undertakingId) || [];
    return JSON.parse(JSON.stringify(list));
  }

  // R1: Registration OTP & Institution Profiles
  async saveOtp(otp: RegistrationOtp): Promise<void> {
    this.otps.set(otp.email.toLowerCase().trim(), JSON.parse(JSON.stringify(otp)));
  }

  async getOtp(email: string): Promise<RegistrationOtp | null> {
    const found = this.otps.get(email.toLowerCase().trim());
    return found ? JSON.parse(JSON.stringify(found)) : null;
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
        return JSON.parse(JSON.stringify(p));
      }
    }
    return null;
  }

  async saveProfile(profile: InstitutionProfile): Promise<InstitutionProfile> {
    this.profiles.set(profile.id, JSON.parse(JSON.stringify(profile)));
    return JSON.parse(JSON.stringify(profile));
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
      .map((p) => JSON.parse(JSON.stringify(p)));
  }

  async getAllDocumentHashesExcept(institutionName: string): Promise<Set<string>> {
    const hashes = new Set<string>();
    const norm = institutionName.toLowerCase().trim();

    // From applications & documents
    for (const app of this.applications.values()) {
      if (app.institutionName.toLowerCase().trim() !== norm) {
        const docs = this.documents.get(app.id) || [];
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

  // Course Proposals
  async saveCourseProposal(proposal: CourseProposal): Promise<CourseProposal> {
    this.courseProposals.set(proposal.id, JSON.parse(JSON.stringify(proposal)));
    return JSON.parse(JSON.stringify(proposal));
  }

  async getCourseProposal(id: string): Promise<CourseProposal | null> {
    const found = this.courseProposals.get(id);
    return found ? JSON.parse(JSON.stringify(found)) : null;
  }

  async listCourseProposals(filters?: {
    institutionId?: string;
    region?: Region;
    status?: ProposalStatus;
  }): Promise<CourseProposal[]> {
    let list = Array.from(this.courseProposals.values());
    if (filters?.institutionId) {
      const targetInst = filters.institutionId.toLowerCase().trim();
      list = list.filter((p) => p.institutionId.toLowerCase().trim() === targetInst);
    }
    if (filters?.region && filters.region !== 'ALL') {
      list = list.filter((p) => p.region === filters.region || p.region === 'ALL');
    }
    if (filters?.status) {
      list = list.filter((p) => p.status === filters.status);
    }
    return list
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .map((p) => JSON.parse(JSON.stringify(p)));
  }

  async deleteCourseProposal(id: string): Promise<boolean> {
    return this.courseProposals.delete(id);
  }

  resetDatabase(): void {
    if (process.env.ALLOW_DB_RESET !== 'true') {
      throw new Error(
        'Database reset refused: ALLOW_DB_RESET=true must be explicitly set to reset database.'
      );
    }
    this.otps.clear();
    this.profiles.clear();
    this.courseProposals.clear();
    this.applications.clear();
    this.documents.clear();
    this.complianceDocuments.clear();
    this.notifications.clear();
    this.undertakings.clear();
    this.evidence.clear();
    this.verifications.clear();
    this.signoffs.clear();
    this.ledger.clear();
    this.inspectors.clear();
    this.affiliations.clear();
    this.inspections.clear();
    this.users.clear();
    this.alertLogs.clear();
    this.escalations.clear();
  }

  seed(): void {
    if (this.applications.size > 0 && this.applications.has('APP-DEMO-021')) {
      return;
    }

    // -------------------------------------------------------------
    // Phase B Seeds: Demo Users for each Role
    // -------------------------------------------------------------
    const defaultPasswordHash = bcrypt.hashSync('Password123!', 10);
    const demoUsers: User[] = [
      {
        id: 'USR-OFFICER-01',
        email: 'officer@aicte.gov.in',
        passwordHash: defaultPasswordHash,
        name: 'Dr. Arvind Kumar',
        role: 'OFFICER',
        region: 'ALL',
      },
      {
        id: 'USR-OFFICER-WEST',
        email: 'officer.west@aicte.gov.in',
        passwordHash: defaultPasswordHash,
        name: 'Dr. Kavita Deshmukh',
        role: 'OFFICER',
        region: 'WEST',
      },
      {
        id: 'USR-COMMITTEE-01',
        email: 'committee@aicte.gov.in',
        passwordHash: defaultPasswordHash,
        name: 'Dr. Sunita Patil',
        role: 'COMMITTEE',
        inspectorId: 'INS-002', // Matches seeded assignment INSP-APP-2024-003
        region: 'WEST',
      },
      {
        id: 'USR-CHIEF-01',
        email: 'chief@aicte.gov.in',
        passwordHash: defaultPasswordHash,
        name: 'Prof. Anil Sahasrabudhe',
        role: 'CHIEF',
        region: 'ALL',
      },
      {
        id: 'USR-INST-01',
        email: 'delhi.tech@aicte.gov.in',
        passwordHash: defaultPasswordHash,
        name: 'Delhi Institute Director',
        role: 'INSTITUTION',
        institutionName: 'Delhi Institute of Advanced Technology & AI',
      },
      {
        id: 'USR-INST-02',
        email: 'kaveri.poly@aicte.gov.in',
        passwordHash: defaultPasswordHash,
        name: 'Kaveri Polytechnic Principal',
        role: 'INSTITUTION',
        institutionName: 'Kaveri Polytechnic & Technical Campus',
      },
      {
        id: 'USR-INST-03',
        email: 'vjti@mumbai.edu',
        passwordHash: defaultPasswordHash,
        name: 'VJTI Mumbai Registrar',
        role: 'INSTITUTION',
        institutionName: 'Veermata Jijabai Technological Institute (VJTI)',
      },
    ];

    for (const u of demoUsers) {
      this.users.set(u.id, u);
    }

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // Helper date generator: e.g. now + 25 days
    const inDays = (days: number) => {
      const d = new Date(now + days * day);
      return d.toISOString().split('T')[0];
    };
    const pastDays = (days: number) => {
      const d = new Date(now - days * day);
      return d.toISOString().split('T')[0];
    };

    // 1. App 1: SUBMITTED (Fresh application, On time)
    const app1Id = 'APP-2024-001';
    const app1Created = new Date(now - 2 * day).toISOString();
    const app1Sla = new Date(now + 19 * day).toISOString();
    const app1: Application = {
      id: app1Id,
      institutionName: 'Delhi Institute of Advanced Technology & AI',
      type: 'NEW',
      status: 'SUBMITTED',
      createdAt: app1Created,
      slaDueAt: app1Sla,
      extracted: {
        landAreaSqm: 8200,
        leaseEndDate: '2048-12-31',
        fireNocExpiry: '2028-06-30',
      },
      deficiencies: [],
      locked: false,
      lat: 28.545,
      lng: 77.1926,
      domain: 'MECHANICAL',
      region: 'NORTH',
    };
    this.applications.set(app1Id, app1);

    const doc1: DocumentMetadata = {
      id: `DOC-${app1Id}-1`,
      applicationId: app1Id,
      docType: 'LEASE_DEED',
      fileName: 'registered_lease_deed_diat.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2458900,
      sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      storageUrl: '/uploads/registered_lease_deed_diat.pdf',
      uploadedAt: app1Created,
    };
    const doc2: DocumentMetadata = {
      id: `DOC-${app1Id}-2`,
      applicationId: app1Id,
      docType: 'FIRE_NOC',
      fileName: 'fire_safety_noc_delhi.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1042300,
      sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
      storageUrl: '/uploads/fire_safety_noc_delhi.pdf',
      uploadedAt: app1Created,
    };
    this.documents.set(app1Id, [doc1, doc2]);

    const comp1 = {
      id: `COMP-${app1Id}-LEASE`,
      applicationId: app1Id,
      docType: 'LEASE_DEED' as const,
      expiryDate: '2048-12-31',
      ...computeExpiryState('2048-12-31', new Date(now)),
      lastCheckedAt: new Date().toISOString(),
    };
    const comp2 = {
      id: `COMP-${app1Id}-FIRE`,
      applicationId: app1Id,
      docType: 'FIRE_NOC' as const,
      expiryDate: '2028-06-30',
      ...computeExpiryState('2028-06-30', new Date(now)),
      lastCheckedAt: new Date().toISOString(),
    };
    this.complianceDocuments.set(comp1.id, comp1);
    this.complianceDocuments.set(comp2.id, comp2);

    const app1Entry = createLedgerEntry({
      id: `LEDGER-${app1Id}-1`,
      applicationId: app1Id,
      eventType: 'APPLICATION_CREATED',
      actor: 'institution',
      payload: {
        institutionName: app1.institutionName,
        type: app1.type,
        initialStatus: 'SUBMITTED',
      },
      timestamp: app1Created,
      prevHash: GENESIS_HASH,
    });
    this.ledger.set(app1Id, [app1Entry]);

    // 2. App 2: DEFICIENT (Expired Fire NOC & Lease -> OVERDUE -> LOCKED)
    const app2Id = 'APP-2024-002';
    const app2Created = new Date(now - 16 * day).toISOString();
    const app2Sla = new Date(now + 5 * day).toISOString();
    const app2ExpiredLease = pastDays(120);
    const app2ExpiredNoc = pastDays(45);

    const app2: Application = {
      id: app2Id,
      institutionName: 'Kaveri Polytechnic & Technical Campus',
      type: 'EXTENSION_OF_APPROVAL',
      status: 'DEFICIENT',
      createdAt: app2Created,
      slaDueAt: app2Sla,
      extracted: {
        landAreaSqm: 4200,
        leaseEndDate: app2ExpiredLease,
        fireNocExpiry: app2ExpiredNoc,
      },
      deficiencies: [
        {
          id: 'DEF-LAND-002',
          message: 'Land area of 4200 sq.m is below the AICTE minimum threshold of 6000 sq.m',
          clause: 'AICTE APH 2024-25 Clause 4.1',
          severity: 'CRITICAL',
          confidence: 0.94,
          sourcePage: 2,
          evidence: 'Survey plan indicates net educational plot area of 4,200 sq.m.',
        },
        {
          id: 'DEF-LEASE-002',
          message: `Land lease deed expired on ${app2ExpiredLease}`,
          clause: 'AICTE APH 2024-25 Clause 4.3',
          severity: 'CRITICAL',
          confidence: 0.91,
          sourcePage: 4,
          evidence: `The lease executed for 30 years expired on ${app2ExpiredLease}.`,
        },
        {
          id: 'DEF-NOC-002',
          message: `Fire and Life Safety NOC expired on ${app2ExpiredNoc}`,
          clause: 'AICTE APH 2024-25 Clause 5.2',
          severity: 'CRITICAL',
          confidence: 0.88,
          sourcePage: 1,
          evidence: `Fire NOC valid through ${app2ExpiredNoc}.`,
        },
      ],
      locked: true, // Locked due to overdue expired document
      lat: 18.6279,
      lng: 73.8131,
      domain: 'CIVIL',
      region: 'SOUTH',
      undertakingDueAt: pastDays(3),
    };
    this.applications.set(app2Id, app2);

    const compApp2_1 = {
      id: `COMP-${app2Id}-LEASE`,
      applicationId: app2Id,
      docType: 'LEASE_DEED' as const,
      expiryDate: app2ExpiredLease,
      ...computeExpiryState(app2ExpiredLease, new Date(now)),
      lastCheckedAt: new Date().toISOString(),
    };
    const compApp2_2 = {
      id: `COMP-${app2Id}-FIRE`,
      applicationId: app2Id,
      docType: 'FIRE_NOC' as const,
      expiryDate: app2ExpiredNoc,
      ...computeExpiryState(app2ExpiredNoc, new Date(now)),
      lastCheckedAt: new Date().toISOString(),
      authenticityDueAt: pastDays(2),
    };
    this.complianceDocuments.set(compApp2_1.id, compApp2_1);
    this.complianceDocuments.set(compApp2_2.id, compApp2_2);

    this.notifications.set(`NOTIF-${app2Id}-OVERDUE`, {
      id: `NOTIF-${app2Id}-OVERDUE`,
      applicationId: app2Id,
      title: 'Application Locked: Document Expired',
      message: `Fire safety certificate expired on ${app2ExpiredNoc}. Application ${app2Id} is automatically locked from workflow progression.`,
      type: 'OVERDUE',
      read: false,
      createdAt: new Date(now - 1 * day).toISOString(),
      idempotencyKey: `${compApp2_2.id}-OVERDUE`,
      recipientRole: 'INSTITUTION',
      region: 'SOUTH',
      institutionName: app2.institutionName,
    });

    const app2Entry1 = createLedgerEntry({
      id: `LEDGER-${app2Id}-1`,
      applicationId: app2Id,
      eventType: 'APPLICATION_CREATED',
      actor: 'institution',
      payload: { institutionName: app2.institutionName, type: app2.type },
      timestamp: app2Created,
      prevHash: GENESIS_HASH,
    });
    const app2Entry2 = createLedgerEntry({
      id: `LEDGER-${app2Id}-2`,
      applicationId: app2Id,
      eventType: 'SCRUTINY_EVALUATED_DEFICIENT',
      actor: 'officer',
      payload: {
        previousStatus: 'SCRUTINY',
        newStatus: 'DEFICIENT',
        deficienciesCount: 3,
        deficiencies: app2.deficiencies,
      },
      timestamp: new Date(now - 14 * day).toISOString(),
      prevHash: app2Entry1.hash,
    });
    const app2Entry3 = createLedgerEntry({
      id: `LEDGER-${app2Id}-3`,
      applicationId: app2Id,
      eventType: 'APPLICATION_LOCKED',
      actor: 'system',
      payload: {
        reason: 'Expired compliance document detected during monitoring cycle',
        documentId: compApp2_2.id,
        expiryDate: app2ExpiredNoc,
      },
      timestamp: new Date(now - 1 * day).toISOString(),
      prevHash: app2Entry2.hash,
    });
    this.ledger.set(app2Id, [app2Entry1, app2Entry2, app2Entry3]);

    // 3. App 3: EVC_DONE with document expiring in ~25 days (WARNING tier 30)
    const app3Id = 'APP-2024-003';
    const app3Created = new Date(now - 18 * day).toISOString();
    const app3Sla = new Date(now + 3 * day).toISOString();
    const app3WarningNoc = inDays(25); // Expiring in 25 days!

    const app3: Application = {
      id: app3Id,
      institutionName: 'Himalayan Institute of Technology & Engineering',
      type: 'INTAKE_CHANGE',
      status: 'EVC_DONE',
      createdAt: app3Created,
      slaDueAt: app3Sla,
      extracted: {
        landAreaSqm: 14500,
        leaseEndDate: '2055-09-30',
        fireNocExpiry: app3WarningNoc,
      },
      deficiencies: [],
      locked: false,
      lat: 19.033,
      lng: 73.0297,
      domain: 'CSE',
      region: 'WEST',
    };
    this.applications.set(app3Id, app3);

    const compApp3_1 = {
      id: `COMP-${app3Id}-LEASE`,
      applicationId: app3Id,
      docType: 'LEASE_DEED' as const,
      expiryDate: '2055-09-30',
      ...computeExpiryState('2055-09-30', new Date(now)),
      lastCheckedAt: new Date().toISOString(),
    };
    const compApp3_2 = {
      id: `COMP-${app3Id}-FIRE`,
      applicationId: app3Id,
      docType: 'FIRE_NOC' as const,
      expiryDate: app3WarningNoc,
      ...computeExpiryState(app3WarningNoc, new Date(now)),
      lastCheckedAt: new Date().toISOString(),
      authenticityDueAt: inDays(3),
    };
    this.complianceDocuments.set(compApp3_1.id, compApp3_1);
    this.complianceDocuments.set(compApp3_2.id, compApp3_2);

    this.notifications.set(`NOTIF-${app3Id}-WARNING-30`, {
      id: `NOTIF-${app3Id}-WARNING-30`,
      applicationId: app3Id,
      title: 'Action Required: Fire Safety NOC Expiring Soon',
      message: `Fire Safety NOC for ${app3.institutionName} expires in 25 days (${app3WarningNoc}). Submit renewed certificate before final order.`,
      type: 'WARNING',
      read: false,
      createdAt: new Date(now - 3 * day).toISOString(),
      idempotencyKey: `${compApp3_2.id}-30`,
      recipientRole: 'INSTITUTION',
      region: 'WEST',
      institutionName: app3.institutionName,
    });

    const app3E1 = createLedgerEntry({
      id: `LEDGER-${app3Id}-1`,
      applicationId: app3Id,
      eventType: 'APPLICATION_CREATED',
      actor: 'institution',
      payload: { institutionName: app3.institutionName, type: app3.type },
      timestamp: app3Created,
      prevHash: GENESIS_HASH,
    });
    const app3E2 = createLedgerEntry({
      id: `LEDGER-${app3Id}-2`,
      applicationId: app3Id,
      eventType: 'SCRUTINY_PASSED',
      actor: 'officer',
      payload: { status: 'EVC_REQUIRED', remarks: 'Physical campus inspection mandated' },
      timestamp: new Date(now - 14 * day).toISOString(),
      prevHash: app3E1.hash,
    });
    const app3E3 = createLedgerEntry({
      id: `LEDGER-${app3Id}-3`,
      applicationId: app3Id,
      eventType: 'EVC_INSPECTION_COMPLETED',
      actor: 'committee',
      payload: {
        status: 'EVC_DONE',
        committeeHead: 'Prof. S. R. Sharma (IIT Delhi)',
        recommendation: 'Recommended for intake expansion (60 to 120 seats)',
      },
      timestamp: new Date(now - 2 * day).toISOString(),
      prevHash: app3E2.hash,
    });
    this.ledger.set(app3Id, [app3E1, app3E2, app3E3]);

    // 4. App 4: APPROVED
    const app4Id = 'APP-2024-004';
    const app4Created = new Date(now - 25 * day).toISOString();
    const app4Sla = new Date(now - 4 * day).toISOString();
    const app4: Application = {
      id: app4Id,
      institutionName: 'Apex National Academy of Engineering & Computing',
      type: 'EXTENSION_OF_APPROVAL',
      status: 'APPROVED',
      createdAt: app4Created,
      slaDueAt: app4Sla,
      extracted: {
        landAreaSqm: 28000,
        leaseEndDate: '2060-01-01',
        fireNocExpiry: '2030-05-10',
      },
      deficiencies: [],
      locked: false,
      lat: 22.56,
      lng: 88.35,
      domain: 'ELECTRICAL',
      region: 'EAST',
    };
    this.applications.set(app4Id, app4);

    const compApp4_1 = {
      id: `COMP-${app4Id}-LEASE`,
      applicationId: app4Id,
      docType: 'LEASE_DEED' as const,
      expiryDate: '2060-01-01',
      ...computeExpiryState('2060-01-01', new Date(now)),
      lastCheckedAt: new Date().toISOString(),
    };
    const compApp4_2 = {
      id: `COMP-${app4Id}-FIRE`,
      applicationId: app4Id,
      docType: 'FIRE_NOC' as const,
      expiryDate: '2030-05-10',
      ...computeExpiryState('2030-05-10', new Date(now)),
      lastCheckedAt: new Date().toISOString(),
    };
    this.complianceDocuments.set(compApp4_1.id, compApp4_1);
    this.complianceDocuments.set(compApp4_2.id, compApp4_2);

    const app4E1 = createLedgerEntry({
      id: `LEDGER-${app4Id}-1`,
      applicationId: app4Id,
      eventType: 'APPLICATION_CREATED',
      actor: 'institution',
      payload: { institutionName: app4.institutionName, type: app4.type },
      timestamp: app4Created,
      prevHash: GENESIS_HASH,
    });
    const app4E2 = createLedgerEntry({
      id: `LEDGER-${app4Id}-2`,
      applicationId: app4Id,
      eventType: 'SCRUTINY_PASSED',
      actor: 'officer',
      payload: { status: 'DECISION' },
      timestamp: new Date(now - 20 * day).toISOString(),
      prevHash: app4E1.hash,
    });
    const app4E3 = createLedgerEntry({
      id: `LEDGER-${app4Id}-3`,
      applicationId: app4Id,
      eventType: 'EXECUTIVE_COMMITTEE_APPROVAL',
      actor: 'officer',
      payload: {
        status: 'APPROVED',
        approvalOrderNo: 'AICTE/NWRO/2024/APP-004-EOA',
      },
      timestamp: new Date(now - 8 * day).toISOString(),
      prevHash: app4E2.hash,
    });
    this.ledger.set(app4Id, [app4E1, app4E2, app4E3]);

    // -------------------------------------------------------------
    // Phase A Seeds: 12 Inspectors across Indian States
    // -------------------------------------------------------------
    const seedDates = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'];
    const inspectorsList: Inspector[] = [
      { id: 'INS-001', name: 'Dr. Rajesh Sharma', domain: 'CSE', homeCity: 'Mumbai, MH', lat: 19.0760, lng: 72.8777, availableDates: seedDates },
      { id: 'INS-002', name: 'Dr. Sunita Patil', domain: 'CSE', homeCity: 'Pune, MH', lat: 18.5204, lng: 73.8567, availableDates: seedDates },
      { id: 'INS-003', name: 'Prof. Amit Verma', domain: 'CSE', homeCity: 'Nashik, MH', lat: 19.9975, lng: 73.7898, availableDates: seedDates },
      { id: 'INS-004', name: 'Dr. Priya Nair', domain: 'CIVIL', homeCity: 'Bengaluru, KA', lat: 12.9716, lng: 77.5946, availableDates: seedDates },
      { id: 'INS-005', name: 'Prof. Suresh Reddy', domain: 'CIVIL', homeCity: 'Mysuru, KA', lat: 12.2958, lng: 76.6394, availableDates: seedDates },
      { id: 'INS-006', name: 'Dr. Anand Kumar', domain: 'CIVIL', homeCity: 'Chennai, TN', lat: 13.0827, lng: 80.2707, availableDates: seedDates },
      { id: 'INS-007', name: 'Dr. Vikram Malhotra', domain: 'MECHANICAL', homeCity: 'New Delhi, DL', lat: 28.6139, lng: 77.2090, availableDates: seedDates },
      { id: 'INS-008', name: 'Prof. Meenakshi Sundaram', domain: 'MECHANICAL', homeCity: 'Noida, UP', lat: 28.5355, lng: 77.3910, availableDates: seedDates },
      { id: 'INS-009', name: 'Dr. Gurpreet Singh', domain: 'MECHANICAL', homeCity: 'Chandigarh, CH', lat: 30.7333, lng: 76.7794, availableDates: seedDates },
      { id: 'INS-010', name: 'Prof. Ramesh Iyer', domain: 'ELECTRICAL', homeCity: 'Hyderabad, TS', lat: 17.3850, lng: 78.4867, availableDates: seedDates },
      { id: 'INS-011', name: 'Dr. Deepa Mukherjee', domain: 'ELECTRICAL', homeCity: 'Kolkata, WB', lat: 22.5726, lng: 88.3639, availableDates: seedDates },
      { id: 'INS-012', name: 'Dr. Harish Joshi', domain: 'CSE', homeCity: 'Ahmedabad, GJ', lat: 23.0225, lng: 72.5714, availableDates: seedDates },
    ];
    for (const ins of inspectorsList) {
      this.inspectors.set(ins.id, ins);
    }

    // -------------------------------------------------------------
    // Phase A Seeds: 10 Affiliations (Conflicts of Interest)
    // -------------------------------------------------------------
    const affiliationsList: Affiliation[] = [
      // Key Demo Conflict: Dr. Rajesh Sharma is in Mumbai (~10km from VJTI), but has active affiliation!
      { id: 'AFF-001', inspectorId: 'INS-001', institutionName: 'Veermata Jijabai Technological Institute (VJTI)', reason: 'Former Department Head & Professor (2018-2023)' },
      { id: 'AFF-002', inspectorId: 'INS-002', institutionName: 'Deccan Institute of Advanced Computing', reason: 'Current PhD thesis supervisor for faculty members' },
      { id: 'AFF-003', inspectorId: 'INS-004', institutionName: 'Bangalore Institute of Technology', reason: 'Alumnus (B.Tech 2004) & Current Advisory Board Member' },
      { id: 'AFF-004', inspectorId: 'INS-005', institutionName: 'National Institute of Engineering', reason: 'Immediate family member holds executive administrative office' },
      { id: 'AFF-005', inspectorId: 'INS-007', institutionName: 'Delhi College of Engineering & Research', reason: 'Joint consultancy & patent research collaborator' },
      { id: 'AFF-006', inspectorId: 'INS-008', institutionName: 'Apex Institute of Technology & Science', reason: 'Former Dean of Academics (2019-2022)' },
      { id: 'AFF-007', inspectorId: 'INS-009', institutionName: 'Punjab Engineering Academy', reason: 'Alumnus & Adjunct Visiting Faculty' },
      { id: 'AFF-008', inspectorId: 'INS-010', institutionName: 'Telangana State Polytechnic', reason: 'Immediate relative currently studying in the department' },
      { id: 'AFF-009', inspectorId: 'INS-011', institutionName: 'Bengal Institute of Technology', reason: 'Co-investigator on ongoing funded research project' },
      { id: 'AFF-010', inspectorId: 'INS-012', institutionName: 'Gujarat Institute of Data Sciences', reason: 'Standing Board of Studies member' },
    ];
    for (const aff of affiliationsList) {
      this.affiliations.set(aff.id, aff);
    }

    // -------------------------------------------------------------
    // Phase A Seeds: Applications 5 through 15 across Indian States
    // -------------------------------------------------------------
    const extraApps: Array<{
      id: string;
      institutionName: string;
      type: ApplicationType;
      status: Status;
      domain: Domain;
      lat: number;
      lng: number;
      area: number;
      lease: string;
      noc: string;
      region: Region;
      /** SLA due date offset in days relative to now (negative = overdue). */
      slaOffsetDays?: number;
      undertakingOffsetDays?: number;
    }> = [
      // APP 5: Mumbai (Conflict demo with INS-001)
      { id: 'APP-2024-005', institutionName: 'Veermata Jijabai Technological Institute (VJTI)', type: 'NEW', status: 'EVC_REQUIRED', domain: 'CSE', lat: 18.9750, lng: 72.8258, area: 24000, lease: '2060-01-01', noc: '2028-12-31', region: 'WEST', slaOffsetDays: -2 },
      // APP 6: Mysuru (Civil)
      { id: 'APP-2024-006', institutionName: 'National Institute of Engineering', type: 'NEW', status: 'EVC_REQUIRED', domain: 'CIVIL', lat: 12.2830, lng: 76.6410, area: 18000, lease: '2055-06-30', noc: '2029-03-31', region: 'SOUTH', slaOffsetDays: 2, undertakingOffsetDays: 2 },
      // APP 7: New Delhi (Mechanical)
      { id: 'APP-2024-007', institutionName: 'Delhi College of Engineering & Research', type: 'NEW', status: 'EVC_REQUIRED', domain: 'MECHANICAL', lat: 28.7495, lng: 77.1180, area: 22000, lease: '2050-01-01', noc: '2028-09-30', region: 'NORTH', slaOffsetDays: -1 },
      // APP 8: Pune (CSE)
      { id: 'APP-2024-008', institutionName: 'Deccan Institute of Advanced Computing', type: 'NEW', status: 'EVC_REQUIRED', domain: 'CSE', lat: 18.5100, lng: 73.8400, area: 12000, lease: '2045-12-31', noc: '2027-11-30', region: 'WEST', slaOffsetDays: 7 },
      // APP 9: Bengaluru (Civil)
      { id: 'APP-2024-009', institutionName: 'Bangalore Institute of Technology', type: 'NEW', status: 'EVC_REQUIRED', domain: 'CIVIL', lat: 12.9560, lng: 77.5740, area: 16000, lease: '2052-05-15', noc: '2029-01-31', region: 'SOUTH', slaOffsetDays: 15 },
      // APP 10: Chandigarh (Mechanical)
      { id: 'APP-2024-010', institutionName: 'Punjab Engineering Academy', type: 'NEW', status: 'EVC_REQUIRED', domain: 'MECHANICAL', lat: 30.7600, lng: 76.7800, area: 19500, lease: '2058-08-20', noc: '2028-10-15', region: 'NORTH', slaOffsetDays: 30 },
      // APP 11: Hyderabad (Electrical)
      { id: 'APP-2024-011', institutionName: 'Telangana State Polytechnic', type: 'NEW', status: 'EVC_REQUIRED', domain: 'ELECTRICAL', lat: 17.4000, lng: 78.4700, area: 14000, lease: '2049-11-10', noc: '2027-08-30', region: 'SOUTH', slaOffsetDays: 11 },
      // APP 12: Ahmedabad (CSE)
      { id: 'APP-2024-012', institutionName: 'Gujarat Institute of Data Sciences', type: 'NEW', status: 'EVC_REQUIRED', domain: 'CSE', lat: 23.0300, lng: 72.5600, area: 15500, lease: '2054-04-01', noc: '2028-04-30', region: 'WEST', slaOffsetDays: 11 },
      // APP 13: Chennai (Civil, Submitted)
      { id: 'APP-2024-013', institutionName: 'Tamil Nadu Polytechnic College', type: 'EXTENSION_OF_APPROVAL', status: 'SUBMITTED', domain: 'CIVIL', lat: 13.0600, lng: 80.2500, area: 11000, lease: '2040-01-01', noc: '2029-05-30', region: 'SOUTH', slaOffsetDays: -5 },
      // APP 14: Kolkata (Electrical, Submitted)
      { id: 'APP-2024-014', institutionName: 'Bengal Institute of Technology', type: 'EXTENSION_OF_APPROVAL', status: 'SUBMITTED', domain: 'ELECTRICAL', lat: 22.5100, lng: 88.4000, area: 13500, lease: '2042-07-15', noc: '2028-06-20', region: 'EAST', slaOffsetDays: 4 },
      // APP 15: Leh, Ladakh (Electrical, Unassigned visit demo - exceeds travel limits)
      { id: 'APP-2024-015', institutionName: 'Remote Himalayan Institute of Tech, Leh', type: 'NEW', status: 'EVC_REQUIRED', domain: 'ELECTRICAL', lat: 34.1526, lng: 77.5771, area: 8500, lease: '2065-01-01', noc: '2030-01-01', region: 'NORTH', slaOffsetDays: 11 },
    ];

    for (const appData of extraApps) {
      const createdAt = new Date(now - 10 * day).toISOString();
      const slaDueAt = new Date(now + (appData.slaOffsetDays ?? 11) * day).toISOString();

      const appObj: Application = {
        id: appData.id,
        institutionName: appData.institutionName,
        type: appData.type,
        status: appData.status,
        createdAt,
        slaDueAt,
        domain: appData.domain,
        lat: appData.lat,
        lng: appData.lng,
        region: appData.region,
        undertakingDueAt:
          appData.undertakingOffsetDays !== undefined
            ? new Date(now + appData.undertakingOffsetDays * day).toISOString().split('T')[0]
            : undefined,
        extracted: {
          landAreaSqm: appData.area,
          leaseEndDate: appData.lease,
          fireNocExpiry: appData.noc,
        },
        deficiencies: [],
        locked: false,
      };

      this.applications.set(appData.id, appObj);

      // Ledger history
      const e1 = createLedgerEntry({
        id: `LEDGER-${appData.id}-1`,
        applicationId: appData.id,
        eventType: 'APPLICATION_CREATED',
        actor: 'institution',
        payload: { institutionName: appData.institutionName, type: appData.type, domain: appData.domain },
        timestamp: createdAt,
        prevHash: GENESIS_HASH,
      });

      if (appData.status === 'EVC_REQUIRED') {
        const e2 = createLedgerEntry({
          id: `LEDGER-${appData.id}-2`,
          applicationId: appData.id,
          eventType: 'SCRUTINY_PASSED',
          actor: 'officer',
          payload: { status: 'EVC_REQUIRED', remarks: 'Eligible for physical campus inspection' },
          timestamp: new Date(now - 8 * day).toISOString(),
          prevHash: e1.hash,
        });
        this.ledger.set(appData.id, [e1, e2]);
      } else {
        this.ledger.set(appData.id, [e1]);
      }
    }

    // -------------------------------------------------------------
    // Phase C Seeds: open EVC report submissions (overdue & near due)
    // -------------------------------------------------------------
    const app13 = this.applications.get('APP-2024-013');
    const app14 = this.applications.get('APP-2024-014');
    if (app13) {
      const inspection13: InspectionAssignment = {
        id: 'INSP-APP-2024-013',
        applicationId: app13.id,
        institutionName: app13.institutionName,
        domain: app13.domain || 'CIVIL',
        lat: app13.lat || 13.06,
        lng: app13.lng || 80.25,
        scheduledDate: pastDays(6),
        reportDueAt: pastDays(2),
        inspectors: [
          { id: 'INS-006', name: 'Dr. Anand Kumar', domain: 'CIVIL', homeCity: 'Chennai, TN' },
          { id: 'INS-004', name: 'Dr. Priya Nair', domain: 'CIVIL', homeCity: 'Bengaluru, KA' },
        ],
        status: 'SCHEDULED',
        source: 'manual',
      };
      this.inspections.set(inspection13.id, inspection13);
    }
    if (app14) {
      const inspection14: InspectionAssignment = {
        id: 'INSP-APP-2024-014',
        applicationId: app14.id,
        institutionName: app14.institutionName,
        domain: app14.domain || 'ELECTRICAL',
        lat: app14.lat || 22.51,
        lng: app14.lng || 88.4,
        scheduledDate: inDays(1),
        reportDueAt: inDays(3),
        inspectors: [
          { id: 'INS-011', name: 'Dr. Deepa Mukherjee', domain: 'ELECTRICAL', homeCity: 'Kolkata, WB' },
          { id: 'INS-010', name: 'Prof. Ramesh Iyer', domain: 'ELECTRICAL', homeCity: 'Hyderabad, TS' },
        ],
        status: 'SCHEDULED',
        source: 'manual',
      };
      this.inspections.set(inspection14.id, inspection14);
    }

    // Seed completed inspection for APP-2024-003
    const seededAssignment: InspectionAssignment = {
      id: `INSP-${app3Id}`,
      applicationId: app3Id,
      institutionName: app3.institutionName,
      domain: 'CSE',
      lat: app3.lat || 19.033,
      lng: app3.lng || 73.0297,
      scheduledDate: '2026-11-03',
      inspectors: [
        { id: 'INS-002', name: 'Dr. Sunita Patil', domain: 'CSE', homeCity: 'Pune, MH' },
        { id: 'INS-003', name: 'Prof. Amit Verma', domain: 'CSE', homeCity: 'Nashik, MH' },
      ],
      status: 'COMPLETED',
      report: {
        id: `REP-${app3Id}`,
        applicationId: app3Id,
        inspectorId: 'INS-002',
        findings: {
          infrastructure: 'Academic block of 14,500 sq.m verified with adequate barrier-free accessibility.',
          faculty: 'Faculty cadre ratio of 1:15 satisfied with requisite PhD qualifications.',
          labs: '12 high-end computer laboratories equipped with licensed compilers and 1 Gbps broadband.',
          remarks: 'Campus meets all norms. Recommend approval for intake expansion.',
        },
        recommendation: 'RECOMMENDED',
        reportHash: 'a7b8c9d0e1f234567890abcdef1234567890abcdef1234567890abcdef123456',
        submittedAt: new Date(now - 2 * day).toISOString(),
      },
      source: 'fallback',
    };
    this.inspections.set(seededAssignment.id, seededAssignment);
    app3.scheduledInspection = seededAssignment;
    this.applications.set(app3Id, app3);

    // -------------------------------------------------------------
    // Part 3: Idempotent demo data top-up for missing statuses
    // Ensures SCRUTINY, REJECTED, APPEAL_SHC, APPEAL_SAC appear covered
    // -------------------------------------------------------------
    // APP-DEMO-SCRUTINY
    if (!this.applications.has('APP-DEMO-SCRUTINY')) {
      const appScr = {
        id: 'APP-DEMO-SCRUTINY',
        institutionName: 'Demo Scrutiny Institute',
        type: 'NEW' as ApplicationType,
        status: 'SCRUTINY' as Status,
        createdAt: new Date(now - 5 * day).toISOString(),
        slaDueAt: new Date(now + 16 * day).toISOString(),
        extracted: { landAreaSqm: 10000, leaseEndDate: '2050-01-01', fireNocExpiry: '2029-01-01' },
        deficiencies: [],
        locked: false,
        lat: 28.6,
        lng: 77.2,
        domain: 'CSE' as Domain,
        region: 'NORTH' as Region,
      };
      this.applications.set(appScr.id, appScr);
      this.ledger.set(appScr.id, [
        createLedgerEntry({
          id: `LEDGER-${appScr.id}-1`,
          applicationId: appScr.id,
          eventType: 'APPLICATION_CREATED',
          actor: 'institution',
          payload: { institutionName: appScr.institutionName, type: appScr.type },
          timestamp: appScr.createdAt,
          prevHash: GENESIS_HASH,
        }),
      ]);
    }
    // APP-DEMO-REJECTED
    if (!this.applications.has('APP-DEMO-REJECTED')) {
      const appRej = {
        id: 'APP-DEMO-REJECTED',
        institutionName: 'Demo Rejected Institute',
        type: 'NEW' as ApplicationType,
        status: 'REJECTED' as Status,
        createdAt: new Date(now - 30 * day).toISOString(),
        slaDueAt: new Date(now - 9 * day).toISOString(),
        extracted: { landAreaSqm: 8000, leaseEndDate: '2049-01-01', fireNocExpiry: '2028-01-01' },
        deficiencies: [],
        locked: false,
        lat: 19.1,
        lng: 72.9,
        domain: 'MECHANICAL' as Domain,
        region: 'WEST' as Region,
      };
      this.applications.set(appRej.id, appRej);
      this.ledger.set(appRej.id, [
        createLedgerEntry({
          id: `LEDGER-${appRej.id}-1`,
          applicationId: appRej.id,
          eventType: 'APPLICATION_CREATED',
          actor: 'institution',
          payload: { institutionName: appRej.institutionName, type: appRej.type },
          timestamp: appRej.createdAt,
          prevHash: GENESIS_HASH,
        }),
      ]);
    }
    // APP-DEMO-APPEAL-SHC
    if (!this.applications.has('APP-DEMO-APPEAL-SHC')) {
      const appShc = {
        id: 'APP-DEMO-APPEAL-SHC',
        institutionName: 'Demo Appeal SHC Institute',
        type: 'APPEAL' as ApplicationType,
        status: 'APPEAL_SHC' as Status,
        createdAt: new Date(now - 12 * day).toISOString(),
        slaDueAt: new Date(now + 9 * day).toISOString(),
        extracted: { landAreaSqm: 9000, leaseEndDate: '2051-01-01', fireNocExpiry: '2029-06-01' },
        deficiencies: [],
        locked: false,
        lat: 13.0,
        lng: 80.2,
        domain: 'CIVIL' as Domain,
        region: 'SOUTH' as Region,
      };
      this.applications.set(appShc.id, appShc);
      this.ledger.set(appShc.id, [
        createLedgerEntry({
          id: `LEDGER-${appShc.id}-1`,
          applicationId: appShc.id,
          eventType: 'APPLICATION_CREATED',
          actor: 'institution',
          payload: { institutionName: appShc.institutionName, type: appShc.type },
          timestamp: appShc.createdAt,
          prevHash: GENESIS_HASH,
        }),
      ]);
    }
    // APP-DEMO-APPEAL-SAC
    if (!this.applications.has('APP-DEMO-APPEAL-SAC')) {
      const appSac = {
        id: 'APP-DEMO-APPEAL-SAC',
        institutionName: 'Demo Appeal SAC Institute',
        type: 'APPEAL' as ApplicationType,
        status: 'APPEAL_SAC' as Status,
        createdAt: new Date(now - 15 * day).toISOString(),
        slaDueAt: new Date(now + 6 * day).toISOString(),
        extracted: { landAreaSqm: 9500, leaseEndDate: '2052-01-01', fireNocExpiry: '2030-01-01' },
        deficiencies: [],
        locked: false,
        lat: 22.6,
        lng: 88.4,
        domain: 'ELECTRICAL' as Domain,
        region: 'EAST' as Region,
      };
      this.applications.set(appSac.id, appSac);
      this.ledger.set(appSac.id, [
        createLedgerEntry({
          id: `LEDGER-${appSac.id}-1`,
          applicationId: appSac.id,
          eventType: 'APPLICATION_CREATED',
          actor: 'institution',
          payload: { institutionName: appSac.institutionName, type: appSac.type },
          timestamp: appSac.createdAt,
          prevHash: GENESIS_HASH,
        }),
      ]);
    }
    // APP-DEMO-EVC-DELAYED — labelled demo data for delayed EVC board + alerts
    if (!this.applications.has('APP-DEMO-EVC-DELAYED')) {
      const appDel: Application = {
        id: 'APP-DEMO-EVC-DELAYED',
        institutionName: 'Demo Delayed EVC Institute',
        type: 'NEW',
        status: 'EVC_REQUIRED',
        createdAt: new Date(now - 25 * day).toISOString(),
        slaDueAt: new Date(now - 4 * day).toISOString(),
        extracted: { landAreaSqm: 11000, leaseEndDate: '2050-06-01', fireNocExpiry: '2029-03-01' },
        deficiencies: [],
        locked: false,
        lat: 19.2,
        lng: 72.85,
        domain: 'CSE',
        region: 'WEST',
      };
      this.applications.set(appDel.id, appDel);
      this.ledger.set(appDel.id, [
        createLedgerEntry({
          id: `LEDGER-${appDel.id}-1`,
          applicationId: appDel.id,
          eventType: 'APPLICATION_CREATED',
          actor: 'institution',
          payload: { institutionName: appDel.institutionName, type: appDel.type, demo: true },
          timestamp: appDel.createdAt,
          prevHash: GENESIS_HASH,
        }),
      ]);
      const delayedAssignment: InspectionAssignment = {
        id: 'INSP-DEMO-DELAYED',
        applicationId: appDel.id,
        institutionName: appDel.institutionName,
        domain: 'CSE',
        lat: appDel.lat ?? 19.2,
        lng: appDel.lng ?? 72.85,
        scheduledDate: new Date(now - 10 * day).toISOString().slice(0, 10),
        inspectors: [
          { id: 'INS-002', name: 'Dr. Sunita Patil', domain: 'CSE', homeCity: 'Pune, MH' },
          { id: 'INS-003', name: 'Prof. Amit Verma', domain: 'CSE', homeCity: 'Nashik, MH' },
        ],
        status: 'SCHEDULED',
        source: 'fallback',
        reportDueAt: new Date(now - 5 * day).toISOString().slice(0, 10),
      };
      this.inspections.set(delayedAssignment.id, delayedAssignment);
      appDel.scheduledInspection = delayedAssignment;
      this.applications.set(appDel.id, appDel);
    }

    // -------------------------------------------------------------
    // Part 4 Demo Top-Up (Idempotent: insert only what is missing)
    // Labelled demo data for undertakings in each status + expiring/expired docs
    // -------------------------------------------------------------
    // 1. Expiring document in warning tier
    if (!this.complianceDocuments.has('COMP-DEMO-EXPIRING')) {
      const expiringDoc: ComplianceDocument = {
        id: 'COMP-DEMO-EXPIRING',
        applicationId: 'APP-2024-001',
        docType: 'FIRE_NOC',
        expiryDate: inDays(45),
        state: 'WARNING',
        tier: 60,
        daysRemaining: 45,
        lastCheckedAt: new Date().toISOString(),
      };
      this.complianceDocuments.set(expiringDoc.id, expiringDoc);
    }

    // 2. Expired document with locked application
    if (!this.complianceDocuments.has('COMP-DEMO-EXPIRED')) {
      const expiredDoc: ComplianceDocument = {
        id: 'COMP-DEMO-EXPIRED',
        applicationId: 'APP-2024-002',
        docType: 'FIRE_NOC',
        expiryDate: pastDays(10),
        state: 'OVERDUE',
        daysRemaining: -10,
        lastCheckedAt: new Date().toISOString(),
      };
      this.complianceDocuments.set(expiredDoc.id, expiredDoc);
      const app2 = this.applications.get('APP-2024-002');
      if (app2) {
        app2.locked = true;
        this.applications.set(app2.id, app2);
      }
    }

    // 3. Undertakings in EACH status
    // PENDING
    if (!this.undertakings.has('UT-DEMO-PENDING')) {
      const utPending: Undertaking = {
        id: 'UT-DEMO-PENDING',
        applicationId: 'APP-2024-001',
        conditionText: 'Demo: Submit fire safety equipment maintenance certificate and proof of annual inspection.',
        dueDate: inDays(20),
        status: 'PENDING',
        createdBy: 'officer.north@aicte.gov.in',
        createdAt: new Date(now - 3 * day).toISOString(),
        updatedAt: new Date(now - 3 * day).toISOString(),
      };
      this.undertakings.set(utPending.id, utPending);
    }

    // SUBMITTED (with evidence)
    if (!this.undertakings.has('UT-DEMO-SUBMITTED')) {
      const utSubmitted: Undertaking = {
        id: 'UT-DEMO-SUBMITTED',
        applicationId: 'APP-2024-002',
        conditionText: 'Demo: Submit revised building accessibility compliance affidavit for differently-abled students.',
        dueDate: inDays(10),
        status: 'SUBMITTED',
        createdBy: 'officer.west@aicte.gov.in',
        createdAt: new Date(now - 4 * day).toISOString(),
        updatedAt: new Date(now - 2 * day).toISOString(),
      };
      this.undertakings.set(utSubmitted.id, utSubmitted);
      const evd1: UndertakingEvidence = {
        id: 'EVD-DEMO-01',
        undertakingId: utSubmitted.id,
        fileName: 'accessibility_affidavit_signed.pdf',
        fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        storageRef: '/uploads/accessibility_affidavit_signed.pdf',
        submittedBy: 'kaveri.poly@aicte.gov.in',
        submittedAt: new Date(now - 2 * day).toISOString(),
      };
      this.evidence.set(utSubmitted.id, [evd1]);
    }

    // VERIFIED (with evidence and verification)
    if (!this.undertakings.has('UT-DEMO-VERIFIED')) {
      const utVerified: Undertaking = {
        id: 'UT-DEMO-VERIFIED',
        applicationId: 'APP-2024-003',
        conditionText: 'Demo: Submit proof of upgraded laboratory safety exhaust systems.',
        dueDate: inDays(15),
        status: 'VERIFIED',
        createdBy: 'officer.west@aicte.gov.in',
        createdAt: new Date(now - 7 * day).toISOString(),
        updatedAt: new Date(now - 3 * day).toISOString(),
      };
      this.undertakings.set(utVerified.id, utVerified);
      const evd2: UndertakingEvidence = {
        id: 'EVD-DEMO-02',
        undertakingId: utVerified.id,
        fileName: 'lab_safety_exhaust_installation_proof.pdf',
        fileHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
        storageRef: '/uploads/lab_safety_exhaust_installation_proof.pdf',
        submittedBy: 'vjti@mumbai.edu',
        submittedAt: new Date(now - 5 * day).toISOString(),
      };
      this.evidence.set(utVerified.id, [evd2]);
      const verif1: UndertakingVerification = {
        id: 'VERIF-DEMO-01',
        undertakingId: utVerified.id,
        officer: 'officer.west@aicte.gov.in',
        decision: 'VERIFIED',
        remarks: 'Verified against engineering compliance specification. All norms fulfilled.',
        timestamp: new Date(now - 3 * day).toISOString(),
      };
      this.verifications.set(utVerified.id, [verif1]);
    }

    // REJECTED (with evidence and verification with remarks)
    if (!this.undertakings.has('UT-DEMO-REJECTED')) {
      const utRejected: Undertaking = {
        id: 'UT-DEMO-REJECTED',
        applicationId: 'APP-2024-004',
        conditionText: 'Demo: Submit certified structural stability report from empanelled engineer.',
        dueDate: inDays(5),
        status: 'REJECTED',
        createdBy: 'officer.west@aicte.gov.in',
        createdAt: new Date(now - 8 * day).toISOString(),
        updatedAt: new Date(now - 1 * day).toISOString(),
      };
      this.undertakings.set(utRejected.id, utRejected);
      const evd3: UndertakingEvidence = {
        id: 'EVD-DEMO-03',
        undertakingId: utRejected.id,
        fileName: 'unverified_stability_draft.pdf',
        fileHash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
        storageRef: '/uploads/unverified_stability_draft.pdf',
        submittedBy: 'kaveri.poly@aicte.gov.in',
        submittedAt: new Date(now - 4 * day).toISOString(),
      };
      this.evidence.set(utRejected.id, [evd3]);
      const verif2: UndertakingVerification = {
        id: 'VERIF-DEMO-02',
        undertakingId: utRejected.id,
        officer: 'officer.west@aicte.gov.in',
        decision: 'REJECTED',
        remarks: 'Report is missing engineer registration seal and structural load calculation sheet.',
        timestamp: new Date(now - 1 * day).toISOString(),
      };
      this.verifications.set(utRejected.id, [verif2]);
    }

    // OVERDUE
    if (!this.undertakings.has('UT-DEMO-OVERDUE')) {
      const utOverdue: Undertaking = {
        id: 'UT-DEMO-OVERDUE',
        applicationId: 'APP-DEMO-SCRUTINY',
        conditionText: 'Demo: Submit faculty roster signed by university registrar.',
        dueDate: pastDays(5),
        status: 'OVERDUE',
        createdBy: 'officer.west@aicte.gov.in',
        createdAt: new Date(now - 20 * day).toISOString(),
        updatedAt: new Date(now - 5 * day).toISOString(),
      };
      this.undertakings.set(utOverdue.id, utOverdue);
    }

    // Part 6 Demo Top-Up: 42 total applications across all regions and criteria
    populatePart6DemoData(this);
  }
}

export let store: IStore = new InMemoryStore();

/**
 * Replaces the active store. ES module live bindings mean every importer sees
 * the new instance; used by the Postgres bootstrap and Postgres-specific tests.
 */
export function setStore(next: IStore): void {
  store = next;
}
