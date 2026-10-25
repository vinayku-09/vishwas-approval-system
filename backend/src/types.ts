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

export type DocumentType = 'LEASE_DEED' | 'FIRE_NOC' | 'LAND_RECORD';

export interface DocumentMetadata {
  id: string;
  applicationId: string;
  docType: DocumentType;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  storageUrl: string;
  uploadedAt: string; // ISO timestamp
}

export interface ExtractedFieldValue<T> {
  value?: T;
  confidence: number; // 0 to 1
  sourcePage?: number;
  evidenceText: string; // short quote under 200 chars
  needsReview?: boolean;
}

export interface ExtractionResult {
  source: 'real' | 'mock';
  model?: string;
  extractedAt: string;
  fields: {
    landAreaSqm: ExtractedFieldValue<number>;
    leaseStartDate: ExtractedFieldValue<string>;
    leaseEndDate: ExtractedFieldValue<string>;
    fireNocExpiry: ExtractedFieldValue<string>;
  };
}

export type DeficiencySeverity = 'CRITICAL' | 'MAJOR' | 'MINOR';

export interface Deficiency {
  id: string;
  message: string;
  clause: string;
  severity: DeficiencySeverity;
  evidence?: string;
  confidence?: number;
  sourcePage?: number;
  needsHumanReview?: boolean;
}

export type SignoffDecision = 'CONFIRM' | 'OVERRIDE';

export interface SignoffRecord {
  id: string;
  applicationId: string;
  officer: string;
  decision: SignoffDecision;
  deficiencyIds: string[];
  remarks?: string;
  timestamp: string;
}

export type ExpiryState = 'VALID' | 'WARNING' | 'OVERDUE';
export type WarningTier = 90 | 60 | 30;

export interface ComplianceDocument {
  id: string;
  applicationId: string;
  docType: DocumentType;
  expiryDate: string; // YYYY-MM-DD
  state: ExpiryState;
  tier?: WarningTier;
  daysRemaining: number;
  lastCheckedAt: string;
}

export interface Notification {
  id: string;
  applicationId: string;
  title: string;
  message: string;
  type: 'WARNING' | 'OVERDUE' | 'INFO';
  read: boolean;
  createdAt: string;
  idempotencyKey: string;
}

export type Domain = 'CIVIL' | 'CSE' | 'ELECTRICAL' | 'MECHANICAL';

export interface Inspector {
  id: string;
  name: string;
  domain: Domain;
  homeCity: string;
  lat: number;
  lng: number;
  availableDates: string[]; // YYYY-MM-DD
}

export interface Affiliation {
  id: string;
  inspectorId: string;
  institutionName: string;
  reason: string;
}

export interface EvcReportFindings {
  infrastructure: string;
  faculty: string;
  labs: string;
  remarks: string;
}

export interface EvcReport {
  id: string;
  applicationId: string;
  inspectorId: string;
  findings: EvcReportFindings;
  recommendation: 'RECOMMENDED' | 'DEFICIENT';
  reportHash: string;
  submittedAt: string;
}

export interface InspectionAssignment {
  id: string;
  applicationId: string;
  institutionName: string;
  domain: Domain;
  lat: number;
  lng: number;
  scheduledDate: string; // YYYY-MM-DD
  inspectors: { id: string; name: string; domain: Domain; homeCity: string }[];
  status: 'SCHEDULED' | 'COMPLETED';
  report?: EvcReport;
  source: 'ortools' | 'fallback' | 'manual';
}

export interface RouteStop {
  applicationId: string;
  institutionName: string;
  lat: number;
  lng: number;
  arrivalTime: string;
  departureTime: string;
  distanceFromPrevKm: number;
}

export interface InspectorDayRoute {
  inspectorId: string;
  inspectorName: string;
  homeCity: string;
  date: string;
  stops: RouteStop[];
  totalKm: number;
}

export interface UnassignedVisit {
  applicationId: string;
  institutionName: string;
  reason: string;
}

export interface ExcludedConflict {
  inspectorId: string;
  inspectorName: string;
  institutionName: string;
  reason: string;
}

export interface OptimizationResult {
  source: 'ortools' | 'fallback';
  routes: InspectorDayRoute[];
  baselineKm: number;
  optimizedKm: number;
  percentSaved: number;
  unassigned: UnassignedVisit[];
  excludedConflictsCount: number;
  excludedConflicts: ExcludedConflict[];
  assignments: InspectionAssignment[];
}

export interface Application {
  id: string;
  institutionName: string;
  type: ApplicationType;
  status: Status;
  createdAt: string; // ISO timestamp
  slaDueAt: string;  // ISO timestamp
  extracted?: ExtractedFields;
  extractedDetails?: ExtractionResult;
  deficiencies: Deficiency[];
  signoff?: SignoffRecord;
  locked?: boolean;
  lat?: number;
  lng?: number;
  domain?: Domain;
  scheduledInspection?: InspectionAssignment;
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
  evidence?: string;
  confidence?: number;
  sourcePage?: number;
  needsHumanReview?: boolean;
}

export interface SlaInfo {
  status: 'ON_TIME' | 'WARNING' | 'OVERDUE';
  label: 'On time' | 'Warning' | 'Overdue';
  color: string;
  remainingDays: number;
  elapsedPercent: number;
}
