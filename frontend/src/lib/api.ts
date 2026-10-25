import { Application, ApplicationType, ExtractedFields, LedgerEntry, Role, Status, VerificationResult, Deficiency } from './types';
import { INITIAL_MOCK_APPLICATIONS, INITIAL_MOCK_LEDGER } from './mock';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// In-memory fallback state in the browser if backend is disconnected
let localApplications: Application[] = [...INITIAL_MOCK_APPLICATIONS];
let localLedger: Record<string, LedgerEntry[]> = JSON.parse(JSON.stringify(INITIAL_MOCK_LEDGER));

export function getStoredRole(): Role {
  if (typeof window === 'undefined') return 'institution';
  const role = localStorage.getItem('aicte_role') as Role;
  if (role && ['institution', 'officer', 'committee'].includes(role)) {
    return role;
  }
  return 'institution';
}

export function setStoredRole(role: Role): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('aicte_role', role);
  window.dispatchEvent(new Event('aicte_role_changed'));
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T; isDemo: boolean; error?: string }> {
  const role = getStoredRole();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  headers.set('x-role', role);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP error ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as T;
    return { data, isDemo: false };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[Backend API Unreachable] Falling back to local mock data for ${path}:`, message);
    return { data: null as unknown as T, isDemo: true, error: message };
  }
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

  // Fallback to local state
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

  // Mock creation fallback
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
  };

  localApplications = [newApp, ...localApplications];

  const firstEntry: LedgerEntry = {
    id: `LEDGER-${nextId}-1`,
    applicationId: nextId,
    eventType: 'APPLICATION_CREATED',
    actor: getStoredRole(),
    payload: { institutionName: newApp.institutionName, type: newApp.type },
    timestamp: now.toISOString(),
    prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
    hash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  };
  localLedger[nextId] = [firstEntry];

  return { data: newApp, isDemo: true };
}

// 4. Run AI scrutiny
export async function runScrutiny(
  id: string,
  extracted?: ExtractedFields
): Promise<{ data: { application: Application; deficiencies: Deficiency[] }; isDemo: boolean }> {
  const res = await request<{
    application: Application;
    deficiencies: Deficiency[];
  }>(`/applications/${id}/scrutiny`, {
    method: 'POST',
    body: JSON.stringify(extracted || {}),
  });

  if (!res.isDemo && res.data) {
    return { data: res.data, isDemo: false };
  }

  // Mock scrutiny
  const appIndex = localApplications.findIndex((a) => a.id === id);
  if (appIndex === -1) throw new Error('Application not found');

  const app = localApplications[appIndex];
  const updatedExtracted = { ...app.extracted, ...extracted };

  const deficiencies: Deficiency[] = [];
  if (!updatedExtracted.landAreaSqm || updatedExtracted.landAreaSqm < 6000) {
    deficiencies.push({
      message: `Land area ${updatedExtracted.landAreaSqm || 0} sq.m is below required 6000 sq.m`,
      clause: 'AICTE APH Clause 4.1',
      severity: 'CRITICAL',
    });
  }

  const nextStatus: Status = deficiencies.length > 0 ? 'DEFICIENT' : (app.type === 'NEW' ? 'EVC_REQUIRED' : 'DECISION');
  const updatedApp: Application = {
    ...app,
    status: nextStatus,
    extracted: updatedExtracted,
    deficiencies,
  };
  localApplications[appIndex] = updatedApp;

  // Add ledger entry
  const chain = localLedger[id] || [];
  const prev = chain[chain.length - 1];
  const newEntry: LedgerEntry = {
    id: `LEDGER-${id}-${chain.length + 1}`,
    applicationId: id,
    eventType: 'SCRUTINY_RULE_EVALUATION',
    actor: 'officer',
    payload: { status: nextStatus, deficiencies },
    timestamp: new Date().toISOString(),
    prevHash: prev ? prev.hash : '0000000000000000000000000000000000000000000000000000000000000000',
    hash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
  };
  localLedger[id] = [...chain, newEntry];

  return { data: { application: updatedApp, deficiencies }, isDemo: true };
}

// 5. Advance workflow state
export async function advanceApplication(
  id: string,
  to: Status,
  remarks?: string
): Promise<{ data: Application; isDemo: boolean }> {
  const res = await request<Application>(`/applications/${id}/advance`, {
    method: 'POST',
    body: JSON.stringify({ to, remarks }),
  });

  if (!res.isDemo && res.data) {
    return { data: res.data, isDemo: false };
  }

  const appIndex = localApplications.findIndex((a) => a.id === id);
  if (appIndex === -1) throw new Error('Application not found');

  const app = localApplications[appIndex];
  const updatedApp: Application = { ...app, status: to };
  localApplications[appIndex] = updatedApp;

  const chain = localLedger[id] || [];
  const prev = chain[chain.length - 1];
  const newEntry: LedgerEntry = {
    id: `LEDGER-${id}-${chain.length + 1}`,
    applicationId: id,
    eventType: 'WORKFLOW_STATE_ADVANCED',
    actor: getStoredRole(),
    payload: { previousStatus: app.status, newStatus: to, remarks },
    timestamp: new Date().toISOString(),
    prevHash: prev ? prev.hash : '0000000000000000000000000000000000000000000000000000000000000000',
    hash: 'fe98ba76543210fe98ba76543210fe98ba76543210fe98ba76543210fe98ba',
  };
  localLedger[id] = [...chain, newEntry];

  return { data: updatedApp, isDemo: true };
}

// 6. Get ledger
export async function getLedger(applicationId: string): Promise<{ data: LedgerEntry[]; isDemo: boolean }> {
  const res = await request<LedgerEntry[]>(`/ledger/${applicationId}`);
  if (!res.isDemo && res.data) {
    return { data: res.data, isDemo: false };
  }

  const entries = localLedger[applicationId] || [];
  return { data: entries, isDemo: true };
}

// 7. Verify ledger
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

// 8. Tamper ledger (Demonstration helper)
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
