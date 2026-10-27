/**
 * demoSeedPart6.ts - Part 6 comprehensive demo data top-up (~40 applications).
 *
 * All records are insert-only, labeled as demo data, and use fictional demo data
 * (no real personal data).
 *
 * Covers:
 * - All regions: NORTH, SOUTH, EAST, WEST, CENTRAL, NORTH_EAST
 * - All 4 routes: ONLY_SCRUTINY, SCRUTINY_EVC, EVC_SAC_SHC, ONLY_EVC
 * - All 10 stages: SUBMITTED, SCRUTINY, DEFICIENT, EVC_REQUIRED, EVC_DONE,
 *   DECISION, APPROVED, REJECTED, APPEAL_SHC, APPEAL_SAC
 * - Returns with ReturnRecord and APPLICATION_RETURNED ledger entries
 * - Overdue and approaching stage SLA cases
 * - Undertakings in every status: PENDING, SUBMITTED, VERIFIED, REJECTED, OVERDUE
 * - Compliance documents: VALID, WARNING (tiers 90, 60, 30), and OVERDUE (expired)
 * - Document renewals: SUBMITTED, VERIFIED, REJECTED
 * - Delayed EVC cases (scheduling delayed and report delayed)
 * - Alerts and escalations at each level: Level 1, Level 2, Level 3
 */

import type {
  Application,
  ApplicationType,
  ComplianceDocument,
  DocumentMetadata,
  Domain,
  Escalation,
  InspectionAssignment,
  Region,
  ReturnRecord,
  Status,
  Undertaking,
  UndertakingEvidence,
  UndertakingVerification,
  AlertLog,
} from '../types.js';
import { createLedgerEntry, GENESIS_HASH } from '../services/ledger.js';
import { computeExpiryState } from '../services/expiry.js';
import type { InMemoryStore } from './store.js';

