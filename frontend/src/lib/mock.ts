import {
  Application,
  ComplianceDocument,
  DocumentMetadata,
  LedgerEntry,
  Notification,
} from './types';

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

const inDays = (days: number) => {
  const d = new Date(now + days * day);
  return d.toISOString().split('T')[0];
};

const pastDays = (days: number) => {
  const d = new Date(now - days * day);
  return d.toISOString().split('T')[0];
};

export const INITIAL_MOCK_APPLICATIONS: Application[] = [
  {
    id: 'APP-2024-001',
    institutionName: 'Delhi Institute of Advanced Technology & AI',
    type: 'NEW',
    status: 'SUBMITTED',
    createdAt: new Date(now - 2 * day).toISOString(),
    slaDueAt: new Date(now + 19 * day).toISOString(),
    extracted: {
      landAreaSqm: 8200,
      leaseEndDate: '2048-12-31',
      fireNocExpiry: '2028-06-30',
    },
    extractedDetails: {
      source: 'mock',
      model: 'mock-vision-extractor',
      extractedAt: new Date(now - 1 * day).toISOString(),
      fields: {
        landAreaSqm: {
          value: 8200,
          confidence: 0.95,
          sourcePage: 2,
          evidenceText: 'Total contiguous campus land area measures 8,200 sq.m under registered deed.',
          needsReview: false,
        },
        leaseStartDate: {
          value: '2020-01-01',
          confidence: 0.92,
          sourcePage: 1,
          evidenceText: 'Lease executed on 1st January 2020 for a period of 30 years.',
          needsReview: false,
        },
        leaseEndDate: {
          value: '2048-12-31',
          confidence: 0.89,
          sourcePage: 4,
          evidenceText: 'Lease validity extends up to 31st December 2048.',
          needsReview: false,
        },
        fireNocExpiry: {
          value: '2028-06-30',
          confidence: 0.91,
          sourcePage: 1,
          evidenceText: 'Fire safety certificate valid through 30 June 2028.',
          needsReview: false,
        },
      },
    },
    deficiencies: [],
    locked: false,
  },
  {
    id: 'APP-2024-002',
    institutionName: 'Kaveri Polytechnic & Technical Campus',
    type: 'EXTENSION_OF_APPROVAL',
    status: 'DEFICIENT',
    createdAt: new Date(now - 16 * day).toISOString(),
    slaDueAt: new Date(now + 5 * day).toISOString(),
    extracted: {
      landAreaSqm: 4200,
      leaseEndDate: pastDays(120),
      fireNocExpiry: pastDays(45),
    },
    extractedDetails: {
      source: 'mock',
      model: 'mock-vision-extractor',
      extractedAt: new Date(now - 14 * day).toISOString(),
      fields: {
        landAreaSqm: {
          value: 4200,
          confidence: 0.94,
          sourcePage: 2,
          evidenceText: 'Net campus area certified as 4,200 sq.m.',
          needsReview: false,
        },
        leaseStartDate: {
          value: '1994-01-01',
          confidence: 0.91,
          sourcePage: 1,
          evidenceText: 'Original deed registered on January 1, 1994.',
          needsReview: false,
        },
        leaseEndDate: {
          value: pastDays(120),
          confidence: 0.88,
          sourcePage: 4,
          evidenceText: `Expired on ${pastDays(120)}.`,
          needsReview: false,
        },
        fireNocExpiry: {
          value: pastDays(45),
          confidence: 0.86,
          sourcePage: 1,
          evidenceText: `Fire NOC validity lapsed on ${pastDays(45)}.`,
          needsReview: false,
        },
      },
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
        message: `Land lease deed expired on ${pastDays(120)}`,
        clause: 'AICTE APH 2024-25 Clause 4.3',
        severity: 'CRITICAL',
        confidence: 0.88,
        sourcePage: 4,
        evidence: `Expired on ${pastDays(120)}.`,
      },
      {
        id: 'DEF-NOC-002',
        message: `Fire and Life Safety NOC expired on ${pastDays(45)}`,
        clause: 'AICTE APH 2024-25 Clause 5.2',
        severity: 'CRITICAL',
        confidence: 0.86,
        sourcePage: 1,
        evidence: `Fire NOC validity lapsed on ${pastDays(45)}.`,
      },
    ],
    locked: true,
  },
  {
    id: 'APP-2024-003',
    institutionName: 'Himalayan Institute of Technology & Engineering',
    type: 'INTAKE_CHANGE',
    status: 'EVC_DONE',
    createdAt: new Date(now - 18 * day).toISOString(),
    slaDueAt: new Date(now + 3 * day).toISOString(),
    extracted: {
      landAreaSqm: 14500,
      leaseEndDate: '2055-09-30',
      fireNocExpiry: inDays(25), // Expiring in 25 days (WARNING)
    },
    extractedDetails: {
      source: 'mock',
      model: 'mock-vision-extractor',
      extractedAt: new Date(now - 14 * day).toISOString(),
      fields: {
        landAreaSqm: {
          value: 14500,
          confidence: 0.96,
          sourcePage: 3,
          evidenceText: 'Total land area is 14,500 sq.m in hill/urban designation.',
          needsReview: false,
        },
        leaseStartDate: {
          value: '2025-01-01',
          confidence: 0.90,
          sourcePage: 1,
          evidenceText: 'Lease commencement date 2025.',
          needsReview: false,
        },
        leaseEndDate: {
          value: '2055-09-30',
          confidence: 0.92,
          sourcePage: 5,
          evidenceText: 'Valid through September 30, 2055.',
          needsReview: false,
        },
        fireNocExpiry: {
          value: inDays(25),
          confidence: 0.65, // Low confidence -> needs human review
          sourcePage: 1,
          evidenceText: `Provisional fire NOC note expiring on ${inDays(25)}.`,
          needsReview: true,
        },
      },
    },
    deficiencies: [],
    locked: false,
  },
  {
    id: 'APP-2024-004',
    institutionName: 'Apex National Academy of Engineering & Computing',
    type: 'EXTENSION_OF_APPROVAL',
    status: 'APPROVED',
    createdAt: new Date(now - 25 * day).toISOString(),
    slaDueAt: new Date(now - 4 * day).toISOString(),
    extracted: {
      landAreaSqm: 28000,
      leaseEndDate: '2060-01-01',
      fireNocExpiry: '2030-05-10',
    },
    deficiencies: [],
    locked: false,
  },
];

