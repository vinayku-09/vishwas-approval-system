import { Application, ApplicationType, ExtractedFields, LedgerEntry, Status } from '../types.js';
import { createLedgerEntry, GENESIS_HASH } from '../services/ledger.js';

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
    // Return newest first
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

    // AICTE SLA: 21 days for scrutiny and processing
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
    };

    this.applications.set(id, application);

    // Initial genesis ledger entry for application creation
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
      deficiencies: updates.deficiencies ?? app.deficiencies,
    };

    this.applications.set(id, updated);
    return JSON.parse(JSON.stringify(updated));
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

    // Alter the payload without recalculating the hash to simulate unauthorized database modification
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
    this.ledger.clear();

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

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
    };
    this.applications.set(app1Id, app1);

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

    // 2. App 2: DEFICIENT (Failed AI scrutiny on land and NOC, Warning SLA)
    const app2Id = 'APP-2024-002';
    const app2Created = new Date(now - 16 * day).toISOString();
    const app2Sla = new Date(now + 5 * day).toISOString();
    const app2ScrutinyTime = new Date(now - 14 * day).toISOString();
    const app2: Application = {
      id: app2Id,
      institutionName: 'Kaveri Polytechnic & Technical Campus',
      type: 'EXTENSION_OF_APPROVAL',
      status: 'DEFICIENT',
      createdAt: app2Created,
      slaDueAt: app2Sla,
      extracted: {
        landAreaSqm: 4200, // Deficient (< 6000)
        leaseEndDate: '2024-01-15', // Expired
        fireNocExpiry: '2024-02-28', // Expired
      },
      deficiencies: [
        {
          message: 'Land area of 4200 sq.m is below the AICTE minimum threshold of 6000 sq.m',
          clause: 'AICTE APH 2024-25 Clause 4.1',
          severity: 'CRITICAL',
        },
        {
          message: 'Land lease deed expired on 2024-01-15',
          clause: 'AICTE APH 2024-25 Clause 4.3',
          severity: 'CRITICAL',
        },
        {
          message: 'Fire and Life Safety NOC expired on 2024-02-28',
          clause: 'AICTE APH 2024-25 Clause 5.2',
          severity: 'CRITICAL',
        },
      ],
    };
    this.applications.set(app2Id, app2);

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
      timestamp: app2ScrutinyTime,
      prevHash: app2Entry1.hash,
    });
    this.ledger.set(app2Id, [app2Entry1, app2Entry2]);

    // 3. App 3: EVC_DONE (Expert Visit completed, ready for final decision)
    const app3Id = 'APP-2024-003';
    const app3Created = new Date(now - 18 * day).toISOString();
    const app3Sla = new Date(now + 3 * day).toISOString();
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
        fireNocExpiry: '2028-11-15',
      },
      deficiencies: [],
    };
    this.applications.set(app3Id, app3);

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

    // 4. App 4: APPROVED (Full lifecycle complete, On time)
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
    };
    this.applications.set(app4Id, app4);

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
        validAcademicYear: '2024-2025',
      },
      timestamp: new Date(now - 8 * day).toISOString(),
      prevHash: app4E2.hash,
    });
    this.ledger.set(app4Id, [app4E1, app4E2, app4E3]);
  }
}

// Singleton storage instance
export const store: IStore = new InMemoryStore();