export function populatePart6DemoData(store: InMemoryStore): void {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const inDays = (days: number): string => {
    return new Date(now + days * day).toISOString().split('T')[0];
  };

  const pastDays = (days: number): string => {
    return new Date(now - days * day).toISOString().split('T')[0];
  };

  // -------------------------------------------------------------------------
  // 22 Additional Demo Applications (bringing total from 20 to 42)
  // -------------------------------------------------------------------------
  interface DemoAppDef {
    id: string;
    institutionName: string;
    type: ApplicationType;
    status: Status;
    domain: Domain;
    region: Region;
    lat: number;
    lng: number;
    createdDaysAgo: number;
    slaOffsetDays: number; // positive = future, negative = overdue
    locked?: boolean;
    area?: number;
    leaseExpiry?: string;
    fireNocExpiry?: string;
    returns?: ReturnRecord[];
  }

  const demoAppDefs: DemoAppDef[] = [
    // --- NORTH REGION ---
    {
      id: 'APP-DEMO-021',
      institutionName: 'Demo Chandigarh Polytechnic Institute (North)',
      type: 'EXTENSION_OF_APPROVAL', // ONLY_SCRUTINY
      status: 'SUBMITTED',
      domain: 'MECHANICAL',
      region: 'NORTH',
      lat: 30.7333,
      lng: 76.7794,
      createdDaysAgo: 1,
      slaOffsetDays: 20, // on time
      returns: [
        {
          id: 'RET-021-1',
          applicationId: 'APP-DEMO-021',
          fromStatus: 'SCRUTINY',
          toStatus: 'SUBMITTED',
          category: 'DOCUMENT_MISSING',
          reason: 'Demo: Registered building safety audit plan signature missing on page 4.',
          actor: 'officer.north@aicte.gov.in',
          timestamp: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
        },
      ],
    },
    {
      id: 'APP-DEMO-027',
      institutionName: 'Demo Lucknow Engineering Academy (North)',
      type: 'APPEAL', // EVC_SAC_SHC
      status: 'APPEAL_SHC',
      domain: 'CIVIL',
      region: 'NORTH',
      lat: 26.8467,
      lng: 80.9462,
      createdDaysAgo: 35,
      slaOffsetDays: 2, // approaching
    },
    {
      id: 'APP-DEMO-033',
      institutionName: 'Demo Roorkee Advanced Tech College (North)',
      type: 'INTAKE_CHANGE', // ONLY_EVC
      status: 'EVC_DONE',
      domain: 'CSE',
      region: 'NORTH',
      lat: 29.8543,
      lng: 77.888,
      createdDaysAgo: 18,
      slaOffsetDays: -3, // overdue
    },

    // --- SOUTH REGION ---
    {
      id: 'APP-DEMO-022',
      institutionName: 'Demo Chennai Institute of Smart Tech (South)',
      type: 'EXTENSION_OF_APPROVAL', // ONLY_SCRUTINY
      status: 'SCRUTINY',
      domain: 'CSE',
      region: 'SOUTH',
      lat: 13.0827,
      lng: 80.2707,
      createdDaysAgo: 4,
      slaOffsetDays: 1, // approaching (1 day left)
    },
    {
      id: 'APP-DEMO-028',
      institutionName: 'Demo Hyderabad Technical University (South)',
      type: 'APPEAL', // EVC_SAC_SHC
      status: 'APPEAL_SHC',
      domain: 'ELECTRICAL',
      region: 'SOUTH',
      lat: 17.385,
      lng: 78.4867,
      createdDaysAgo: 40,
      slaOffsetDays: -4, // overdue
    },
    {
      id: 'APP-DEMO-034',
      institutionName: 'Demo Bengaluru Polytechnic for Women (South)',
      type: 'INTAKE_CHANGE', // ONLY_EVC
      status: 'DECISION',
      domain: 'CSE',
      region: 'SOUTH',
      lat: 12.9716,
      lng: 77.5946,
      createdDaysAgo: 22,
      slaOffsetDays: 4, // on time
    },
    {
      id: 'APP-DEMO-040',
      institutionName: 'Demo Kochi Marine Engineering Institute (South)',
      type: 'APPEAL', // EVC_SAC_SHC
      status: 'APPEAL_SAC',
      domain: 'MECHANICAL',
      region: 'SOUTH',
      lat: 9.9312,
      lng: 76.2673,
      createdDaysAgo: 50,
      slaOffsetDays: -6, // overdue
    },

    // --- WEST REGION ---
    {
      id: 'APP-DEMO-023',
      institutionName: 'Demo Pune Advanced Polytechnic (West)',
      type: 'EXTENSION_OF_APPROVAL', // ONLY_SCRUTINY
      status: 'DEFICIENT',
      domain: 'CIVIL',
      region: 'WEST',
      lat: 18.5204,
      lng: 73.8567,
      createdDaysAgo: 10,
      slaOffsetDays: -2, // overdue
      locked: true,
      returns: [
        {
          id: 'RET-023-1',
          applicationId: 'APP-DEMO-023',
          fromStatus: 'DECISION',
          toStatus: 'DEFICIENT',
          category: 'COMPLIANCE',
          reason: 'Demo: Land ownership mutation certificate verification required by revenue officer.',
          actor: 'officer.west@aicte.gov.in',
          timestamp: new Date(now - 3 * day).toISOString(),
        },
      ],
    },
    {
      id: 'APP-DEMO-029',
      institutionName: 'Demo Nagpur Institute of Technology (West)',
      type: 'APPEAL', // EVC_SAC_SHC
      status: 'APPEAL_SAC',
      domain: 'CIVIL',
      region: 'WEST',
      lat: 21.1458,
      lng: 79.0882,
      createdDaysAgo: 45,
      slaOffsetDays: 3, // approaching
    },

    // --- EAST REGION ---
    {
      id: 'APP-DEMO-024',
      institutionName: 'Demo Kolkata Institute of Engineering (East)',
      type: 'EXTENSION_OF_APPROVAL', // ONLY_SCRUTINY
      status: 'DECISION',
      domain: 'ELECTRICAL',
      region: 'EAST',
      lat: 22.5726,
      lng: 88.3639,
      createdDaysAgo: 16,
      slaOffsetDays: 5, // on time
    },
    {
      id: 'APP-DEMO-030',
      institutionName: 'Demo Bhubaneswar Engineering Campus (East)',
      type: 'APPEAL', // EVC_SAC_SHC
      status: 'REJECTED',
      domain: 'MECHANICAL',
      region: 'EAST',
      lat: 20.2961,
      lng: 85.8245,
      createdDaysAgo: 60,
      slaOffsetDays: -15, // overdue
    },
    {
      id: 'APP-DEMO-035',
      institutionName: 'Demo Patna Polytechnic College (East)',
      type: 'NEW', // SCRUTINY_EVC
      status: 'DEFICIENT',
      domain: 'CIVIL',
      region: 'EAST',
      lat: 25.5941,
      lng: 85.1376,
      createdDaysAgo: 12,
      slaOffsetDays: 2, // approaching
      returns: [
        {
          id: 'RET-035-1',
          applicationId: 'APP-DEMO-035',
          fromStatus: 'SCRUTINY',
          toStatus: 'DEFICIENT',
          category: 'DEFICIENCY',
          reason: 'Demo: Cadre ratio deficiencies found in faculty roster.',
          actor: 'officer.east@aicte.gov.in',
          timestamp: new Date(now - 2 * day).toISOString(),
        },
      ],
    },
    {
      id: 'APP-DEMO-041',
      institutionName: 'Demo Ranchi Mining Engineering College (East)',
      type: 'NEW', // SCRUTINY_EVC
      status: 'APPROVED',
      domain: 'CIVIL',
      region: 'EAST',
      lat: 23.3441,
      lng: 85.3096,
      createdDaysAgo: 30,
      slaOffsetDays: -5,
    },

    // --- CENTRAL REGION ---
    {
      id: 'APP-DEMO-025',
      institutionName: 'Demo Bhopal Academy of Science & Tech (Central)',
      type: 'NEW', // SCRUTINY_EVC
      status: 'EVC_REQUIRED',
      domain: 'CSE',
      region: 'CENTRAL',
      lat: 23.2599,
      lng: 77.4126,
      createdDaysAgo: 24,
      slaOffsetDays: -8, // overdue (delayed EVC)
    },
    {
      id: 'APP-DEMO-031',
      institutionName: 'Demo Indore Institute of Technology (Central)',
      type: 'INTAKE_CHANGE', // ONLY_EVC
      status: 'SUBMITTED',
      domain: 'ELECTRICAL',
      region: 'CENTRAL',
      lat: 22.7196,
      lng: 75.8577,
      createdDaysAgo: 2,
      slaOffsetDays: 19, // on time
      returns: [
        {
          id: 'RET-031-1',
          applicationId: 'APP-DEMO-031',
          fromStatus: 'EVC_REQUIRED',
          toStatus: 'DEFICIENT',
          category: 'CLARIFICATION',
          reason: 'Demo: Clarification on computer lab square footage discrepancies.',
          actor: 'officer.central@aicte.gov.in',
          timestamp: new Date(now - 1 * day).toISOString(),
        },
      ],
    },
    {
      id: 'APP-DEMO-036',
      institutionName: 'Demo Raipur Technical Campus (Central)',
      type: 'NEW', // SCRUTINY_EVC
      status: 'APPROVED',
      domain: 'MECHANICAL',
      region: 'CENTRAL',
      lat: 21.2514,
      lng: 81.6296,
      createdDaysAgo: 28,
      slaOffsetDays: -3,
    },
    {
      id: 'APP-DEMO-042',
      institutionName: 'Demo Gwalior Institute of Technology (Central)',
      type: 'EXTENSION_OF_APPROVAL', // ONLY_SCRUTINY
      status: 'SCRUTINY',
      domain: 'CSE',
      region: 'CENTRAL',
      lat: 26.2183,
      lng: 78.1828,
      createdDaysAgo: 5,
      slaOffsetDays: 16,
    },

    // --- NORTH_EAST REGION ---
    {
      id: 'APP-DEMO-026',
      institutionName: 'Demo Guwahati Institute of Technology (North-East)',
      type: 'NEW', // SCRUTINY_EVC
      status: 'EVC_DONE',
      domain: 'ELECTRICAL',
      region: 'NORTH_EAST',
      lat: 26.1445,
      lng: 91.7362,
      createdDaysAgo: 15,
      slaOffsetDays: 6, // on time
    },
    {
      id: 'APP-DEMO-032',
      institutionName: 'Demo Shillong Polytechnic Campus (North-East)',
      type: 'INTAKE_CHANGE', // ONLY_EVC
      status: 'SCRUTINY',
      domain: 'CIVIL',
      region: 'NORTH_EAST',
      lat: 25.5788,
      lng: 91.8933,
      createdDaysAgo: 7,
      slaOffsetDays: -1, // overdue
    },
    {
      id: 'APP-DEMO-037',
      institutionName: 'Demo Imphal College of Engineering (North-East)',
      type: 'NEW', // SCRUTINY_EVC
      status: 'APPROVED',
      domain: 'CSE',
      region: 'NORTH_EAST',
      lat: 24.817,
      lng: 93.9368,
      createdDaysAgo: 32,
      slaOffsetDays: -6,
    },
    {
      id: 'APP-DEMO-038',
      institutionName: 'Demo Agartala Technical Institute (North-East)',
      type: 'APPEAL', // EVC_SAC_SHC
      status: 'REJECTED',
      domain: 'MECHANICAL',
      region: 'NORTH_EAST',
      lat: 23.8315,
      lng: 91.2868,
      createdDaysAgo: 48,
      slaOffsetDays: -12, // overdue
    },
    {
      id: 'APP-DEMO-039',
      institutionName: 'Demo Aizawl Engineering Academy (North-East)',
      type: 'APPEAL', // EVC_SAC_SHC
      status: 'APPEAL_SHC',
      domain: 'CIVIL',
      region: 'NORTH_EAST',
      lat: 23.7271,
      lng: 92.7176,
      createdDaysAgo: 25,
      slaOffsetDays: 3, // approaching
    },
  ];

  // Insert applications and basic ledger entries
  for (const def of demoAppDefs) {
    // Only insert if not already present
    // @ts-expect-error accessing private member
    if (store.applications.has(def.id)) continue;

    const createdAt = new Date(now - def.createdDaysAgo * day).toISOString();
    const slaDueAt = new Date(now + def.slaOffsetDays * day).toISOString();

    const app: Application = {
      id: def.id,
      institutionName: def.institutionName,
      type: def.type,
      status: def.status,
      createdAt,
      slaDueAt,
      extracted: {
        landAreaSqm: def.area ?? 9500,
        leaseEndDate: def.leaseExpiry ?? '2052-12-31',
        fireNocExpiry: def.fireNocExpiry ?? inDays(180),
      },
      deficiencies: [],
      locked: Boolean(def.locked),
      lat: def.lat,
      lng: def.lng,
      domain: def.domain,
      region: def.region,
      returns: def.returns,
      lastReturn: def.returns && def.returns.length > 0 ? def.returns[def.returns.length - 1] : undefined,
    };

    // @ts-expect-error accessing private member
    store.applications.set(app.id, app);

    // Initial creation ledger entry
    const e1 = createLedgerEntry({
      id: `LEDGER-${app.id}-1`,
      applicationId: app.id,
      eventType: 'APPLICATION_CREATED',
      actor: 'institution',
      payload: { institutionName: app.institutionName, type: app.type, demo: true },
      timestamp: createdAt,
      prevHash: GENESIS_HASH,
    });

    const entries = [e1];

    // If there are return records, add return ledger entries
    if (def.returns) {
      let prevHash = e1.hash;
      let count = 2;
      for (const ret of def.returns) {
        const retEntry = createLedgerEntry({
          id: `LEDGER-${app.id}-${count}`,
          applicationId: app.id,
          eventType: 'APPLICATION_RETURNED',
          actor: ret.actor,
          payload: {
            fromStatus: ret.fromStatus,
            toStatus: ret.toStatus,
            category: ret.category,
            reason: ret.reason,
            demo: true,
          },
          timestamp: ret.timestamp,
          prevHash,
        });
        prevHash = retEntry.hash;
        count += 1;
        entries.push(retEntry);
      }
    }

    // @ts-expect-error accessing private member
    store.ledger.set(app.id, entries);
  }

  // -------------------------------------------------------------------------
  // Compliance Documents across all Tiers & Expiry States
  // -------------------------------------------------------------------------
  interface DemoComplianceDef {
    id: string;
    applicationId: string;
    docType: 'LEASE_DEED' | 'FIRE_NOC' | 'LAND_RECORD';
    offsetDays: number;
    renewalStatus?: 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
  }

  const demoCompDefs: DemoComplianceDef[] = [
    // Tier 90 warning (e.g. 75 days remaining)
    { id: 'COMP-DEMO-TIER90-01', applicationId: 'APP-DEMO-021', docType: 'FIRE_NOC', offsetDays: 75 },
    { id: 'COMP-DEMO-TIER90-02', applicationId: 'APP-DEMO-026', docType: 'LEASE_DEED', offsetDays: 80 },

    // Tier 60 warning (e.g. 45 days remaining)
    { id: 'COMP-DEMO-TIER60-01', applicationId: 'APP-DEMO-022', docType: 'FIRE_NOC', offsetDays: 45 },
    { id: 'COMP-DEMO-TIER60-02', applicationId: 'APP-DEMO-027', docType: 'FIRE_NOC', offsetDays: 50 },

    // Tier 30 warning (e.g. 15 days remaining)
    { id: 'COMP-DEMO-TIER30-01', applicationId: 'APP-DEMO-024', docType: 'FIRE_NOC', offsetDays: 15 },
    { id: 'COMP-DEMO-TIER30-02', applicationId: 'APP-DEMO-032', docType: 'LEASE_DEED', offsetDays: 10 },

    // Overdue / Expired (negative days, locked)
    { id: 'COMP-DEMO-OVERDUE-01', applicationId: 'APP-DEMO-023', docType: 'FIRE_NOC', offsetDays: -12 },
    { id: 'COMP-DEMO-OVERDUE-02', applicationId: 'APP-DEMO-030', docType: 'LEASE_DEED', offsetDays: -45 },
    { id: 'COMP-DEMO-OVERDUE-03', applicationId: 'APP-DEMO-038', docType: 'FIRE_NOC', offsetDays: -20 },

    // Document with SUBMITTED renewal
    {
      id: 'COMP-DEMO-RENEWAL-SUBMITTED',
      applicationId: 'APP-DEMO-025',
      docType: 'FIRE_NOC',
      offsetDays: -5,
      renewalStatus: 'SUBMITTED',
    },
    // Document with VERIFIED renewal
    {
      id: 'COMP-DEMO-RENEWAL-VERIFIED',
      applicationId: 'APP-DEMO-028',
      docType: 'FIRE_NOC',
      offsetDays: 360,
      renewalStatus: 'VERIFIED',
    },
    // Document with REJECTED renewal
    {
      id: 'COMP-DEMO-RENEWAL-REJECTED',
      applicationId: 'APP-DEMO-034',
      docType: 'FIRE_NOC',
      offsetDays: -8,
      renewalStatus: 'REJECTED',
    },
  ];

  for (const cDef of demoCompDefs) {
    // @ts-expect-error accessing private member
    if (store.complianceDocuments.has(cDef.id)) continue;

    const expiryDate = cDef.offsetDays >= 0 ? inDays(cDef.offsetDays) : pastDays(Math.abs(cDef.offsetDays));
    const expiryState = computeExpiryState(expiryDate, new Date(now));

    const compDoc: ComplianceDocument = {
      id: cDef.id,
      applicationId: cDef.applicationId,
      docType: cDef.docType,
      expiryDate,
      ...expiryState,
      lastCheckedAt: new Date().toISOString(),
      renewalStatus: cDef.renewalStatus,
    };

    if (cDef.renewalStatus === 'SUBMITTED') {
      compDoc.renewalEvidence = {
        fileName: 'demo_renewed_fire_noc_2026.pdf',
        fileHash: '4a44dc15364204a80fe80e9039455cc1608281820fe2b24f1e5233ade67a4b8f',
        storageRef: '/uploads/demo_renewed_fire_noc_2026.pdf',
        submittedBy: 'demo.director@aicte.gov.in',
        submittedAt: new Date(now - 2 * day).toISOString(),
        proposedValidityDate: inDays(365),
      };
    } else if (cDef.renewalStatus === 'VERIFIED') {
      compDoc.renewalVerification = {
        officer: 'officer.south@aicte.gov.in',
        decision: 'VERIFIED',
        remarks: 'Demo: Renewal verified against state fire safety gazette. Validity extended.',
        timestamp: new Date(now - 1 * day).toISOString(),
      };
    } else if (cDef.renewalStatus === 'REJECTED') {
      compDoc.renewalVerification = {
        officer: 'officer.south@aicte.gov.in',
        decision: 'REJECTED',
        remarks: 'Demo: NOC certificate lacks authorized signature of Chief Fire Officer.',
        timestamp: new Date(now - 1 * day).toISOString(),
      };
    }

    // @ts-expect-error accessing private member
    store.complianceDocuments.set(compDoc.id, compDoc);
  }

  // -------------------------------------------------------------------------
  // Undertakings in EACH Status (across diverse applications)
  // -------------------------------------------------------------------------
  interface DemoUtDef {
    id: string;
    applicationId: string;
    status: 'PENDING' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED' | 'OVERDUE';
    conditionText: string;
    dueOffsetDays: number;
    officer: string;
    createdDaysAgo: number;
  }

  const demoUtDefs: DemoUtDef[] = [
    // PENDING
    {
      id: 'UT-DEMO-021-PEND',
      applicationId: 'APP-DEMO-021',
      status: 'PENDING',
      conditionText: 'Demo: Submit certified sewage treatment plant (STP) installation undertaking.',
      dueOffsetDays: 25,
      officer: 'officer.north@aicte.gov.in',
      createdDaysAgo: 5,
    },
    {
      id: 'UT-DEMO-027-PEND',
      applicationId: 'APP-DEMO-027',
      status: 'PENDING',
      conditionText: 'Demo: Provide affidavit of appointment of qualified physical director and librarian.',
      dueOffsetDays: 14,
      officer: 'officer.north@aicte.gov.in',
      createdDaysAgo: 6,
    },
    // SUBMITTED
    {
      id: 'UT-DEMO-022-SUB',
      applicationId: 'APP-DEMO-022',
      status: 'SUBMITTED',
      conditionText: 'Demo: Submit solar rooftop power generation agreement and grid sync certificate.',
      dueOffsetDays: 8,
      officer: 'officer.south@aicte.gov.in',
      createdDaysAgo: 7,
    },
    // VERIFIED
    {
      id: 'UT-DEMO-026-VER',
      applicationId: 'APP-DEMO-026',
      status: 'VERIFIED',
      conditionText: 'Demo: Submit registered land diversion (CLU) order issued by District Collector.',
      dueOffsetDays: 12,
      officer: 'officer.northeast@aicte.gov.in',
      createdDaysAgo: 15,
    },
    // REJECTED
    {
      id: 'UT-DEMO-024-REJ',
      applicationId: 'APP-DEMO-024',
      status: 'REJECTED',
      conditionText: 'Demo: Submit university affiliation approval letter for the current academic session.',
      dueOffsetDays: 4,
      officer: 'officer.east@aicte.gov.in',
      createdDaysAgo: 10,
    },
    // OVERDUE
    {
      id: 'UT-DEMO-025-OVR',
      applicationId: 'APP-DEMO-025',
      status: 'OVERDUE',
      conditionText: 'Demo: Submit emergency exit ramp audit compliance certificate.',
      dueOffsetDays: -6,
      officer: 'officer.central@aicte.gov.in',
      createdDaysAgo: 36,
    },
    {
      id: 'UT-DEMO-032-OVR',
      applicationId: 'APP-DEMO-032',
      status: 'OVERDUE',
      conditionText: 'Demo: Submit audited balance sheet and corpus endowment deposit certificate.',
      dueOffsetDays: -11,
      officer: 'officer.northeast@aicte.gov.in',
      createdDaysAgo: 40,
    },
  ];

  for (const utDef of demoUtDefs) {
    // @ts-expect-error accessing private member
    if (store.undertakings.has(utDef.id)) continue;

    const dueDate = utDef.dueOffsetDays >= 0 ? inDays(utDef.dueOffsetDays) : pastDays(Math.abs(utDef.dueOffsetDays));
    const createdAt = new Date(now - utDef.createdDaysAgo * day).toISOString();

    const ut: Undertaking = {
      id: utDef.id,
      applicationId: utDef.applicationId,
      conditionText: utDef.conditionText,
      dueDate,
      status: utDef.status,
      createdBy: utDef.officer,
      createdAt,
      updatedAt: createdAt,
    };

    // @ts-expect-error accessing private member
    store.undertakings.set(ut.id, ut);

    // If submitted, verified or rejected, attach evidence
    if (utDef.status === 'SUBMITTED' || utDef.status === 'VERIFIED' || utDef.status === 'REJECTED') {
      const evd: UndertakingEvidence = {
        id: `EVD-${utDef.id}`,
        undertakingId: utDef.id,
        fileName: `demo_evidence_${utDef.id.toLowerCase()}.pdf`,
        fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        storageRef: `/uploads/demo_evidence_${utDef.id.toLowerCase()}.pdf`,
        submittedBy: 'demo.director@aicte.gov.in',
        submittedAt: new Date(now - 2 * day).toISOString(),
      };
      // @ts-expect-error accessing private member
      store.evidence.set(utDef.id, [evd]);
    }

    if (utDef.status === 'VERIFIED') {
      const verif: UndertakingVerification = {
        id: `VER-${utDef.id}`,
        undertakingId: utDef.id,
        officer: utDef.officer,
        decision: 'VERIFIED',
        remarks: 'Demo: Certified proof checked and found in compliance with AICTE norms.',
        timestamp: new Date(now - 1 * day).toISOString(),
      };
      // @ts-expect-error accessing private member
      store.verifications.set(utDef.id, [verif]);
    } else if (utDef.status === 'REJECTED') {
      const verif: UndertakingVerification = {
        id: `VER-${utDef.id}`,
        undertakingId: utDef.id,
        officer: utDef.officer,
        decision: 'REJECTED',
        remarks: 'Demo: Attached affidavit missing stamp and signature of the university registrar.',
        timestamp: new Date(now - 1 * day).toISOString(),
      };
      // @ts-expect-error accessing private member
      store.verifications.set(utDef.id, [verif]);
    }
  }

  // -------------------------------------------------------------------------
  // Delayed EVC Inspections (Scheduling delayed & report submission delayed)
  // -------------------------------------------------------------------------
  if (!store.getInspections) return;

  // APP-DEMO-025: Inspection scheduled 12 days ago, but report submission delayed
  const insp025Id = 'INSP-DEMO-025';
  // @ts-expect-error accessing private member
  if (!store.inspections.has(insp025Id)) {
    const insp025: InspectionAssignment = {
      id: insp025Id,
      applicationId: 'APP-DEMO-025',
      institutionName: 'Demo Bhopal Academy of Science & Tech (Central)',
      domain: 'CSE',
      lat: 23.2599,
      lng: 77.4126,
      scheduledDate: pastDays(12),
      inspectors: [
        { id: 'INS-010', name: 'Prof. Ramesh Iyer', domain: 'ELECTRICAL', homeCity: 'Hyderabad, TS' },
        { id: 'INS-012', name: 'Dr. Harish Joshi', domain: 'CSE', homeCity: 'Ahmedabad, GJ' },
      ],
      status: 'SCHEDULED',
      source: 'fallback',
      reportDueAt: pastDays(7), // 7 days overdue for report!
    };
    // @ts-expect-error accessing private member
    store.inspections.set(insp025.id, insp025);
    // @ts-expect-error accessing private member
    const a25 = store.applications.get('APP-DEMO-025');
    if (a25) {
      a25.scheduledInspection = insp025;
      // @ts-expect-error accessing private member
      store.applications.set(a25.id, a25);
    }
  }

  // APP-DEMO-026: Completed inspection with report
  const insp026Id = 'INSP-DEMO-026';
  // @ts-expect-error accessing private member
  if (!store.inspections.has(insp026Id)) {
    const insp026: InspectionAssignment = {
      id: insp026Id,
      applicationId: 'APP-DEMO-026',
      institutionName: 'Demo Guwahati Institute of Technology (North-East)',
      domain: 'ELECTRICAL',
      lat: 26.1445,
      lng: 91.7362,
      scheduledDate: pastDays(3),
      inspectors: [
        { id: 'INS-006', name: 'Dr. Anand Kumar', domain: 'CIVIL', homeCity: 'Chennai, TN' },
        { id: 'INS-011', name: 'Dr. Deepa Mukherjee', domain: 'ELECTRICAL', homeCity: 'Kolkata, WB' },
      ],
      status: 'COMPLETED',
      source: 'fallback',
      report: {
        id: 'REP-DEMO-026',
        applicationId: 'APP-DEMO-026',
        inspectorId: 'INS-011',
        findings: {
          infrastructure: 'Modern laboratories and smart lecture halls verified.',
          faculty: 'Faculty cadre ratio of 1:15 satisfied.',
          labs: 'High-voltage and circuit design laboratories adequately equipped.',
          remarks: 'Recommend full approval.',
        },
        recommendation: 'RECOMMENDED',
        reportHash: 'b5c6d7e8f90123456789abcdef0123456789abcdef0123456789abcdef012345',
        submittedAt: new Date(now - 1 * day).toISOString(),
      },
    };
    // @ts-expect-error accessing private member
    store.inspections.set(insp026.id, insp026);
    // @ts-expect-error accessing private member
    const a26 = store.applications.get('APP-DEMO-026');
    if (a26) {
      a26.scheduledInspection = insp026;
      // @ts-expect-error accessing private member
      store.applications.set(a26.id, a26);
    }
  }

  // -------------------------------------------------------------------------
  // Alerts and Escalations at Each Escalation Level (Level 1, Level 2, Level 3)
  // -------------------------------------------------------------------------
  const demoEscalations: Escalation[] = [
    // Level 1: Stage SLA Overdue
    {
      id: 'ESC-DEMO-L1-001',
      applicationId: 'APP-DEMO-023',
      eventType: 'PENDENCY',
      level: 1,
      status: 'OPEN',
      createdAt: new Date(now - 1 * day).toISOString(),
      remarks: 'Demo Level 1 Escalation: Application review SLA has elapsed by 2 days.',
      region: 'WEST',
      recipientRole: 'OFFICER',
      reason: 'Application review is past its SLA due date. (Stage: DEFICIENT, Overdue)',
      institutionName: 'Demo Pune Advanced Polytechnic (West)',
    },
    // Level 2: EVC Report Delay
    {
      id: 'ESC-DEMO-L2-001',
      applicationId: 'APP-DEMO-025',
      eventType: 'REPORT_SUBMISSION',
      level: 2,
      status: 'OPEN',
      createdAt: new Date(now - 3 * day).toISOString(),
      remarks: 'Demo Level 2 Escalation: Inspection report has been delayed by 5 days.',
      region: 'CENTRAL',
      recipientRole: 'CHIEF',
      reason: 'EVC inspection report has not been submitted within regulatory turnaround.',
      institutionName: 'Demo Bhopal Academy of Science & Tech (Central)',
    },
    // Level 3: Document Expiry Critical
    {
      id: 'ESC-DEMO-L3-001',
      applicationId: 'APP-DEMO-030',
      eventType: 'DOCUMENT_EXPIRY',
      level: 3,
      status: 'OPEN',
      createdAt: new Date(now - 5 * day).toISOString(),
      remarks: 'Demo Level 3 Escalation: Critical compliance lease deed overdue by 45 days.',
      region: 'EAST',
      recipientRole: 'CHIEF',
      reason: 'Compliance document expired and remained unrenewed beyond 30 days.',
      institutionName: 'Demo Bhubaneswar Engineering Campus (East)',
    },
  ];

  for (const esc of demoEscalations) {
    // @ts-expect-error accessing private member
    if (!store.escalations.has(esc.id)) {
      // @ts-expect-error accessing private member
      store.escalations.set(esc.id, esc);
    }
  }

  // Matching Alert Logs for idempotency and audit logs
  const demoAlertLogs: AlertLog[] = [
    {
      id: 'LOG-DEMO-L1-001',
      eventId: 'APP-DEMO-023:PENDENCY',
      applicationId: 'APP-DEMO-023',
      eventType: 'PENDENCY',
      kind: 'ESCALATION',
      level: 1,
      dueDate: pastDays(2),
      region: 'WEST',
      recipientRole: 'OFFICER',
      recipientEmail: 'officer.west@aicte.gov.in',
      title: '[Vishwas] Escalation (Level 1): APP-DEMO-023',
      reason: 'Application review is past its SLA due date. (Stage: DEFICIENT, Overdue)',
      institutionName: 'Demo Pune Advanced Polytechnic (West)',
      createdAt: new Date(now - 1 * day).toISOString(),
      mailStatus: 'SENT',
      escalationId: 'ESC-DEMO-L1-001',
    },
    {
      id: 'LOG-DEMO-L2-001',
      eventId: 'APP-DEMO-025:REPORT_SUBMISSION',
      applicationId: 'APP-DEMO-025',
      eventType: 'REPORT_SUBMISSION',
      kind: 'ESCALATION',
      level: 2,
      dueDate: pastDays(5),
      region: 'CENTRAL',
      recipientRole: 'CHIEF',
      recipientEmail: 'chief@aicte.gov.in',
      title: '[Vishwas] Escalation (Level 2): APP-DEMO-025',
      reason: 'EVC inspection report has not been submitted within regulatory turnaround.',
      institutionName: 'Demo Bhopal Academy of Science & Tech (Central)',
      createdAt: new Date(now - 3 * day).toISOString(),
      mailStatus: 'SENT',
      escalationId: 'ESC-DEMO-L2-001',
    },
    {
      id: 'LOG-DEMO-L3-001',
      eventId: 'APP-DEMO-030:DOCUMENT_EXPIRY',
      applicationId: 'APP-DEMO-030',
      eventType: 'DOCUMENT_EXPIRY',
      kind: 'ESCALATION',
      level: 3,
      dueDate: pastDays(45),
      region: 'EAST',
      recipientRole: 'CHIEF',
      recipientEmail: 'chief@aicte.gov.in',
      title: '[Vishwas] Escalation (Level 3): APP-DEMO-030',
      reason: 'Compliance document expired and remained unrenewed beyond 30 days.',
      institutionName: 'Demo Bhubaneswar Engineering Campus (East)',
      createdAt: new Date(now - 5 * day).toISOString(),
      mailStatus: 'SENT',
      escalationId: 'ESC-DEMO-L3-001',
    },
  ];

  for (const log of demoAlertLogs) {
    // @ts-expect-error accessing private member
    if (!store.alertLogs.has(log.id)) {
      // @ts-expect-error accessing private member
      store.alertLogs.set(log.id, log);
    }
  }
}
