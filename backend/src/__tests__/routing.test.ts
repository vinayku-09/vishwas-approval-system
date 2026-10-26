/**
 * routing.test.ts
 *
 * Part 2: configurable approval routes, automatic stage progression, guarded
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
import type { Application } from '../types.js';

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

describe('Part 2 - configurable routes and automatic progression', () => {
  it('maps application types to configured placeholder routes', () => {
    expect(getRouteDefinition(application({ type: 'NEW' })).id).toBe('NEW_APPROVAL');
    expect(getRouteDefinition(application({ type: 'EXTENSION_OF_APPROVAL' })).id).toBe(
      'EXTENSION_OF_APPROVAL'
    );
    expect(getRouteDefinition(application({ type: 'INTAKE_CHANGE' })).id).toBe('INTAKE_CHANGE');
  });

  it('advances SUBMITTED and DEFICIENT to SCRUTINY automatically', () => {
    expect(getAutoNextStatus(application({ status: 'SUBMITTED' }))).toBe('SCRUTINY');
    expect(getAutoNextStatus(application({ status: 'DEFICIENT' }))).toBe('SCRUTINY');
  });

  it('routes NEW applications through EVC but extension/intake routes straight to decision', () => {
    expect(
      getAutoNextStatus(application({ type: 'NEW', status: 'SCRUTINY', deficiencies: [] }))
    ).toBe('EVC_REQUIRED');
    expect(
      getAutoNextStatus(
        application({ type: 'EXTENSION_OF_APPROVAL', status: 'SCRUTINY', deficiencies: [] })
      )
    ).toBe('DECISION');
    expect(
      getAutoNextStatus(application({ type: 'NEW', status: 'SCRUTINY', deficiencies: [
        { id: 'DEF-1', clause: 'C1', message: 'Missing land record', severity: 'CRITICAL' },
      ] }))
    ).toBe('DEFICIENT');
  });

  it('never auto-decides EVC_REQUIRED, DECISION or appeal stages', () => {
    expect(getAutoNextStatus(application({ status: 'EVC_REQUIRED' }))).toBeNull();
    expect(getAutoNextStatus(application({ status: 'DECISION' }))).toBeNull();
    expect(getAutoNextStatus(application({ status: 'APPEAL_SHC' }))).toBeNull();
  });

  it('exposes configured stage, next statuses and return targets in the response decorator', () => {
    const decorated = decorateApplication(application({ status: 'DECISION' }));
    expect(decorated.route?.id).toBe('NEW_APPROVAL');
    expect(decorated.route?.currentStage).toBe('DECISION');
    expect(decorated.route?.nextStatuses).toEqual(['APPROVED', 'REJECTED']);
    expect(decorated.route?.returnTargets).toEqual([
      'EVC_DONE',
      'EVC_REQUIRED',
      'SCRUTINY',
      'DEFICIENT',
    ]);
  });

  it('returns no return targets for terminal applications', () => {
    expect(getRouteState(application({ status: 'APPROVED' })).returnTargets).toEqual([]);
  });
});

describe('Part 2 - return/revert and case summary API', () => {
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
    expect(body.route?.id).toBe('NEW_APPROVAL');
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

  it('rejects a return target outside the configured route or without a reason', async () => {
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
      route: { id: string };
      timeline: unknown[];
      ledger: { valid: boolean; totalEntries: number };
      safeguardNotice: string;
    };
    expect(body.readOnly).toBe(true);
    expect(body.application.id).toBe('APP-2024-001');
    expect(body.route.id).toBe('NEW_APPROVAL');
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