export const INITIAL_MOCK_DOCUMENTS: Record<string, DocumentMetadata[]> = {
  'APP-2024-001': [
    {
      id: 'DOC-APP-2024-001-1',
      applicationId: 'APP-2024-001',
      docType: 'LEASE_DEED',
      fileName: 'registered_lease_deed_diat.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2458900,
      sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      storageUrl: '/uploads/registered_lease_deed_diat.pdf',
      uploadedAt: new Date(now - 2 * day).toISOString(),
    },
    {
      id: 'DOC-APP-2024-001-2',
      applicationId: 'APP-2024-001',
      docType: 'FIRE_NOC',
      fileName: 'fire_safety_noc_delhi.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1042300,
      sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
      storageUrl: '/uploads/fire_safety_noc_delhi.pdf',
      uploadedAt: new Date(now - 2 * day).toISOString(),
    },
  ],
};

export const INITIAL_MOCK_COMPLIANCE: Record<string, ComplianceDocument[]> = {
  'APP-2024-001': [
    {
      id: 'COMP-APP-2024-001-LEASE',
      applicationId: 'APP-2024-001',
      docType: 'LEASE_DEED',
      expiryDate: '2048-12-31',
      state: 'VALID',
      daysRemaining: 8800,
      lastCheckedAt: new Date().toISOString(),
    },
    {
      id: 'COMP-APP-2024-001-FIRE',
      applicationId: 'APP-2024-001',
      docType: 'FIRE_NOC',
      expiryDate: '2028-06-30',
      state: 'VALID',
      daysRemaining: 1300,
      lastCheckedAt: new Date().toISOString(),
    },
  ],
  'APP-2024-002': [
    {
      id: 'COMP-APP-2024-002-LEASE',
      applicationId: 'APP-2024-002',
      docType: 'LEASE_DEED',
      expiryDate: pastDays(120),
      state: 'OVERDUE',
      daysRemaining: -120,
      lastCheckedAt: new Date().toISOString(),
    },
    {
      id: 'COMP-APP-2024-002-FIRE',
      applicationId: 'APP-2024-002',
      docType: 'FIRE_NOC',
      expiryDate: pastDays(45),
      state: 'OVERDUE',
      daysRemaining: -45,
      lastCheckedAt: new Date().toISOString(),
    },
  ],
  'APP-2024-003': [
    {
      id: 'COMP-APP-2024-003-LEASE',
      applicationId: 'APP-2024-003',
      docType: 'LEASE_DEED',
      expiryDate: '2055-09-30',
      state: 'VALID',
      daysRemaining: 10500,
      lastCheckedAt: new Date().toISOString(),
    },
    {
      id: 'COMP-APP-2024-003-FIRE',
      applicationId: 'APP-2024-003',
      docType: 'FIRE_NOC',
      expiryDate: inDays(25),
      state: 'WARNING',
      tier: 30,
      daysRemaining: 25,
      lastCheckedAt: new Date().toISOString(),
    },
  ],
};

