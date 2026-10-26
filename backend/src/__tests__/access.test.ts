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
});
