/**
 * access.test.ts
 *
 * Role/region scoping for application-scoped reads. These tests lock in the
 * Part 2a hardening: no unauthenticated list/read access, institutions see only
 * their own applications, regional staff see only their region, and CHIEF sees
 * everything.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../app.js';
import { store } from '../db/store.js';
import { signJwt } from '../services/auth.js';
import type { Application, InspectionAssignment } from '../types.js';

const DELHI_INSTITUTION = 'Delhi Institute of Advanced Technology & AI';

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function officerWestToken() {
  return signJwt({
    sub: 'USR-OFFICER-WEST',
    role: 'OFFICER',
    name: 'West Officer',
    email: 'officer.west@aicte.gov.in',
    region: 'WEST',
  });
}

async function officerAllToken() {
  return signJwt({
    sub: 'USR-OFFICER-ALL',
    role: 'OFFICER',
    name: 'All India Officer',
    email: 'officer@aicte.gov.in',
    region: 'ALL',
  });
}

async function committeeWestToken() {
  return signJwt({
    sub: 'USR-COMMITTEE-WEST',
    role: 'COMMITTEE',
    name: 'West Committee',
    email: 'committee@aicte.gov.in',
    inspectorId: 'INS-002',
    region: 'WEST',
  });
}

async function chiefToken() {
  return signJwt({
    sub: 'USR-CHIEF-01',
    role: 'CHIEF',
    name: 'Chief',
    email: 'chief@aicte.gov.in',
    region: 'ALL',
  });
}

async function institutionToken() {
  return signJwt({
    sub: 'USR-INST-01',
    role: 'INSTITUTION',
    name: 'Delhi Institute',
    email: 'delhi.tech@aicte.gov.in',
    institutionName: DELHI_INSTITUTION,
  });
}

describe('Part 2a — role/region application scoping', () => {
  beforeEach(() => {
    store.seed();
  });

  it('rejects unauthenticated application listing and document reads', async () => {
    const list = await app.request('/applications', { method: 'GET' });
    expect(list.status).toBe(401);

    const documents = await app.request('/applications/APP-2024-001/documents', {
      method: 'GET',
    });
    expect(documents.status).toBe(401);
  });

  it('scopes an institution to its own applications only', async () => {
    const res = await app.request('/applications', {
      method: 'GET',
      headers: bearer(await institutionToken()),
    });

    expect(res.status).toBe(200);
    const applications = (await res.json()) as Application[];
    expect(applications.length).toBeGreaterThan(0);
    expect(applications.every((a) => a.institutionName === DELHI_INSTITUTION)).toBe(true);

    const own = await app.request('/applications/APP-2024-001', {
      method: 'GET',
      headers: bearer(await institutionToken()),
    });
    expect(own.status).toBe(200);

    const other = await app.request('/applications/APP-2024-005', {
      method: 'GET',
      headers: bearer(await institutionToken()),
    });
    expect(other.status).toBe(403);
  });

  it('scopes a regional officer to WEST applications and blocks cross-region reads', async () => {
    const token = await officerWestToken();

    const list = await app.request('/applications', {
      method: 'GET',
      headers: bearer(token),
    });
    expect(list.status).toBe(200);
    const applications = (await list.json()) as Application[];
    expect(applications.length).toBeGreaterThan(0);
    expect(applications.every((a) => !a.region || a.region === 'ALL' || a.region === 'WEST')).toBe(true);
    expect(applications.some((a) => a.id === 'APP-2024-005')).toBe(true);
    expect(applications.some((a) => a.id === 'APP-2024-001')).toBe(false);

    const west = await app.request('/applications/APP-2024-005', {
      method: 'GET',
      headers: bearer(token),
    });
    expect(west.status).toBe(200);

    const north = await app.request('/applications/APP-2024-001', {
      method: 'GET',
      headers: bearer(token),
    });
    expect(north.status).toBe(403);
  });

  it('blocks a regional officer from mutating a cross-region application', async () => {
    const res = await app.request('/applications/APP-2024-001/advance', {
      method: 'POST',
      headers: {
        ...bearer(await officerWestToken()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: 'SCRUTINY' }),
    });

    expect(res.status).toBe(403);
  });

  it('keeps an all-India officer and CHIEF unrestricted', async () => {
    const allIndia = await app.request('/applications', {
      method: 'GET',
      headers: bearer(await officerAllToken()),
    });
    expect(allIndia.status).toBe(200);
    const allIndiaApps = (await allIndia.json()) as Application[];
    expect(allIndiaApps.length).toBe((await store.listApplications()).length);

    const chief = await app.request('/applications', {
      method: 'GET',
      headers: bearer(await chiefToken()),
    });
    expect(chief.status).toBe(200);
    expect(((await chief.json()) as Application[]).length).toBe(allIndiaApps.length);
  });

  it('scopes committee members by region, not just inspector assignment', async () => {
    const token = await committeeWestToken();

    const west = await app.request('/applications/APP-2024-005', {
      method: 'GET',
      headers: bearer(token),
    });
    expect(west.status).toBe(200);

    const north = await app.request('/applications/APP-2024-001', {
      method: 'GET',
      headers: bearer(token),
    });
    expect(north.status).toBe(403);
  });

  it('scopes document reads to the same application rules', async () => {
    const token = await officerWestToken();

    const own = await app.request('/applications/APP-2024-005/documents', {
      method: 'GET',
      headers: bearer(token),
    });
    expect(own.status).toBe(200);

    const other = await app.request('/applications/APP-2024-001/documents', {
      method: 'GET',
      headers: bearer(token),
    });
    expect(other.status).toBe(403);
  });

  it('protects the full ledger but leaves public verification open', async () => {
    const unauth = await app.request('/ledger/APP-2024-001', { method: 'GET' });
    expect(unauth.status).toBe(401);

    const verify = await app.request('/ledger/APP-2024-001/verify', {
      method: 'GET',
    });
    expect(verify.status).toBe(200);
    expect(((await verify.json()) as { valid: boolean }).valid).toBe(true);

    const token = await officerWestToken();
    const crossRegion = await app.request('/ledger/APP-2024-001', {
      method: 'GET',
      headers: bearer(token),
    });
    expect(crossRegion.status).toBe(403);

    const inRegion = await app.request('/ledger/APP-2024-005', {
      method: 'GET',
      headers: bearer(token),
    });
    expect(inRegion.status).toBe(200);
  });

  it('restricts ledger tampering to CHIEF', async () => {
    const officer = await app.request('/ledger/APP-2024-001/tamper', {
      method: 'POST',
      headers: {
        ...bearer(await officerAllToken()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ index: 0 }),
    });
    expect(officer.status).toBe(403);

    const chief = await app.request('/ledger/APP-2024-001/tamper', {
      method: 'POST',
      headers: {
        ...bearer(await chiefToken()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ index: 0 }),
    });
    expect(chief.status).toBe(200);

    const verify = await app.request('/ledger/APP-2024-001/verify', {
      method: 'GET',
    });
    expect(((await verify.json()) as { valid: boolean }).valid).toBe(false);
  });

  it('protects and region-scopes inspection listings', async () => {
    const unauth = await app.request('/inspections', { method: 'GET' });
    expect(unauth.status).toBe(401);

    const institution = await app.request('/inspections', {
      method: 'GET',
      headers: bearer(await institutionToken()),
    });
    expect(institution.status).toBe(403);

    const west = await app.request('/inspections', {
      method: 'GET',
      headers: bearer(await officerWestToken()),
    });
    expect(west.status).toBe(200);
    const westInspections = (await west.json()) as InspectionAssignment[];
    expect(westInspections.length).toBeGreaterThan(0);
    const westApplications = new Set(
      (await store.listApplications()).filter((application) => application.region === 'WEST').map((application) => application.id)
    );
    expect(westInspections.every((inspection) => westApplications.has(inspection.applicationId))).toBe(true);

    const all = await app.request('/inspections', {
      method: 'GET',
      headers: bearer(await officerAllToken()),
    });
    expect(all.status).toBe(200);
    const allInspections = (await all.json()) as InspectionAssignment[];
    expect(allInspections.length).toBeGreaterThan(westInspections.length);
  });

  it('prevents officer from region A from acting on region B (cross-region block)', async () => {
    // APP-2024-001 is in NORTH region
    const appNorth = await store.getApplication('APP-2024-001');
    expect(appNorth?.region).toBe('NORTH');

    const westToken = await officerWestToken();

    // 1. Advance cross-region application is blocked with 403
    const advanceRes = await app.request('/applications/APP-2024-001/advance', {
      method: 'POST',
      headers: {
        ...bearer(westToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: 'SCRUTINY', remarks: 'Cross region attempt' }),
    });
    expect(advanceRes.status).toBe(403);

    // 2. Return cross-region application is blocked with 403
    const returnRes = await app.request('/applications/APP-2024-001/return', {
      method: 'POST',
      headers: {
        ...bearer(westToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: 'SUBMITTED',
        category: 'DEFICIENCY',
        reason: 'Missing statutory documents required',
      }),
    });
    expect(returnRes.status).toBe(403);

    // 3. Create an undertaking for NORTH application, West officer cannot verify
    const ut = await store.createUndertaking({
      applicationId: 'APP-2024-001',
      conditionText: 'Fire safety compliance pending',
      createdBy: 'officer@aicte.gov.in',
    });

    const verifyRes = await app.request(`/undertakings/${ut.id}/verify`, {
      method: 'POST',
      headers: {
        ...bearer(westToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        decision: 'VERIFIED',
        remarks: 'Attempted cross-region verification',
      }),
    });
    expect(verifyRes.status).toBe(403);
  });

  it('restricts officer creation and user management strictly to Head Office (CHIEF)', async () => {
    const westToken = await officerWestToken();
    const chief = await chiefToken();

    // Regional officer cannot view user management list
    const officerList = await app.request('/auth/users', {
      method: 'GET',
      headers: bearer(westToken),
    });
    expect(officerList.status).toBe(403);

    // Regional officer cannot create new officers
    const officerCreate = await app.request('/auth/users', {
      method: 'POST',
      headers: {
        ...bearer(westToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Rogue Officer',
        email: 'rogue@aicte.gov.in',
        role: 'OFFICER',
        region: 'SOUTH',
      }),
    });
    expect(officerCreate.status).toBe(403);

    // AICTE Head Office (CHIEF) successfully creates a new regional officer
    const adminCreate = await app.request('/auth/users', {
      method: 'POST',
      headers: {
        ...bearer(chief),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Dr. Ramesh Raman',
        email: 'officer.south@aicte.gov.in',
        role: 'OFFICER',
        region: 'SOUTH',
        password: 'Password123!',
      }),
    });
    expect(adminCreate.status).toBe(201);
    const created = (await adminCreate.json()) as { user: { email: string; role: string; region: string } };
    expect(created.user.email).toBe('officer.south@aicte.gov.in');
    expect(created.user.role).toBe('OFFICER');
    expect(created.user.region).toBe('SOUTH');

    // Newly created officer can log in
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'officer.south@aicte.gov.in',
        password: 'Password123!',
      }),
    });
    expect(loginRes.status).toBe(200);
    const loginData = (await loginRes.json()) as { user: { region: string } };
    expect(loginData.user.region).toBe('SOUTH');
  });
});
