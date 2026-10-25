import {
  Application,
  ApplicationType,
  ComplianceDocument,
  DocumentMetadata,
  ExtractedFields,
  LedgerEntry,
  Notification,
  SignoffRecord,
  Status,
} from '../types.js';
import { createLedgerEntry, GENESIS_HASH } from '../services/ledger.js';
import { computeExpiryState } from '../services/expiry.js';

export interface IStore {
  listApplications(filters?: { status?: Status; type?: ApplicationType }): Promise<Application[]>;
  getApplication(id: string): Promise<Application | null>;
  createApplication(data: {
    institutionName: string;
    type: ApplicationType;
    extracted?: ExtractedFields;
    actor?: string;
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

  // Signoff
  recordSignoff(record: SignoffRecord): Promise<SignoffRecord>;
  getSignoff(applicationId: string): Promise<SignoffRecord | null>;

  // Ledger
  getLedger(applicationId: string): Promise<LedgerEntry[]>;
  recordLedger(
    applicationId: string,
    eventType: string,
    actor: string,
    payload: Record<string, unknown>
  ): Promise<LedgerEntry>;
  tamperLedger(applicationId: string, index?: number): Promise<{ tampered: boolean; entryId?: string }>;
  seed(): void;
}

class InMemoryStore implements IStore {
  private applications: Map<string, Application> = new Map();
  private documents: Map<string, DocumentMetadata[]> = new Map();
  private complianceDocuments: Map<string, ComplianceDocument> = new Map();
  private notifications: Map<string, Notification> = new Map();
  private signoffs: Map<string, SignoffRecord> = new Map();
  private ledger: Map<string, LedgerEntry[]> = new Map();

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
  }): Promise<Application> {
    const nextSeq = this.applications.size + 1;
    const year = new Date().getFullYear();
    const id = `APP-${year}-${String(nextSeq).padStart(3, '0')}`;

    const now = new Date();
    const createdAt = now.toISOString();
    const slaDue = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
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
    };

    this.applications.set(id, updated);
    return JSON.parse(JSON.stringify(updated));
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

  seed(): void {
    this.applications.clear();
    this.documents.clear();
    this.complianceDocuments.clear();
    this.notifications.clear();
    this.signoffs.clear();
    this.ledger.clear();

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
  }
}

export const store: IStore = new InMemoryStore();
