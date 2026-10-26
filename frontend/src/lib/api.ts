import {
  Application,
  ApplicationType,
  AlertEventType,
  AuthUser,
  ComplianceDocument,
  Deficiency,
  DocumentMetadata,
  DocumentType,
  Escalation,
  EscalationStatus,
  EvcReport,
  EvcReportFindings,
  ExtractedFields,
  ExtractionResult,
  HealthStatus,
  InspectionAssignment,
  Inspector,
  LedgerEntry,
  LoginRequest,
  LoginResponse,
  Notification,
  OptimizationResult,
  Role,
  SignoffDecision,
  SignoffRecord,
  Status,
  UserRole,
  VerificationResult,
} from './types';
import {
  INITIAL_MOCK_APPLICATIONS,
  INITIAL_MOCK_COMPLIANCE,
  INITIAL_MOCK_DOCUMENTS,
  INITIAL_MOCK_INSPECTIONS,
  INITIAL_MOCK_INSPECTORS,
  INITIAL_MOCK_AFFILIATIONS,
  INITIAL_MOCK_LEDGER,
  INITIAL_MOCK_NOTIFICATIONS,
  INITIAL_MOCK_ESCALATIONS,
} from './mock';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

let localApplications: Application[] = [...INITIAL_MOCK_APPLICATIONS];
let localDocuments: Record<string, DocumentMetadata[]> = JSON.parse(JSON.stringify(INITIAL_MOCK_DOCUMENTS));
let localCompliance: Record<string, ComplianceDocument[]> = JSON.parse(JSON.stringify(INITIAL_MOCK_COMPLIANCE));
let localNotifications: Notification[] = [...INITIAL_MOCK_NOTIFICATIONS];
let localLedger: Record<string, LedgerEntry[]> = JSON.parse(JSON.stringify(INITIAL_MOCK_LEDGER));
let localInspections: InspectionAssignment[] = JSON.parse(JSON.stringify(INITIAL_MOCK_INSPECTIONS));
let localEscalations: Escalation[] = JSON.parse(JSON.stringify(INITIAL_MOCK_ESCALATIONS));

const TOKEN_KEY = 'aicte_token';
const USER_KEY = 'aicte_user';
const ROLE_KEY = 'aicte_role';
const SESSION_EVENT = 'aicte_session_changed';
const ROLE_EVENT = 'aicte_role_changed';
const DEMO_EVENT = 'aicte_demo_changed';

const USER_ROLES: UserRole[] = ['INSTITUTION', 'OFFICER', 'COMMITTEE', 'CHIEF'];
const DEMO_ROLES = ['institution', 'officer', 'committee', 'chief'] as const;

let demoModeActive = false;
const demoModeListeners = new Set<(active: boolean) => void>();

/**
 * Raised when the backend is reachable but rejects the request (401/403/4xx/5xx).
 * Callers must surface this to the user; it never triggers demo-data fallback.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** True when a network-level failure forced local demo data for this session. */
export function isDemoModeActive(): boolean {
  return demoModeActive;
}

export function subscribeDemoMode(listener: (active: boolean) => void): () => void {
  demoModeListeners.add(listener);
  return () => demoModeListeners.delete(listener);
}

function setDemoMode(active: boolean): void {
  if (demoModeActive === active) return;
  demoModeActive = active;
  demoModeListeners.forEach((listener) => listener(active));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(DEMO_EVENT));
  }
}

function markDemoMode(): void {
  setDemoMode(true);
}

export function clearDemoMode(): void {
  setDemoMode(false);
}

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && USER_ROLES.includes(value as UserRole);
}

function readStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (
      !parsed ||
      typeof parsed.id !== 'string' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.name !== 'string' ||
      !isUserRole(parsed.role)
    ) {
      return null;
    }
    return parsed as AuthUser;
  } catch {
    return null;
  }
}

function dispatchSessionChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(SESSION_EVENT));
  window.dispatchEvent(new Event(ROLE_EVENT));
}

export function getStoredUser(): AuthUser | null {
  return readStoredUser();
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getStoredToken() && readStoredUser());
}

export function getStoredRole(): Role {
  if (typeof window === 'undefined') return 'institution';
  const user = readStoredUser();
  if (user) return user.role.toLowerCase() as Role;
  const role = localStorage.getItem(ROLE_KEY) as Role;
  if (role && DEMO_ROLES.includes(role as (typeof DEMO_ROLES)[number])) {
    return role;
  }
  return 'institution';
}

