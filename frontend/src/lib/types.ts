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
  renewalStatus?: 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
  renewalEvidence?: {
    fileName: string;
    fileHash: string;
    storageRef: string;
    submittedBy: string;
    submittedAt: string;
    proposedValidityDate?: string;
  };
  renewalVerification?: {
    officer: string;
    decision: 'VERIFIED' | 'REJECTED';
    remarks?: string;
    timestamp: string;
  };
}

export type UndertakingStatus = 'PENDING' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED' | 'OVERDUE';

export interface Undertaking {
  id: string;
  applicationId: string;
  conditionText: string;
  dueDate: string;
  status: UndertakingStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  evidence?: UndertakingEvidence[];
  verifications?: UndertakingVerification[];
}

export interface UndertakingEvidence {
  id: string;
  undertakingId: string;
  fileName: string;
  fileHash: string;
  storageRef: string;
  submittedBy: string;
  submittedAt: string;
}

export interface UndertakingVerification {
  id: string;
  undertakingId: string;
  officer: string;
  decision: 'VERIFIED' | 'REJECTED';
  remarks: string;
  timestamp: string;
}

export interface VerificationQueueData {
  undertakings: Undertaking[];
  renewals: (ComplianceDocument & { institutionName?: string; region?: string })[];
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
  route?: RouteState;
  returns?: ReturnRecord[];
  lastReturn?: ReturnRecord;
  returnReply?: {
    returnId: string;
    remarks: string;
    repliedAt: string;
    actor: string;
  };
}

export interface StandardNotice {
  id: string;
  applicationId: string;
  noticeType: 'RETURN' | 'DECISION' | 'ROUTE_ASSIGNMENT';
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
  region?: Region;
  phone?: string;
  emailVerified?: boolean;
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
  phone?: string;
  emailVerified?: boolean;
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
  role?: UserRole;
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

export type PendencyStatus = 'On time' | 'Approaching' | 'Overdue';

export type DashboardRoleView =
  | 'regional_officer'
  | 'bureau_officer'
  | 'committee'
  | 'head_office'
  | 'institution';

export interface PendingCaseRow {
  applicationId: string;
  institutionName: string;
  status: Status;
  region?: string;
  routeId: string;
  currentStage: string;
  ageDays: number;
  daysLeft: number;
  pendencyStatus: PendencyStatus | string;
  ageingBucket: string;
}

export interface PendencyDashboard {
  note: string;
  generatedAt: string;
  countsByStage: Record<string, number>;
  countsByRegion: Record<string, number>;
  ageingBuckets: Record<string, number>;
  workloadPerOfficer: Record<string, number>;
  workloadPerCommittee: Record<string, number>;
  bottleneckStages: Array<{ stage: string; count: number }>;
  pendingCases: PendingCaseRow[];
  total: number;
  roleView: DashboardRoleView;
}

export interface EvcBoardItem {
  applicationId: string;
  institutionName: string;
  status: Status;
  region?: string;
  scheduledDate?: string;
  reportDueAt?: string;
  daysOverdue: number;
  delayed: boolean;
}

export interface EvcBoard {
  note: string;
  generatedAt: string;
  awaitingEvc: number;
  scheduled: number;
  completed: number;
  delayed: number;
  items: EvcBoardItem[];
  roleView: DashboardRoleView;
}

// ---------------------------------------------------------------------------
// Part 6: Reports, Audit View & Configuration Types
// ---------------------------------------------------------------------------

export type ReportType =
  | 'application-pendency'
  | 'evc-status'
  | 'undertaking-compliance'
  | 'document-validity'
  | 'overdue-cases'
  | 'region-performance';

export interface ReportColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
}

export interface ReportResult {
  reportType: ReportType;
  title: string;
  generatedAt: string;
  filters: {
    region?: string;
    fromDate?: string;
    toDate?: string;
    [key: string]: string | undefined;
  };
  summary: Record<string, string | number>;
  columns: ReportColumn[];
  rows: Record<string, any>[];
}

export interface ReportMeta {
  id: ReportType;
  title: string;
  description: string;
}

export interface AuditTrailEntry extends LedgerEntry {
  institutionName: string;
  region: string;
  verification: {
    valid: boolean;
    brokenAt?: string | null;
    totalEntries: number;
    message?: string;
  };
}

export interface AuditTrailResponse {
  totalMatching: number;
  summary: {
    totalEntries: number;
    applicationsAudited: number;
    verifiedChains: number;
    brokenChains: number;
    allEventTypes: string[];
    allActors: string[];
  };
  entries: AuditTrailEntry[];
}

export interface ConfigResponse {
  readOnly: boolean;
  policyStatus: string;
  generalNotice: string;
  accessedBy: {
    role: string;
    name: string;
    region: string;
  };
  routes: {
    label: string;
    notice: string;
    items: Array<{
      id: string;
      name: string;
      description: string;
      applicationTypes: string[];
      stages: Status[];
      requiresEvc: boolean;
      decisionStage: string;
      status: string;
    }>;
  };
  stageTimelines: {
    label: string;
    notice: string;
    defaultDaysPerStage: Record<string, number>;
    routeDaysPerStage: Record<string, Record<string, number>>;
    slaWindowsDays: Record<string, number>;
    warningThresholdFraction: number;
    approachingDaysLeft: number;
    ageingBucketEdgesDays: readonly number[];
    minLandAreaSqmNorm: number;
    status: string;
  };
  reminderTiers: {
    label: string;
    notice: string;
    documentExpiryTiersDays: readonly number[];
    reminderOffsetsDays: readonly number[];
    reminderCadenceDescription: string;
    defaultRecipientRoles: Record<string, string>;
    status: string;
  };
  escalationMatrix: {
    label: string;
    notice: string;
    matrix: Array<{
      eventType: string;
      level: number;
      delayDays: number;
      delayDescription: string;
      recipientRole: string;
      region: string;
      status: string;
    }>;
    hierarchy: Array<{ level: number; target: string; delay: string }>;
    status: string;
  };
  renewalPeriods: {
    label: string;
    notice: string;
    statutoryValidityDaysByDocType: Record<string, number>;
    defaultRenewalValidityDays: number;
    defaultUndertakingDurationDays: number;
    categoryDurationsDays: Record<string, number>;
    status: string;
  };
}