export const INITIAL_MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'NOTIF-APP-2024-002-OVERDUE',
    applicationId: 'APP-2024-002',
    title: 'Application Locked: Document Expired',
    message: 'Fire safety certificate has expired. Application APP-2024-002 is locked.',
    type: 'OVERDUE',
    read: false,
    createdAt: new Date(now - 1 * day).toISOString(),
    idempotencyKey: 'COMP-APP-2024-002-FIRE-OVERDUE',
  },
  {
    id: 'NOTIF-APP-2024-003-WARNING-30',
    applicationId: 'APP-2024-003',
    title: 'Action Required: Fire Safety NOC Expiring Soon',
    message: 'Fire Safety NOC for Himalayan Institute expires in 25 days. Renewal required before order.',
    type: 'WARNING',
    read: false,
    createdAt: new Date(now - 3 * day).toISOString(),
    idempotencyKey: 'COMP-APP-2024-003-FIRE-30',
  },
];

export const INITIAL_MOCK_LEDGER: Record<string, LedgerEntry[]> = {
  'APP-2024-001': [
    {
      id: 'LEDGER-APP-2024-001-1',
      applicationId: 'APP-2024-001',
      eventType: 'APPLICATION_CREATED',
      actor: 'institution',
      payload: {
        institutionName: 'Delhi Institute of Advanced Technology & AI',
        type: 'NEW',
        initialStatus: 'SUBMITTED',
      },
      timestamp: new Date(now - 2 * day).toISOString(),
      prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
      hash: '3f7b9e28a1c64d850931e982f63810a9c687e24b532900f6825e36472b53fca8',
    },
  ],
  'APP-2024-002': [
    {
      id: 'LEDGER-APP-2024-002-1',
      applicationId: 'APP-2024-002',
      eventType: 'APPLICATION_CREATED',
      actor: 'institution',
      payload: { institutionName: 'Kaveri Polytechnic & Technical Campus', type: 'EXTENSION_OF_APPROVAL' },
      timestamp: new Date(now - 16 * day).toISOString(),
      prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
      hash: '7c8d9e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d',
    },
    {
      id: 'LEDGER-APP-2024-002-2',
      applicationId: 'APP-2024-002',
      eventType: 'APPLICATION_LOCKED',
      actor: 'system',
      payload: {
        reason: 'Expired compliance document detected',
        expiryDate: pastDays(45),
      },
      timestamp: new Date(now - 1 * day).toISOString(),
      prevHash: '7c8d9e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d',
      hash: '8f9e0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f',
    },
  ],
};