export function setStoredRole(role: Role): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ROLE_KEY, role.toLowerCase());
  window.dispatchEvent(new Event(ROLE_EVENT));
}

export function setSession(response: LoginResponse): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, response.token);
  localStorage.setItem(USER_KEY, JSON.stringify(response.user));
  localStorage.setItem(ROLE_KEY, response.user.role.toLowerCase());
  clearDemoMode();
  dispatchSessionChanged();
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(ROLE_KEY);
  dispatchSessionChanged();
}

export function getSessionEventName(): string {
  return SESSION_EVENT;
}

/**
 * Authenticates against the backend and persists the returned JWT.
 * Unlike data reads, login failures are returned to the caller and never
 * silently replaced with demo data.
 */
export async function login(
  credentials: LoginRequest
): Promise<{ data: LoginResponse | null; error?: string; status?: number }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const body = (await res.json().catch(() => ({}))) as Partial<LoginResponse> & {
      error?: string;
    };

    if (!res.ok || !body.token || !body.user) {
      return {
        data: null,
        error: body.error || `Login failed (HTTP ${res.status})`,
        status: res.status,
      };
    }

    setSession(body as LoginResponse);
    return { data: body as LoginResponse };
  } catch (err: unknown) {
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? 'Login timed out. Is the backend running?'
        : err instanceof Error
        ? err.message
        : String(err);
    return { data: null, error: message };
  }
}

export const DEMO_ACCOUNTS: Record<
  (typeof DEMO_ROLES)[number],
  LoginRequest & { label: string; name: string }
> = {
  institution: {
    email: 'delhi.tech@aicte.gov.in',
    password: 'Password123!',
    label: 'Institution',
    name: 'Delhi Institute of Advanced Technology & AI',
  },
  officer: {
    email: 'officer@aicte.gov.in',
    password: 'Password123!',
    label: 'Scrutiny Officer',
    name: 'Dr. Arvind Kumar',
  },
  committee: {
    email: 'committee@aicte.gov.in',
    password: 'Password123!',
    label: 'EVC Committee',
    name: 'Dr. Sunita Patil',
  },
  chief: {
    email: 'chief@aicte.gov.in',
    password: 'Password123!',
    label: 'AICTE Chief',
    name: 'Prof. Anil Sahasrabudhe',
  },
};

export async function loginAsDemoRole(
  role: Role
): Promise<{ data: LoginResponse | null; error?: string; status?: number }> {
  const key = role.toLowerCase() as (typeof DEMO_ROLES)[number];
  const account = DEMO_ACCOUNTS[key] || DEMO_ACCOUNTS.institution;
  return login({ email: account.email, password: account.password });
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T; isDemo: boolean; error?: string }> {
  const role = getStoredRole();
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    headers.set('x-role', role);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? 'Request timed out'
        : err instanceof Error
        ? err.message
        : String(err);
    markDemoMode();
    console.warn(
      `[Backend API Unreachable] Falling back to local mock data for ${path}:`,
      message
    );
    return { data: null as unknown as T, isDemo: true, error: message };
  } finally {
    clearTimeout(timeout);
  }

  // Any HTTP response means the backend is reachable, so demo mode no longer applies.
  clearDemoMode();

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const errJson = (body || {}) as { error?: string };
    if (res.status === 401 && token) {
      clearSession();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        const next = `${window.location.pathname}${window.location.search}`;
        window.location.assign(`/login?expired=1&next=${encodeURIComponent(next)}`);
      }
    }
    throw new ApiError(
      res.status,
      errJson.error || `HTTP error ${res.status}: ${res.statusText}`
    );
  }

  return { data: body as T, isDemo: false };
}

// 1. List applications
export async function getApplications(filters?: {
  status?: Status;
  type?: ApplicationType;
}): Promise<{ data: Application[]; isDemo: boolean }> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.type) params.set('type', filters.type);

  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await request<Application[]>(`/applications${query}`);

  if (!res.isDemo && res.data) {
    return { data: res.data, isDemo: false };
  }

  let list = [...localApplications];
  if (filters?.status) list = list.filter((a) => a.status === filters.status);
  if (filters?.type) list = list.filter((a) => a.type === filters.type);
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return { data: list, isDemo: true };
}