export type ProfileStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'VERIFIED' | 'DEFICIENT';

export interface ProfileMember {
  name: string;
  role: string;
  idProofNumber: string;
}

export interface ProfileBankDetails {
  accountHolder: string;
  bankName: string;
  branch: string;
  accountNumber?: string;
  maskedAccountNumber?: string;
  ifsc: string;
}

export interface ProfileFdrDetails {
  fdrNumber: string;
  bankName: string;
  amount: number;
  issueDate: string;
  maturityDate: string;
  documentId?: string;
  documentSha256?: string;
}

export interface ProfileLandDetails {
  landType: 'OWNED' | 'RENTED';
  totalAreaSqm: number;
  landAreaSqm?: number;
  khasraOrSurveyNumber?: string;
  leaseStartDate?: string;
  leaseEndDate?: string;
  lessorName?: string;
  documents: Array<{
    docType: string;
    documentId: string;
    sha256?: string;
    fileName?: string;
  }>;
}

export interface InstitutionProfile {
  id: string;
  institutionId: string;
  institutionName: string;
  status: ProfileStatus;
  state: string;
  region: Region;
  college: {
    name: string;
    fullAddress: string;
    pin: string;
    state: string;
    district: string;
  };
  contactPerson: {
    name: string;
    designation: string;
    mobile: string;
    email: string;
  };
  trust: {
    name: string;
    registrationNumber: string;
    members: ProfileMember[];
  };
  bank: ProfileBankDetails;
  fdr: ProfileFdrDetails;
  land: ProfileLandDetails;
  statutoryPdfs: Array<{
    docType: string;
    documentId: string;
    sha256?: string;
    fileName?: string;
  }>;
  flaggedItems?: Array<{
    item: string;
    reason: string;
    severity: 'WARNING' | 'CRITICAL';
  }>;
  submittedAt?: string;
  updatedAt: string;
}

export interface RiskSignal {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  score: number;
  description: string;
  evidence?: Record<string, unknown>;
}

export interface RiskEvaluationResult {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  disclaimer: string;
  signals: RiskSignal[];
}

export type ProposalType =
  | 'NEW_INSTITUTION'
  | 'EOA'
  | 'NEW_COURSE'
  | 'INTAKE_INCREASE'
  | 'CLOSURE';

export type ProposalStatus = 'DRAFT' | 'SUBMITTED' | 'REVIEWED';

export interface ProposedBranch {
  id: string;
  proposalId?: string;
  level: string;
  program: string;
  course: string;
  affiliatingBody: string;
  currentIntake: number;
  expectedIntake: number;
  shift: string | number;
  facultySanctioned: number;
  facultyAvailable: number;
  facultyPayCompliant: boolean;
  labs: string[];
  builtUpArea: number;
  libraryAvailable: boolean;
  affiliationNocAvailable?: boolean;
  affiliationNocDocId?: string;
  affiliationNocSha256?: string;
}

export type BranchCheckRule =
  | 'FACULTY_RATIO'
  | 'FACULTY_PAY_COMPLIANCE'
  | 'LAND_SUFFICIENCY'
  | 'LABS_INFRASTRUCTURE'
  | 'AFFILIATION_NOC'
  | 'INTAKE_LIMIT'
  | 'DOCUMENT_VALIDITY';

export interface BranchRuleResult {
  rule: BranchCheckRule;
  status: 'MET' | 'DEFICIENT' | 'REVIEW';
  computed: string | number;
  required: string | number;
  reason: string;
}

export interface BranchCheckSummary {
  branchId: string;
  course: string;
  level: string;
  overallStatus: 'MET' | 'DEFICIENT' | 'REVIEW';
  results: BranchRuleResult[];
}

export interface ProposalDetermination {
  decision: 'NO_CONCERN' | 'ASK_CLARIFICATION' | 'REFER';
  remarks: string;
  officerId: string;
  officerEmail?: string;
  officerRegion?: Region;
  determinedAt: string;
}

export interface CourseProposal {
  id: string;
  institutionId: string;
  applicationId: string;
  institutionName?: string;
  region: Region;
  type: ProposalType;
  status: ProposalStatus;
  branches: ProposedBranch[];
  checkResults?: BranchCheckSummary[];
  determination?: ProposalDetermination;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
}

export type StorageMode = 'local' | 'postgres' | 'blob';

export interface StoredFileRecord {
  id: string;
  pathname: string;
  sha256: string;
  size: number;
  contentType: string;
  institutionId: string;
  region: string;
  isDraft: boolean;
  uploadedAt: string;
  storageMode: StorageMode;
  metadata?: Record<string, unknown>;
}

/** Returned by POST /files on a successful server-side upload */
export interface UploadedFileResult {
  id: string;
  sha256: string;
  size: number;
  pathname: string;
  storageMode: StorageMode;
}

export interface AiScrutinyAnalysis {
  summary: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  faults: string[];
  whatIsWrong: string[];
  suggestedChanges: string[];
  recommendedDecision: 'NO_CONCERN' | 'ASK_CLARIFICATION' | 'REFER';
  draftOfficerRemarks: string;
  statutoryCitations?: string[];
}

