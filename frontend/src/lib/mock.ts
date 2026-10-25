import { Application, ApplicationType, ExtractedFields, LedgerEntry, Status, VerificationResult } from './types';

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

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
    deficiencies: [],
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
      leaseEndDate: '2024-01-15',
      fireNocExpiry: '2024-02-28',
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
      fireNocExpiry: '2028-11-15',
    },
    deficiencies: [],
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
      eventType: 'SCRUTINY_EVALUATED_DEFICIENT',
      actor: 'officer',
      payload: {
        previousStatus: 'SCRUTINY',
        newStatus: 'DEFICIENT',
        deficienciesCount: 3,
      },
      timestamp: new Date(now - 14 * day).toISOString(),
      prevHash: '7c8d9e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d',
      hash: '8f9e0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f',
    },
  ],
  'APP-2024-003': [
    {
      id: 'LEDGER-APP-2024-003-1',
      applicationId: 'APP-2024-003',
      eventType: 'APPLICATION_CREATED',
      actor: 'institution',
      payload: { institutionName: 'Himalayan Institute of Technology & Engineering', type: 'INTAKE_CHANGE' },
      timestamp: new Date(now - 18 * day).toISOString(),
      prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
      hash: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
    },
    {
      id: 'LEDGER-APP-2024-003-2',
      applicationId: 'APP-2024-003',
      eventType: 'SCRUTINY_PASSED',
      actor: 'officer',
      payload: { status: 'EVC_REQUIRED' },
      timestamp: new Date(now - 14 * day).toISOString(),
      prevHash: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
      hash: '2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c',
    },
    {
      id: 'LEDGER-APP-2024-003-3',
      applicationId: 'APP-2024-003',
      eventType: 'EVC_INSPECTION_COMPLETED',
      actor: 'committee',
      payload: {
        status: 'EVC_DONE',
        committeeHead: 'Prof. S. R. Sharma (IIT Delhi)',
        recommendation: 'Recommended for intake expansion (60 to 120 seats)',
      },
      timestamp: new Date(now - 2 * day).toISOString(),
      prevHash: '2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c',
      hash: '3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d',
    },
  ],
  'APP-2024-004': [
    {
      id: 'LEDGER-APP-2024-004-1',
      applicationId: 'APP-2024-004',
      eventType: 'APPLICATION_CREATED',
      actor: 'institution',
      payload: { institutionName: 'Apex National Academy of Engineering & Computing', type: 'EXTENSION_OF_APPROVAL' },
      timestamp: new Date(now - 25 * day).toISOString(),
      prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
      hash: '4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e',
    },
    {
      id: 'LEDGER-APP-2024-004-2',
      applicationId: 'APP-2024-004',
      eventType: 'SCRUTINY_PASSED',
      actor: 'officer',
      payload: { status: 'DECISION' },
      timestamp: new Date(now - 20 * day).toISOString(),
      prevHash: '4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e',
      hash: '5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f',
    },
    {
      id: 'LEDGER-APP-2024-004-3',
      applicationId: 'APP-2024-004',
      eventType: 'EXECUTIVE_COMMITTEE_APPROVAL',
      actor: 'officer',
      payload: {
        status: 'APPROVED',
        approvalOrderNo: 'AICTE/NWRO/2024/APP-004-EOA',
      },
      timestamp: new Date(now - 8 * day).toISOString(),
      prevHash: '5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f',
      hash: '6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a',
    },
  ],
};