// 2. Get application details
export async function getApplication(id: string): Promise<{ data: Application | null; isDemo: boolean }> {
  const res = await request<Application>(`/applications/${id}`);
  if (!res.isDemo && res.data) {
    return { data: res.data, isDemo: false };
  }

  const found = localApplications.find((a) => a.id === id) || null;
  return { data: found ? JSON.parse(JSON.stringify(found)) : null, isDemo: true };
}

// 3. Create application
export async function createApplication(data: {
  institutionName: string;
  type: ApplicationType;
  extracted?: ExtractedFields;
}): Promise<{ data: Application; isDemo: boolean }> {
  const res = await request<Application>('/applications', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (!res.isDemo && res.data) {
    return { data: res.data, isDemo: false };
  }

  const now = new Date();
  const nextId = `APP-2024-${String(localApplications.length + 1).padStart(3, '0')}`;
  const newApp: Application = {
    id: nextId,
    institutionName: data.institutionName,
    type: data.type,
    status: 'SUBMITTED',
    createdAt: now.toISOString(),
    slaDueAt: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    extracted: data.extracted || {},
    deficiencies: [],
    locked: false,
  };

  localApplications = [newApp, ...localApplications];
  return { data: newApp, isDemo: true };
}

// 4. Upload document (Real multipart post)
export async function uploadDocument(
  applicationId: string,
  file: File,
  docType: DocumentType
): Promise<{ data: DocumentMetadata; isDemo: boolean }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('docType', docType);

  const res = await request<DocumentMetadata>(`/applications/${applicationId}/documents`, {
    method: 'POST',
    body: formData,
  });

  if (!res.isDemo && res.data) {
    return { data: res.data, isDemo: false };
  }

  // Mock upload fallback
  const mockDoc: DocumentMetadata = {
    id: `DOC-${applicationId}-${Date.now().toString().slice(-4)}`,
    applicationId,
    docType,
    fileName: file.name,
    mimeType: file.type || 'application/pdf',
    sizeBytes: file.size,
    sha256: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
    storageUrl: `/uploads/${file.name}`,
    uploadedAt: new Date().toISOString(),
  };

  const currentDocs = localDocuments[applicationId] || [];
  localDocuments[applicationId] = [...currentDocs, mockDoc];

  return { data: mockDoc, isDemo: true };
}

// 5. Get uploaded documents
export async function getDocuments(applicationId: string): Promise<{ data: DocumentMetadata[]; isDemo: boolean }> {
  const res = await request<DocumentMetadata[]>(`/applications/${applicationId}/documents`);
  if (!res.isDemo && res.data) {
    return { data: res.data, isDemo: false };
  }

  const docs = localDocuments[applicationId] || [];
  return { data: docs, isDemo: true };
}

// 6. Run AI Extraction & Scrutiny Rules
export async function runExtract(applicationId: string): Promise<{
  data: {
    application: Application;
    extraction: ExtractionResult;
    deficiencies: Deficiency[];
    allPassed: boolean;
  };
  isDemo: boolean;
}> {
  const res = await request<{
    application: Application;
    extraction: ExtractionResult;
    deficiencies: Deficiency[];
    allPassed: boolean;
  }>(`/applications/${applicationId}/extract`, {
    method: 'POST',
  });

  if (!res.isDemo && res.data) {
    return { data: res.data, isDemo: false };
  }

  const appIdx = localApplications.findIndex((a) => a.id === applicationId);
  if (appIdx === -1) throw new Error('Application not found');

  const app = localApplications[appIdx];
  const landArea = app.extracted?.landAreaSqm ?? 7500;
  const leaseEndDate = app.extracted?.leaseEndDate ?? '2045-12-31';
  const fireNocExpiry = app.extracted?.fireNocExpiry ?? '2028-06-30';

  const extraction: ExtractionResult = {
    source: 'mock',
    model: 'mock-vision-extractor',
    extractedAt: new Date().toISOString(),
    fields: {
      landAreaSqm: {
        value: landArea,
        confidence: 0.95,
        sourcePage: 2,
        evidenceText: `Campus plot area verified as ${landArea.toLocaleString()} sq.m.`,
        needsReview: false,
      },
      leaseStartDate: {
        value: '2020-01-01',
        confidence: 0.92,
        sourcePage: 1,
        evidenceText: 'Lease entered on 1 January 2020.',
        needsReview: false,
      },
      leaseEndDate: {
        value: leaseEndDate,
        confidence: 0.88,
        sourcePage: 4,
        evidenceText: `Lease expires on ${leaseEndDate}.`,
        needsReview: false,
      },
      fireNocExpiry: {
        value: fireNocExpiry,
        confidence: 0.86,
        sourcePage: 1,
        evidenceText: `Fire NOC active until ${fireNocExpiry}.`,
        needsReview: false,
      },
    },
  };

  const deficiencies: Deficiency[] = [];
  if (landArea < 6000) {
    deficiencies.push({
      id: 'DEF-LAND-MOCK',
      message: `Land area ${landArea} sq.m is below required 6000 sq.m`,
      clause: 'AICTE APH Clause 4.1',
      severity: 'CRITICAL',
      evidence: `Survey plan indicates net educational plot area of ${landArea} sq.m.`,
      confidence: 0.95,
      sourcePage: 2,
    });
  }

  const nextStatus: Status = deficiencies.length > 0 ? 'DEFICIENT' : (app.type === 'NEW' ? 'EVC_REQUIRED' : 'DECISION');
  const updatedApp: Application = {
    ...app,
    status: nextStatus,
    extractedDetails: extraction,
    deficiencies,
  };
  localApplications[appIdx] = updatedApp;

  return {
    data: {
      application: updatedApp,
      extraction,
      deficiencies,
      allPassed: deficiencies.length === 0,
    },
    isDemo: true,
  };
}

