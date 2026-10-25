export type ApplicationType =
  | 'NEW'
  | 'EXTENSION_OF_APPROVAL'
  | 'INTAKE_CHANGE';

export type Status =
  | 'SUBMITTED'
  | 'SCRUTINY'
  | 'DEFICIENT'
  | 'EVC_REQUIRED'
  | 'EVC_DONE'
  | 'DECISION'
  | 'APPROVED'
  | 'REJECTED'
  | 'APPEAL_SHC'
  | 'APPEAL_SAC';

export interface ExtractedFields {
  landAreaSqm?: number;
  leaseEndDate?: string; // ISO date string YYYY-MM-DD
  fireNocExpiry?: string; // ISO date string YYYY-MM-DD
}

export type DeficiencySeverity = 'CRITICAL' | 'MAJOR' | 'MINOR';

export interface Deficiency {
  message: string;
  clause: string;
  severity: DeficiencySeverity;
}

export interface Application {
  id: string;
  institutionName: string;
  type: ApplicationType;
  status: Status;
  createdAt: string; // ISO timestamp
  slaDueAt: string;  // ISO timestamp
  extracted?: ExtractedFields;
  deficiencies: Deficiency[];
}

export interface LedgerEntry {
  id: string;
  applicationId: string;
  eventType: string;
  actor: string;
  payload: Record<string, unknown>;
  timestamp: string; // ISO timestamp
  prevHash: string;
  hash: string;
}

export type Role = 'institution' | 'officer' | 'committee';

export interface RuleResult {
  passed: boolean;
  message: string;
  clause: string;
  severity: DeficiencySeverity;
}

export interface SlaInfo {
  status: 'ON_TIME' | 'WARNING' | 'OVERDUE';
  label: 'On time' | 'Warning' | 'Overdue';
  color: string;
  remainingDays: number;
  elapsedPercent: number;
}
