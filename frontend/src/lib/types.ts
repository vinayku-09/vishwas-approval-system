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
  leaseEndDate?: string;
  fireNocExpiry?: string;
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
  uploadedAt: string;
}

export interface ExtractedFieldValue<T> {
  value?: T;
  confidence: number;
  sourcePage?: number;
  evidenceText: string;
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
  expiryDate: string;
  state: ExpiryState;
  tier?: WarningTier;
  daysRemaining: number;
  lastCheckedAt: string;
  authenticityDueAt?: string;
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
  recipientRole?: UserRole;
  region?: Region;
  institutionName?: string;
  eventId?: string;
  escalationId?: string;
}

export type Region =
  | 'NORTH'
  | 'SOUTH'
  | 'EAST'
  | 'WEST'
  | 'CENTRAL'
  | 'NORTH_EAST'
  | 'ALL';

export type AlertEventType =
  | 'PENDENCY'
  | 'EVC_SCHEDULING'
  | 'REPORT_SUBMISSION'
  | 'UNDERTAKING'
  | 'DOCUMENT_EXPIRY'
  | 'DOCUMENT_AUTHENTICITY';

export type EscalationStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface Escalation {
  id: string;
  applicationId: string;
  eventType: AlertEventType;
  level: number;
  status: EscalationStatus;
  createdAt: string;
  remarks: string;
  region: Region;
  recipientRole: UserRole;
  reason: string;
  institutionName?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export interface AlertLog {
  id: string;
  eventId: string;
  applicationId: string;
  eventType: AlertEventType;
  kind: 'REMINDER' | 'ESCALATION';
  level: number;
  dueDate: string;
  region: Region;
  recipientRole: UserRole;
  recipientEmail?: string;
  title: string;
  reason: string;
  institutionName?: string;
  createdAt: string;
  mailStatus: 'SENT' | 'FAILED' | 'SKIPPED';
  mailError?: string;
  escalationId?: string;
  notificationId?: string;
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  service: string;
  version: string;
  mail?: { mode: string; from: string };
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
  reportDueAt?: string;
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
  createdAt: string;
  slaDueAt: string;
  extracted?: ExtractedFields;
  extractedDetails?: ExtractionResult;
  deficiencies: Deficiency[];
  signoff?: SignoffRecord;
  locked?: boolean;
  lat?: number;
  lng?: number;
  domain?: Domain;
  region?: Region;
  undertakingDueAt?: string;
  scheduledInspection?: InspectionAssignment;
}

export interface LedgerEntry {
  id: string;
  applicationId: string;
  eventType: string;
  actor: string;
  payload: Record<string, unknown>;
  timestamp: string;
  prevHash: string;
  hash: string;
}

export type Role =
  | 'INSTITUTION'
  | 'OFFICER'
  | 'COMMITTEE'
  | 'CHIEF'
  | 'institution'
  | 'officer'
  | 'committee'
  | 'chief';

export type UserRole = 'INSTITUTION' | 'OFFICER' | 'COMMITTEE' | 'CHIEF';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  institutionName?: string;
  inspectorId?: string;
  createdAt?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  institutionName?: string;
  inspectorId?: string;
  region?: Region;
}

export interface AuthTokenPayload {
  sub: string;
  role: UserRole;
  name: string;
  email: string;
  institutionName?: string;
  inspectorId?: string;
  region?: Region;
  iat?: number;
  exp?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface VerificationResult {
  valid: boolean;
  brokenAt?: string | null;
  totalEntries: number;
  message: string;
}

export interface SlaInfo {
  status: 'ON_TIME' | 'WARNING' | 'OVERDUE';
  label: 'On time' | 'Warning' | 'Overdue';
  color: string;
  remainingDays: number;
  elapsedPercent: number;
}