// 7. Human Officer Sign-off (CONFIRM or OVERRIDE)
export async function recordSignoff(
  applicationId: string,
  data: {
    decision: SignoffDecision;
    deficiencyIds: string[];
    remarks?: string;
  }
): Promise<{ data: { success: boolean; signoff: SignoffRecord; application: Application }; isDemo: boolean }> {
  const res = await request<{ success: boolean; signoff: SignoffRecord; application: Application }>(
    `/applications/${applicationId}/signoff`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );

  if (!res.isDemo && res.data) {
    return { data: res.data, isDemo: false };
  }

  const appIdx = localApplications.findIndex((a) => a.id === applicationId);
  if (appIdx === -1) throw new Error('Application not found');

  const signoff: SignoffRecord = {
    id: `SIGNOFF-${applicationId}-${Date.now().toString().slice(-4)}`,
    applicationId,
    officer: getStoredRole(),
    decision: data.decision,
    deficiencyIds: data.deficiencyIds,
    remarks: data.remarks || '',
    timestamp: new Date().toISOString(),
  };

  localApplications[appIdx].signoff = signoff;
  return {
    data: { success: true, signoff, application: localApplications[appIdx] },
    isDemo: true,
  };
}

// 8. Advance workflow state
export async function advanceApplication(
  id: string,
  to: Status,
  remarks?: string,
  overrideRemarks?: string
): Promise<{ data: Application; isDemo: boolean }> {
  const res = await request<Application>(`/applications/${id}/advance`, {
    method: 'POST',
    body: JSON.stringify({ to, remarks, overrideRemarks }),
  });

  if (!res.isDemo && res.data) {
    return { data: res.data, isDemo: false };
  }

  const appIndex = localApplications.findIndex((a) => a.id === id);
  if (appIndex === -1) throw new Error('Application not found');

  const app = localApplications[appIndex];
  if (app.locked && !overrideRemarks) {
    throw new Error('Application is locked due to expired compliance document(s). Officer override with remarks required.');
  }

  if (to === 'REJECTED' && app.signoff?.decision !== 'CONFIRM') {
    throw new Error('Officer sign-off required before advancing to REJECTED.');
  }

  const updatedApp: Application = { ...app, status: to };
  localApplications[appIndex] = updatedApp;

  return { data: updatedApp, isDemo: true };
}

// 9. Get compliance documents & lock status
export async function getCompliance(
  applicationId: string
): Promise<{ data: { applicationId: string; locked: boolean; documents: ComplianceDocument[] }; isDemo: boolean }> {
  const res = await request<{ applicationId: string; locked: boolean; documents: ComplianceDocument[] }>(
    `/applications/${applicationId}/compliance`
  );

  if (!res.isDemo && res.data) {
    return { data: res.data, isDemo: false };
  }

  const app = localApplications.find((a) => a.id === applicationId);
  const docs = localCompliance[applicationId] || [];
  return {
    data: {
      applicationId,
      locked: app?.locked || false,
      documents: docs,
    },
    isDemo: true,
  };
}

