import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../app.js';
import { store } from '../db/store.js';
import { signJwt } from '../services/auth.js';
import { runAlertEngine, resetAlertEngineForTests } from '../services/alerts.js';

async function token(payload: {
  sub: string;
  role: 'OFFICER' | 'COMMITTEE' | 'CHIEF' | 'INSTITUTION';
  name: string;
  email: string;
  region?: 'WEST' | 'NORTH' | 'ALL';
  institutionName?: string;
  inspectorId?: string;
}) {
  return signJwt(payload);
}

function auth(t: string) {
  return { Authorization: `Bearer ${t}` };
}

describe('Part 3: Dashboards', () => {
  beforeEach(() => {
    store.seed();
    resetAlertEngineForTests();
  });

  it('returns pendency dashboard with note', async () => {
    const t = await token({
      sub: 'USR-OFFICER',
      role: 'OFFICER',
      name: 'Officer',
      email: 'officer@aicte.gov.in',
      region: 'ALL',
    });
    const res = await app.request('/dashboards/pendency', { headers: auth(t) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.note.toLowerCase()).toContain('placeholder timelines pending aph');
    expect(body.countsByStage).toBeDefined();
    expect(body.ageingBuckets).toBeDefined();
    expect(body.workloadPerOfficer).toBeDefined();
    expect(body.workloadPerCommittee).toBeDefined();
    expect(body.bottleneckStages).toBeDefined();
    expect(Array.isArray(body.pendingCases)).toBe(true);
    expect(body.roleView).toBe('bureau_officer');
  });

  it('returns EVC board with buckets including delayed demo cases', async () => {
    const t = await token({
      sub: 'USR-OFFICER',
      role: 'OFFICER',
      name: 'Officer',
      email: 'officer@aicte.gov.in',
      region: 'ALL',
    });
    const res = await app.request('/dashboards/evc-board', { headers: auth(t) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.note.toLowerCase()).toContain('placeholder timelines pending aph');
    expect(typeof body.awaitingEvc).toBe('number');
    expect(typeof body.scheduled).toBe('number');
    expect(typeof body.completed).toBe('number');
    expect(typeof body.delayed).toBe('number');
    expect(body.delayed).toBeGreaterThan(0);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.some((item: { applicationId: string }) => item.applicationId === 'APP-DEMO-EVC-DELAYED')).toBe(
      true
    );
  });

  it('rejects unauthenticated dashboard reads', async () => {
    const pendency = await app.request('/dashboards/pendency');
    const evc = await app.request('/dashboards/evc-board');
    expect(pendency.status).toBe(401);
    expect(evc.status).toBe(401);
  });

  it('scopes a regional officer to own region only', async () => {
    const t = await token({
      sub: 'USR-OFFICER-WEST',
      role: 'OFFICER',
      name: 'West Officer',
      email: 'officer.west@aicte.gov.in',
      region: 'WEST',
    });
    const res = await app.request('/dashboards/pendency', { headers: auth(t) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.roleView).toBe('regional_officer');
    expect(
      body.pendingCases.every(
        (row: { region?: string }) => !row.region || row.region === 'ALL' || row.region === 'WEST'
      )
    ).toBe(true);
    expect(body.pendingCases.some((row: { region?: string }) => row.region === 'NORTH')).toBe(false);
  });

  it('scopes a bureau officer to all regions', async () => {
    const t = await token({
      sub: 'USR-OFFICER-ALL',
      role: 'OFFICER',
      name: 'Bureau Officer',
      email: 'officer@aicte.gov.in',
      region: 'ALL',
    });
    const res = await app.request('/dashboards/pendency', { headers: auth(t) });
    const body = (await res.json()) as any;
    expect(body.roleView).toBe('bureau_officer');
    const regions = new Set(body.pendingCases.map((row: { region?: string }) => row.region || 'ALL'));
    expect(regions.size).toBeGreaterThan(1);
  });

  it('scopes a committee member away from other regions', async () => {
    const t = await token({
      sub: 'USR-COMMITTEE-WEST',
      role: 'COMMITTEE',
      name: 'West Committee',
      email: 'committee@aicte.gov.in',
      inspectorId: 'INS-002',
      region: 'WEST',
    });
    const res = await app.request('/dashboards/evc-board', { headers: auth(t) });
    const body = (await res.json()) as any;
    expect(body.roleView).toBe('committee');
    expect(
      body.items.every((row: { region?: string }) => !row.region || row.region === 'ALL' || row.region === 'WEST')
    ).toBe(true);
    expect(body.items.some((row: { applicationId: string }) => row.applicationId === 'APP-2024-001')).toBe(false);
  });

  it('scopes head office to every pending case', async () => {
    const t = await token({
      sub: 'USR-CHIEF-01',
      role: 'CHIEF',
      name: 'Chief',
      email: 'chief@aicte.gov.in',
      region: 'ALL',
    });
    const res = await app.request('/dashboards/pendency', { headers: auth(t) });
    const body = (await res.json()) as any;
    expect(body.roleView).toBe('head_office');
    expect(body.total).toBeGreaterThan(0);
  });

  it('scopes an institution to its own applications only', async () => {
    const t = await token({
      sub: 'USR-INST-01',
      role: 'INSTITUTION',
      name: 'Delhi Institute',
      email: 'delhi.tech@aicte.gov.in',
      institutionName: 'Delhi Institute of Advanced Technology & AI',
    });
    const res = await app.request('/dashboards/pendency', { headers: auth(t) });
    const body = (await res.json()) as any;
    expect(body.roleView).toBe('institution');
    expect(
      body.pendingCases.every(
        (row: { institutionName: string }) =>
          row.institutionName === 'Delhi Institute of Advanced Technology & AI'
      )
    ).toBe(true);
    expect(body.pendingCases.some((row: { applicationId: string }) => row.applicationId === 'APP-DEMO-SCRUTINY')).toBe(
      false
    );
  });

  it('filters pending cases by stage and pendency status', async () => {
    const t = await token({
      sub: 'USR-OFFICER',
      role: 'OFFICER',
      name: 'Officer',
      email: 'officer@aicte.gov.in',
      region: 'ALL',
    });
    const res = await app.request('/dashboards/pendency?stage=SCRUTINY&status=On%20time', {
      headers: auth(t),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(
      body.pendingCases.every(
        (row: { currentStage: string; status: string; pendencyStatus: string }) =>
          (row.currentStage === 'SCRUTINY' || row.status === 'SCRUTINY') && row.pendencyStatus === 'On time'
      )
    ).toBe(true);
  });

  it('runs the alert job twice on delayed EVC cases with zero new duplicates', async () => {
    const first = await runAlertEngine(new Date());
    expect(first.remindersCreated + first.escalationsCreated).toBeGreaterThan(0);

    const logsAfterFirst = (await store.listAlertLogs()).filter((log) =>
      log.eventId.includes('APP-DEMO-EVC-DELAYED')
    );
    expect(logsAfterFirst.length).toBeGreaterThan(0);

    const second = await runAlertEngine(new Date());
    expect(second.remindersCreated).toBe(0);
    expect(second.escalationsCreated).toBe(0);
    expect(second.notificationsCreated).toBe(0);
    expect(second.duplicatesSkipped).toBeGreaterThan(0);

    const logsAfterSecond = (await store.listAlertLogs()).filter((log) =>
      log.eventId.includes('APP-DEMO-EVC-DELAYED')
    );
    expect(logsAfterSecond.length).toBe(logsAfterFirst.length);
  });

  it('writes ledger entries for approaching or overdue stage-timeline alerts', async () => {
    await runAlertEngine(new Date());
    const ledger = await store.getLedger('APP-DEMO-EVC-DELAYED');
    const alertEntries = ledger.filter(
      (entry) => entry.eventType === 'ALERT_REMINDER' || entry.eventType === 'ALERT_ESCALATION'
    );
    expect(alertEntries.length).toBeGreaterThan(0);
    expect(alertEntries.every((entry) => entry.actor === 'system:alert-engine')).toBe(true);
    expect(alertEntries.some((entry) => String(entry.payload.eventType).includes('PENDENCY') || String(entry.payload.eventType).includes('REPORT') || String(entry.payload.eventType).includes('EVC'))).toBe(true);
  });
});
