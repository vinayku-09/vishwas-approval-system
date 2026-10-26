/**
 * routing.test.ts
 *
 * Part 2b: the four PS approval routes, route-aware progression, guarded
 * return/revert, standard notices and the read-only electronic case summary.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../app.js';
import { store } from '../db/store.js';
import { signJwt } from '../services/auth.js';
import {
  decorateApplication,
  getAutoNextStatus,
  getRouteDefinition,
  getRouteState,
} from '../services/routing.js';
import type { Application, ApplicationType, Status } from '../types.js';

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
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

async function officerWestToken() {
  return signJwt({
    sub: 'USR-OFFICER-WEST',
    role: 'OFFICER',
    name: 'West Officer',
    email: 'officer.west@aicte.gov.in',
    region: 'WEST',
  });
}

function application(overrides: Partial<Application>): Application {
  return {
    id: 'APP-TEST',
    institutionName: 'Test Institute',
    type: 'NEW',
    status: 'SUBMITTED',
    createdAt: new Date().toISOString(),
    slaDueAt: new Date().toISOString(),
    deficiencies: [],
    ...overrides,
  };
}

async function createApplicationViaApi(type: ApplicationType, token: string) {
  const res = await app.request('/applications', {
    method: 'POST',
    headers: { ...bearer(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      institutionName: `Route Test ${type} ${Date.now()}`,
      type,
    }),
  });
  expect(res.status).toBe(201);
  return (await res.json()) as Application;
}

async function advanceApplication(
  id: string,
  token: string,
  to?: Status,
  remarks = 'Route end-to-end test'
) {
  return app.request(`/applications/${id}/advance`, {
    method: 'POST',
    headers: { ...bearer(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(to ? { to, remarks } : { remarks }),
  });
}

async function expectAdvance(
  id: string,
  token: string,
  expectedStatus: Status,
  to?: Status
) {
  const res = await advanceApplication(id, token, to);
  expect(res.status).toBe(200);
  const body = (await res.json()) as Application;
  expect(body.status).toBe(expectedStatus);
  return body;
}

async function recordConfirmSignoff(id: string, token: string) {
  const res = await app.request(`/applications/${id}/signoff`, {
    method: 'POST',
    headers: { ...bearer(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      decision: 'CONFIRM',
      remarks: 'Human review completed for route test.',
    }),
  });
  expect(res.status).toBe(200);
}

describe('Part 2b - the four PS routes and route-aware progression', () => {
  it('maps application types and status overrides to the four PS routes', () => {
    expect(getRouteDefinition(application({ type: 'NEW' })).id).toBe('SCRUTINY_EVC');
    expect(getRouteDefinition(application({ type: 'EXTENSION_OF_APPROVAL' })).id).toBe(
      'ONLY_SCRUTINY'
    );
    expect(getRouteDefinition(application({ type: 'INTAKE_CHANGE' })).id).toBe('ONLY_EVC');
    expect(getRouteDefinition(application({ type: 'APPEAL' })).id).toBe('EVC_SAC_SHC');
    expect(getRouteDefinition(application({ status: 'REJECTED' })).id).toBe(
      'EVC_SAC_SHC'
    );
    expect(getRouteDefinition(application({ status: 'APPEAL_SHC' })).id).toBe(
      'EVC_SAC_SHC'
    );
  });

  it('defines the exact ordered stage list for each PS route', () => {
    expect(getRouteDefinition(application({ type: 'EXTENSION_OF_APPROVAL' })).stages).toEqual([
      'SUBMITTED',
      'SCRUTINY',
      'DECISION',
    ]);
    expect(getRouteDefinition(application({ type: 'NEW' })).stages).toEqual([
      'SUBMITTED',
      'SCRUTINY',
      'EVC_REQUIRED',
      'EVC_DONE',
      'DECISION',
    ]);
    expect(getRouteDefinition(application({ type: 'APPEAL' })).stages).toEqual([
      'SUBMITTED',
      'SCRUTINY',
      'EVC_REQUIRED',
      'EVC_DONE',
      'DECISION',
      'APPEAL_SHC',
      'APPEAL_SAC',
    ]);
    expect(getRouteDefinition(application({ status: 'REJECTED' })).stages).toEqual(
      getRouteDefinition(application({ type: 'APPEAL' })).stages
    );
    expect(getRouteDefinition(application({ type: 'INTAKE_CHANGE' })).stages).toEqual([
      'SUBMITTED',
      'EVC_REQUIRED',
      'EVC_DONE',
      'DECISION',
    ]);
  });

  it('advances SUBMITTED according to the selected route', () => {
    expect(getAutoNextStatus(application({ type: 'NEW', status: 'SUBMITTED' }))).toBe(
      'SCRUTINY'
    );
    expect(
      getAutoNextStatus(application({ type: 'EXTENSION_OF_APPROVAL', status: 'SUBMITTED' }))
    ).toBe('SCRUTINY');
    expect(
      getAutoNextStatus(application({ type: 'INTAKE_CHANGE', status: 'SUBMITTED' }))
    ).toBe('EVC_REQUIRED');
  });

  it('applies EVC only where the route configures it', () => {
    expect(
      getAutoNextStatus(application({ type: 'NEW', status: 'SCRUTINY', deficiencies: [] }))
    ).toBe('EVC_REQUIRED');
    expect(
      getAutoNextStatus(
        application({ type: 'EXTENSION_OF_APPROVAL', status: 'SCRUTINY', deficiencies: [] })
      )
    ).toBe('DECISION');
    expect(
      getAutoNextStatus(
        application({
          type: 'NEW',
          status: 'SCRUTINY',
          deficiencies: [
            { id: 'DEF-1', clause: 'C1', message: 'Missing land record', severity: 'CRITICAL' },
          ],
        })
      )
    ).toBe('DEFICIENT');
  });

  it('never auto-decides EVC_REQUIRED, DECISION or appeal stages', () => {
    expect(getAutoNextStatus(application({ status: 'EVC_REQUIRED' }))).toBeNull();
    expect(getAutoNextStatus(application({ status: 'DECISION' }))).toBeNull();
    expect(getAutoNextStatus(application({ status: 'APPEAL_SHC' }))).toBeNull();
    expect(getAutoNextStatus(application({ status: 'APPEAL_SAC' }))).toBeNull();
  });

  it('exposes route-specific next stages rather than the global state machine', () => {
    const intake = getRouteState(
      application({ type: 'INTAKE_CHANGE', status: 'SUBMITTED' })
    );
    expect(intake.nextStatuses).toEqual(['EVC_REQUIRED']);

    const extension = getRouteState(
      application({ type: 'EXTENSION_OF_APPROVAL', status: 'SCRUTINY' })
    );
    expect(extension.nextStatuses).toEqual(['DEFICIENT', 'DECISION']);

    const rejected = getRouteState(application({ status: 'REJECTED' }));
    expect(rejected.id).toBe('EVC_SAC_SHC');
    expect(rejected.nextStatuses).toEqual(['APPEAL_SHC']);
  });

  it('exposes configured stage and return targets in the response decorator', () => {
    const decorated = decorateApplication(application({ type: 'NEW', status: 'DECISION' }));
    expect(decorated.route?.id).toBe('SCRUTINY_EVC');
    expect(decorated.route?.currentStage).toBe('DECISION');
    expect(decorated.route?.nextStatuses).toEqual(['APPROVED', 'REJECTED']);
    expect(decorated.route?.returnTargets).toEqual([
      'EVC_DONE',
      'EVC_REQUIRED',
      'SCRUTINY',
      'DEFICIENT',
    ]);
    expect(decorated.route?.stages).toEqual([
      'SUBMITTED',
      'SCRUTINY',
      'EVC_REQUIRED',
      'EVC_DONE',
      'DECISION',
    ]);
  });

  it('returns no return targets for terminal applications', () => {
    expect(getRouteState(application({ status: 'APPROVED' })).returnTargets).toEqual([]);
  });
});

describe('Part 2b - end-to-end route execution', () => {
  beforeEach(() => {
    store.seed();
  });

  it('runs ONLY_SCRUTINY from submission to approval', async () => {
    const token = await officerAllToken();
    const created = await createApplicationViaApi('EXTENSION_OF_APPROVAL', token);
    expect(created.route?.id).toBe('ONLY_SCRUTINY');
    expect(created.route?.stages).toEqual(['SUBMITTED', 'SCRUTINY', 'DECISION']);

    await expectAdvance(created.id, token, 'SCRUTINY');
    const decision = await expectAdvance(created.id, token, 'DECISION');
    expect(decision.route?.id).toBe('ONLY_SCRUTINY');
    const approved = await expectAdvance(created.id, token, 'APPROVED', 'APPROVED');
    expect(approved.route?.id).toBe('ONLY_SCRUTINY');
  });

  it('runs SCRUTINY_EVC from submission through EVC to approval', async () => {
    const token = await officerAllToken();
    const created = await createApplicationViaApi('NEW', token);
    expect(created.route?.id).toBe('SCRUTINY_EVC');

    await expectAdvance(created.id, token, 'SCRUTINY');
    const evcRequired = await expectAdvance(created.id, token, 'EVC_REQUIRED');
    expect(evcRequired.route?.stages).toEqual([
      'SUBMITTED',
      'SCRUTINY',
      'EVC_REQUIRED',
      'EVC_DONE',
      'DECISION',
    ]);
    await expectAdvance(created.id, token, 'EVC_DONE', 'EVC_DONE');
    await expectAdvance(created.id, token, 'DECISION');
    await expectAdvance(created.id, token, 'APPROVED', 'APPROVED');
  });

  it('runs ONLY_EVC from submission to approval without scrutiny', async () => {
    const token = await officerAllToken();
    const created = await createApplicationViaApi('INTAKE_CHANGE', token);
    expect(created.route?.id).toBe('ONLY_EVC');
    expect(created.route?.stages).toEqual([
      'SUBMITTED',
      'EVC_REQUIRED',
      'EVC_DONE',
      'DECISION',
    ]);

    await expectAdvance(created.id, token, 'EVC_REQUIRED');
    await expectAdvance(created.id, token, 'EVC_DONE', 'EVC_DONE');
    await expectAdvance(created.id, token, 'DECISION');
    await expectAdvance(created.id, token, 'APPROVED', 'APPROVED');
  });

  it('runs EVC_SAC_SHC as a first-class application type route', async () => {
    const token = await officerAllToken();
    const created = await createApplicationViaApi('APPEAL', token);
    expect(created.route?.id).toBe('EVC_SAC_SHC');
    expect(created.route?.stages).toEqual([
      'SUBMITTED',
      'SCRUTINY',
      'EVC_REQUIRED',
      'EVC_DONE',
      'DECISION',
      'APPEAL_SHC',
      'APPEAL_SAC',
    ]);

    await expectAdvance(created.id, token, 'SCRUTINY');
    await expectAdvance(created.id, token, 'EVC_REQUIRED');
    await expectAdvance(created.id, token, 'EVC_DONE', 'EVC_DONE');
    await expectAdvance(created.id, token, 'DECISION');
    await recordConfirmSignoff(created.id, token);
    await expectAdvance(created.id, token, 'REJECTED', 'REJECTED');
    await expectAdvance(created.id, token, 'APPEAL_SHC', 'APPEAL_SHC');
    await expectAdvance(created.id, token, 'APPEAL_SAC', 'APPEAL_SAC');
    await expectAdvance(created.id, token, 'APPROVED', 'APPROVED');
  });

  it('runs EVC_SAC_SHC through rejection, SHC, SAC and approval', async () => {
    const token = await officerAllToken();
    const created = await createApplicationViaApi('NEW', token);

    await expectAdvance(created.id, token, 'SCRUTINY');
    await expectAdvance(created.id, token, 'EVC_REQUIRED');
    await expectAdvance(created.id, token, 'EVC_DONE', 'EVC_DONE');
    await expectAdvance(created.id, token, 'DECISION');
    await recordConfirmSignoff(created.id, token);

    const rejected = await expectAdvance(created.id, token, 'REJECTED', 'REJECTED');
    expect(rejected.route?.id).toBe('EVC_SAC_SHC');
    expect(rejected.route?.stages).toContain('APPEAL_SHC');
    expect(rejected.route?.stages).toContain('APPEAL_SAC');

    await expectAdvance(created.id, token, 'APPEAL_SHC', 'APPEAL_SHC');
    const atSac = await expectAdvance(created.id, token, 'APPEAL_SAC', 'APPEAL_SAC');
    expect(atSac.route?.id).toBe('EVC_SAC_SHC');
    await expectAdvance(created.id, token, 'APPROVED', 'APPROVED');
  });

  it('rejects a globally valid transition that is not part of the selected route', async () => {
    const token = await officerAllToken();
    const created = await createApplicationViaApi('EXTENSION_OF_APPROVAL', token);
    await expectAdvance(created.id, token, 'SCRUTINY');

    const res = await advanceApplication(created.id, token, 'EVC_REQUIRED');
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Only Scrutiny');
    expect(body.error).toContain('DECISION');
  });

  it('rejects an invalid global transition', async () => {
    const token = await officerAllToken();
    const created = await createApplicationViaApi('NEW', token);
    const res = await advanceApplication(created.id, token, 'APPROVED');
    expect(res.status).toBe(400);
  });
});

describe('Part 2b - return/revert and case summary API', () => {
  beforeEach(() => {
    store.seed();
  });

  it('auto-advances an application when no target is supplied', async () => {
    const token = await officerAllToken();
    const res = await app.request('/applications/APP-2024-001/advance', {
      method: 'POST',
      headers: { ...bearer(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks: 'Auto progression check' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Application;
    expect(body.status).toBe('SCRUTINY');
    expect(body.route?.id).toBe('SCRUTINY_EVC');
  });

  it('rejects automatic progression from a stage requiring human action', async () => {
    const token = await officerAllToken();
    const res = await app.request('/applications/APP-2024-005/advance', {
      method: 'POST',
      headers: { ...bearer(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('No automatic next stage');
  });

  it('records a configured return with reason, ledger entry and institution notice', async () => {
    const token = await officerAllToken();
    const res = await app.request('/applications/APP-2024-005/return', {
      method: 'POST',
      headers: { ...bearer(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: 'SCRUTINY',
        category: 'DOCUMENT_MISSING',
        reason: 'The updated land lease deed is missing from the submitted file.',
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      application: Application;
      return: { id: string; category: string };
      notice: { noticeType: string; id: string };
    };
    expect(body.application.status).toBe('SCRUTINY');
    expect(body.return.category).toBe('DOCUMENT_MISSING');
    expect(body.notice.noticeType).toBe('RETURN');

    const ledger = await store.getLedger('APP-2024-005');
    expect(ledger.some((entry) => entry.eventType === 'APPLICATION_RETURNED')).toBe(true);
    expect(ledger.some((entry) => entry.eventType === 'NOTICE_ISSUED')).toBe(true);

    const notifications = await store.listNotifications();
    expect(
      notifications.some(
        (notification) =>
          notification.applicationId === 'APP-2024-005' &&
          notification.title.toLowerCase().includes('return')
      )
    ).toBe(true);
  });

  it('rejects a return target outside the configured route or without category/reason', async () => {
    const token = await officerAllToken();
    const badTarget = await app.request('/applications/APP-2024-005/return', {
      method: 'POST',
      headers: { ...bearer(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: 'EVC_DONE',
        category: 'OTHER',
        reason: 'Attempting an invalid forward target from the current stage.',
      }),
    });
    expect(badTarget.status).toBe(400);

    const missingCategory = await app.request('/applications/APP-2024-005/return', {
      method: 'POST',
      headers: { ...bearer(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: 'SCRUTINY',
        reason: 'A return without a category must be rejected by the API.',
      }),
    });
    expect(missingCategory.status).toBe(400);

    const shortReason = await app.request('/applications/APP-2024-005/return', {
      method: 'POST',
      headers: { ...bearer(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'SCRUTINY', category: 'OTHER', reason: 'short' }),
    });
    expect(shortReason.status).toBe(400);
  });

  it('enforces region scope on returns', async () => {
    const token = await officerWestToken();
    const res = await app.request('/applications/APP-2024-001/return', {
      method: 'POST',
      headers: { ...bearer(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: 'DEFICIENT',
        category: 'CLARIFICATION',
        reason: 'Out-of-region officer must not be able to return this application.',
      }),
    });
    expect(res.status).toBe(403);
  });

  it('serves a scoped read-only case summary with route, timeline and ledger validity', async () => {
    const token = await officerAllToken();
    const res = await app.request('/applications/APP-2024-001/case-summary', {
      headers: bearer(token),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      readOnly: boolean;
      application: Application;
      route: { id: string; stages: Status[] };
      timeline: unknown[];
      ledger: { valid: boolean; totalEntries: number };
      safeguardNotice: string;
    };
    expect(body.readOnly).toBe(true);
    expect(body.application.id).toBe('APP-2024-001');
    expect(body.route.id).toBe('SCRUTINY_EVC');
    expect(body.route.stages).toEqual([
      'SUBMITTED',
      'SCRUTINY',
      'EVC_REQUIRED',
      'EVC_DONE',
      'DECISION',
    ]);
    expect(body.timeline.length).toBeGreaterThan(0);
    expect(body.ledger.totalEntries).toBeGreaterThan(0);
    expect(body.ledger.valid).toBe(true);
    expect(body.safeguardNotice).toContain('human');
  });

  it('requires authentication for the case summary', async () => {
    const res = await app.request('/applications/APP-2024-001/case-summary');
    expect(res.status).toBe(401);
  });
});