// 10. Notifications
export async function getNotifications(): Promise<{ data: Notification[]; isDemo: boolean }> {
  const res = await request<Notification[]>('/notifications');
  if (!res.isDemo && res.data) {
    return { data: res.data, isDemo: false };
  }
  return { data: localNotifications, isDemo: true };
}

export async function markNotificationRead(id: string): Promise<{ data: { success: boolean }; isDemo: boolean }> {
  const res = await request<{ success: boolean }>(`/notifications/${id}/read`, {
    method: 'POST',
  });

  if (!res.isDemo && res.data) {
    return { data: res.data, isDemo: false };
  }

  const n = localNotifications.find((item) => item.id === id);
  if (n) n.read = true;
  return { data: { success: true }, isDemo: true };
}

// 10b. Escalations (Phase C)
export async function getEscalations(filters?: {
  status?: EscalationStatus;
  eventType?: AlertEventType;
}): Promise<{ data: Escalation[]; isDemo: boolean }> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.eventType) params.set('eventType', filters.eventType);
  const query = params.toString() ? `?${params.toString()}` : '';

  const res = await request<{ escalations: Escalation[]; total: number }>(
    `/escalations${query}`
  );

  if (!res.isDemo && res.data) {
    return { data: res.data.escalations, isDemo: false };
  }

  let list = [...localEscalations];
  if (filters?.status) list = list.filter((e) => e.status === filters.status);
  if (filters?.eventType) list = list.filter((e) => e.eventType === filters.eventType);
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return { data: list, isDemo: true };
}

export async function acknowledgeEscalation(
  id: string
): Promise<{ data: Escalation; isDemo: boolean; error?: string }> {
  const res = await request<{ success: boolean; escalation: Escalation }>(
    `/escalations/${encodeURIComponent(id)}/acknowledge`,
    { method: 'POST' }
  );

  if (!res.isDemo && res.data) {
    return { data: res.data.escalation, isDemo: false };
  }

  const escalation = localEscalations.find((e) => e.id === id);
  if (!escalation) {
    return { data: null as unknown as Escalation, isDemo: true, error: 'Escalation not found' };
  }
  escalation.status = 'ACKNOWLEDGED';
  escalation.acknowledgedAt = new Date().toISOString();
  return { data: { ...escalation }, isDemo: true };
}

export async function resolveEscalation(
  id: string,
  remarks: string
): Promise<{ data: Escalation; isDemo: boolean; error?: string }> {
  if (!remarks.trim()) {
    return {
      data: null as unknown as Escalation,
      isDemo: true,
      error: 'Remarks are required to resolve an escalation',
    };
  }

  const res = await request<{ success: boolean; escalation: Escalation }>(
    `/escalations/${encodeURIComponent(id)}/resolve`,
    { method: 'POST', body: JSON.stringify({ remarks }) }
  );

  if (!res.isDemo && res.data) {
    return { data: res.data.escalation, isDemo: false };
  }

  const escalation = localEscalations.find((e) => e.id === id);
  if (!escalation) {
    return { data: null as unknown as Escalation, isDemo: true, error: 'Escalation not found' };
  }
  escalation.status = 'RESOLVED';
  escalation.remarks = remarks.trim();
  escalation.resolvedAt = new Date().toISOString();
  return { data: { ...escalation }, isDemo: true };
}

// 10c. Health / mail mode
export async function getHealth(): Promise<{ data: HealthStatus | null; isDemo: boolean }> {
  const res = await request<HealthStatus>('/health');
  if (!res.isDemo && res.data) {
    return { data: res.data, isDemo: false };
  }
  return { data: null, isDemo: true };
}

// 11. Ledger inspection & verification
export async function getLedger(applicationId: string): Promise<{ data: LedgerEntry[]; isDemo: boolean }> {
  const res = await request<LedgerEntry[]>(`/ledger/${applicationId}`);
  if (!res.isDemo && res.data) {
    return { data: res.data, isDemo: false };
  }
  return { data: localLedger[applicationId] || [], isDemo: true };
}

