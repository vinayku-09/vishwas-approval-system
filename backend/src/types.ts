export type ApplicationType =
  | 'NEW'
  | 'EXTENSION_OF_APPROVAL'
  | 'INTAKE_CHANGE'
  | 'APPEAL';

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
  // Optional due date for a pending authenticity/verification check (Phase C).
  authenticityDueAt?: string; // YYYY-MM-DD
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
  // Alert routing metadata (Phase C)
  recipientRole?: UserRole;
  region?: Region;
  institutionName?: string;
  eventId?: string;
  escalationId?: string;
}

export type Domain = 'CIVIL' | 'CSE' | 'ELECTRICAL' | 'MECHANICAL';

export type Region =
  | 'NORTH'
  | 'SOUTH'
  | 'EAST'
  | 'WEST'
  | 'CENTRAL'
  | 'NORTH_EAST'
  | 'ALL';

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
  // Optional due date for the post-inspection EVC report (Phase C alerts).
  reportDueAt?: string; // YYYY-MM-DD
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

export type ApprovalRouteId =
  | 'ONLY_SCRUTINY'
  | 'SCRUTINY_EVC'
  | 'EVC_SAC_SHC'
  | 'ONLY_EVC';

export type ReturnCategory =
  | 'DEFICIENCY'
  | 'DOCUMENT_MISSING'
  | 'CLARIFICATION'
  | 'COMPLIANCE'
  | 'OTHER';

export interface ReturnRecord {
  id: string;
  applicationId: string;
  fromStatus: Status;
  toStatus: Status;
  category: ReturnCategory;
  reason: string;
  actor: string;
  timestamp: string;
}

export interface ReturnCategoryOption {
  id: ReturnCategory;
  label: string;
  description: string;
}

export interface RouteState {
  id: ApprovalRouteId;
  name: string;
  description: string;
  stages: Status[];
  currentStage: Status;
  currentIndex: number;
  nextStatuses: Status[];
  autoNextStatus?: Status;
  returnTargets: Status[];
  returnCategories: ReturnCategoryOption[];
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
  region?: Region;
  scheduledInspection?: InspectionAssignment;
  // Optional due date for a pending institutional undertaking (Phase C alerts).
  undertakingDueAt?: string; // YYYY-MM-DD
  // Part 2: derived route metadata is attached to API responses, not persisted.
  route?: RouteState;
  returns?: ReturnRecord[];
  lastReturn?: ReturnRecord;
}

export type NoticeType = 'RETURN' | 'DECISION' | 'ROUTE_ASSIGNMENT';

export interface StandardNotice {
  id: string;
  applicationId: string;
  noticeType: NoticeType;
  reference: string;
  subject: string;
  body: string;
  issuedAt: string;
  issuedBy: string;
  issuedTo: string;
  category?: ReturnCategory;
}

export interface CaseSummaryTimelineItem {
  id: string;
  at: string;
  eventType: string;
  actor: string;
  status?: Status;
}

export interface CaseSummary {
  generatedAt: string;
  readOnly: true;
  safeguardNotice: string;
  application: Application;
  route: RouteState;
  timeline: CaseSummaryTimelineItem[];
  returns: ReturnRecord[];
  signoff?: SignoffRecord;
  documents: DocumentMetadata[];
  complianceDocuments: ComplianceDocument[];
  inspections: InspectionAssignment[];
  notices: Notification[];
  ledger: {
    totalEntries: number;
    valid: boolean;
    brokenAt?: string | null;
    message: string;
  };
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
  region?: Region;
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

// ---------------------------------------------------------------------------
// Phase C: Alert & Escalation Engine
// ---------------------------------------------------------------------------

export type AlertEventType =
  | 'PENDENCY'
  | 'EVC_SCHEDULING'
  | 'REPORT_SUBMISSION'
  | 'UNDERTAKING'
  | 'DOCUMENT_EXPIRY'
  | 'DOCUMENT_AUTHENTICITY';

export type AlertKind = 'REMINDER' | 'ESCALATION';

export type EscalationStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export type MailStatus = 'SENT' | 'FAILED' | 'SKIPPED';

export type MailMode = 'live' | 'log' | 'ethereal';

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

/**
 * Immutable record of one alert dispatch attempt. The id is the idempotency
 * key (`eventId:kind:level`) so reruns can never dispatch the same alert twice.
 */
export interface AlertLog {
  id: string;
  eventId: string;
  applicationId: string;
  eventType: AlertEventType;
  kind: AlertKind;
  level: number;
  dueDate: string;
  region: Region;
  recipientRole: UserRole;
  recipientEmail?: string;
  title: string;
  reason: string;
  institutionName?: string;
  createdAt: string;
  mailStatus: MailStatus;
  mailError?: string;
  escalationId?: string;
  notificationId?: string;
}

export interface AlertItem {
  eventId: string;
  applicationId: string;
  eventType: AlertEventType;
  dueDate: string;
  reason: string;
  region: Region;
  institutionName?: string;
}