export async function verifyLedger(
  applicationId: string
): Promise<{ data: VerificationResult; isDemo: boolean }> {
  const res = await request<VerificationResult>(`/ledger/${applicationId}/verify`);
  if (!res.isDemo && res.data) {
    return { data: res.data, isDemo: false };
  }

  const entries = localLedger[applicationId] || [];
  const isTampered = entries.some((e) => (e.payload as Record<string, unknown>)?._tampered);

  if (isTampered) {
    return {
      data: {
        valid: false,
        brokenAt: entries.find((e) => (e.payload as Record<string, unknown>)?._tampered)?.id || entries[0]?.id,
        totalEntries: entries.length,
        message: 'Tampering detected: Payload altered without cryptographic hash update.',
      },
      isDemo: true,
    };
  }

  return {
    data: {
      valid: true,
      brokenAt: null,
      totalEntries: entries.length,
      message: `All ${entries.length} blocks verified cryptographically. Chain integrity intact.`,
    },
    isDemo: true,
  };
}

export async function tamperLedger(
  applicationId: string
): Promise<{ data: { success: boolean; message: string }; isDemo: boolean }> {
  const res = await request<{ success: boolean; message: string }>(`/ledger/${applicationId}/tamper`, {
    method: 'POST',
    body: JSON.stringify({ index: 0 }),
  });

  if (!res.isDemo && res.data) {
    return { data: res.data, isDemo: false };
  }

  const chain = localLedger[applicationId];
  if (chain && chain.length > 0) {
    chain[0].payload = {
      ...chain[0].payload,
      _tampered: true,
      fraudulentNote: 'Direct database record alteration bypass',
    };
    return {
      data: {
        success: true,
        message: `Tampered payload of entry ${chain[0].id} in demo memory store.`,
      },
      isDemo: true,
    };
  }

  return {
    data: { success: false, message: 'No entries to tamper' },
    isDemo: true,
  };
}

// 12. Get Inspections
export async function getInspections(
  inspectorId?: string
): Promise<{ data: InspectionAssignment[]; isDemo: boolean }> {
  const query = inspectorId ? `?inspectorId=${encodeURIComponent(inspectorId)}` : '';
  const res = await request<InspectionAssignment[]>(`/inspections${query}`);

  if (!res.isDemo && res.data) {
    return { data: res.data, isDemo: false };
  }

  let list = [...localInspections];
  if (inspectorId) {
    list = list.filter((i) => i.inspectors.some((ins) => ins.id === inspectorId));
  }
  return { data: list, isDemo: true };
}

// 13. Run EVC Optimizer
export async function optimizeScheduling(options: {
  startDate?: string;
  endDate?: string;
  applicationIds?: string[];
} = {}): Promise<{ data: OptimizationResult; isDemo: boolean; error?: string }> {
  const res = await request<OptimizationResult>('/scheduling/optimize', {
    method: 'POST',
    body: JSON.stringify(options),
  });

  if (!res.isDemo && res.data) {
    return { data: res.data, isDemo: false };
  }

  // Local fallback mock calculation
  const pendingEvc = localApplications.filter((a) => a.status === 'EVC_REQUIRED');
  const assignments: InspectionAssignment[] = [];
  const excludedConflicts = [
    {
      inspectorId: 'INS-001',
      inspectorName: 'Dr. Rajesh Sharma',
      institutionName: 'Veermata Jijabai Technological Institute (VJTI)',
      reason: 'Former Department Head & Professor (2018-2023)',
    },
  ];

  for (const app of pendingEvc) {
    if (app.id === 'APP-2024-015') continue; // Unassigned demo
    const candidateInspectors = INITIAL_MOCK_INSPECTORS.filter(
      (ins) => ins.domain === (app.domain || 'CSE') && ins.id !== 'INS-001'
    ).slice(0, 2);

    if (candidateInspectors.length >= 2) {
      assignments.push({
        id: `INSP-${app.id}`,
        applicationId: app.id,
        institutionName: app.institutionName,
        domain: app.domain || 'CSE',
        lat: app.lat || 19.076,
        lng: app.lng || 72.877,
        scheduledDate: options.startDate || '2026-11-04',
        inspectors: candidateInspectors.map((i) => ({
          id: i.id,
          name: i.name,
          domain: i.domain,
          homeCity: i.homeCity,
        })),
        status: 'SCHEDULED',
        source: 'fallback',
      });
    }
  }

  return {
    data: {
      source: 'fallback',
      routes: [
        {
          inspectorId: 'INS-002',
          inspectorName: 'Dr. Sunita Patil',
          homeCity: 'Pune, MH',
          date: options.startDate || '2026-11-04',
          stops: [
            {
              applicationId: 'APP-2024-005',
              institutionName: 'Veermata Jijabai Technological Institute (VJTI)',
              lat: 18.975,
              lng: 72.8258,
              arrivalTime: '10:00',
              departureTime: '14:00',
              distanceFromPrevKm: 142.5,
            },
          ],
          totalKm: 285.0,
        },
      ],
      baselineKm: 1240.0,
      optimizedKm: 810.0,
      percentSaved: 34.7,
      unassigned: [
        {
          applicationId: 'APP-2024-015',
          institutionName: 'Remote Himalayan Institute of Tech, Leh',
          reason: 'Travel and 4-hour inspection time exceeds working hours limit (09:00 - 18:00)',
        },
      ],
      excludedConflictsCount: excludedConflicts.length,
      excludedConflicts,
      assignments,
    },
    isDemo: true,
  };
}

// 14. Schedule Single EVC Inspection
export async function scheduleEvc(
  applicationId: string,
  inspectorIds: [string, string],
  scheduledDate: string,
  source: 'ortools' | 'fallback' | 'manual' = 'manual'
): Promise<{ data: { assignment: InspectionAssignment }; isDemo: boolean; error?: string }> {
  const res = await request<{ assignment: InspectionAssignment }>(
    `/applications/${applicationId}/schedule-evc`,
    {
      method: 'POST',
      body: JSON.stringify({ inspectorIds, scheduledDate, source }),
    }
  );

  if (!res.isDemo && res.data) {
    return { data: res.data, isDemo: false };
  }

  const app = localApplications.find((a) => a.id === applicationId);
  const ins1 = INITIAL_MOCK_INSPECTORS.find((i) => i.id === inspectorIds[0]);
  const ins2 = INITIAL_MOCK_INSPECTORS.find((i) => i.id === inspectorIds[1]);

  if (!app || !ins1 || !ins2) {
    return { data: null as unknown as { assignment: InspectionAssignment }, isDemo: true, error: 'Application or inspectors not found' };
  }

  const newAssignment: InspectionAssignment = {
    id: `INSP-${applicationId}`,
    applicationId,
    institutionName: app.institutionName,
    domain: app.domain || 'CSE',
    lat: app.lat || 19.076,
    lng: app.lng || 72.877,
    scheduledDate,
    inspectors: [
      { id: ins1.id, name: ins1.name, domain: ins1.domain, homeCity: ins1.homeCity },
      { id: ins2.id, name: ins2.name, domain: ins2.domain, homeCity: ins2.homeCity },
    ],
    status: 'SCHEDULED',
    source,
  };

  app.scheduledInspection = newAssignment;
  localInspections.push(newAssignment);

  return { data: { assignment: newAssignment }, isDemo: true };
}

// 15. Submit EVC Report
export async function submitEvcReport(
  applicationId: string,
  payload: {
    findings: EvcReportFindings;
    recommendation: 'RECOMMENDED' | 'DEFICIENT';
    actorId?: string;
  }
): Promise<{ data: { application: Application; report: EvcReport }; isDemo: boolean; error?: string }> {
  const res = await request<{ application: Application; report: EvcReport }>(
    `/applications/${applicationId}/evc-report`,
    {
      method: 'POST',
      headers: { 'x-actor': payload.actorId || 'INS-002' },
      body: JSON.stringify({
        findings: payload.findings,
        recommendation: payload.recommendation,
      }),
    }
  );

  if (!res.isDemo && res.data) {
    return { data: res.data, isDemo: false };
  }

  const app = localApplications.find((a) => a.id === applicationId);
  if (!app) {
    return { data: null as unknown as { application: Application; report: EvcReport }, isDemo: true, error: 'Application not found' };
  }

  app.status = 'EVC_DONE';
  const report: EvcReport = {
    id: `REP-${applicationId}`,
    applicationId,
    inspectorId: payload.actorId || 'INS-002',
    findings: payload.findings,
    recommendation: payload.recommendation,
    reportHash: 'f4b3e2a1d0c9b8a7f6e5d4c3b2a10987654321fedcba0987654321abcdef1234',
    submittedAt: new Date().toISOString(),
  };

  const insp = localInspections.find((i) => i.applicationId === applicationId);
  if (insp) {
    insp.status = 'COMPLETED';
    insp.report = report;
  }
  if (app.scheduledInspection) {
    app.scheduledInspection.status = 'COMPLETED';
    app.scheduledInspection.report = report;
  }

  return { data: { application: app, report }, isDemo: true };
}
