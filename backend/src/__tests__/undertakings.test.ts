import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { store } from '../db/store.js';
import { signJwt } from '../services/auth.js';
import {
  runAlertEngine,
  markOverdueUndertakings,
  resetAlertEngineForTests,
} from '../services/alerts.js';
import { setAlertEmailSenderForTests } from '../services/mailer.js';
import type { Undertaking } from '../types.js';

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;
const ORIGINAL_MAIL_MODE = process.env.MAIL_MODE;

async function makeToken(claims: {
  sub: string;
  role: 'INSTITUTION' | 'OFFICER' | 'COMMITTEE' | 'CHIEF';
  name: string;
  email: string;
  region?: 'NORTH' | 'WEST' | 'SOUTH' | 'EAST' | 'ALL';
  institutionName?: string;
}): Promise<string> {
  return signJwt(claims);
}

describe('Part 4: Undertakings & Renewals (PS Areas D and E)', () => {
  beforeEach(() => {
    store.seed();
    resetAlertEngineForTests();
    setAlertEmailSenderForTests(null);
    process.env.CRON_SECRET = 'test-cron-secret';
    process.env.MAIL_MODE = 'log';
  });

  afterEach(() => {
    resetAlertEngineForTests();
    setAlertEmailSenderForTests(null);
    if (ORIGINAL_CRON_SECRET === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
    if (ORIGINAL_MAIL_MODE === undefined) delete process.env.MAIL_MODE;
    else process.env.MAIL_MODE = ORIGINAL_MAIL_MODE;
  });

  describe('1. Full Lifecycle of Undertakings & Evidence', () => {
    it('creates an undertaking, accepts evidence upload, and verifies evidence', async () => {
      const officerToken = await makeToken({
        sub: 'USR-NORTH-01',
        role: 'OFFICER',
        name: 'North Officer',
        email: 'officer.north@aicte.gov.in',
        region: 'NORTH',
      });

      // 1. Officer creates undertaking on APP-2024-001 (region: NORTH)
      const createRes = await app.request('/undertakings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${officerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          applicationId: 'APP-2024-001',
          conditionText: 'Install secondary emergency fire exits in block B',
        }),
      });
      expect(createRes.status).toBe(201);
      const created = (await createRes.json()) as Undertaking;
      expect(created.id).toBeDefined();
      expect(created.status).toBe('PENDING');

      const createLedger = await store.getLedger('APP-2024-001');
      expect(createLedger.some((e) => e.eventType === 'UNDERTAKING_CREATED')).toBe(true);

      // 2. Institution uploads evidence
      const instToken = await makeToken({
        sub: 'USR-INST-01',
        role: 'INSTITUTION',
        name: 'Delhi Tech',
        email: 'delhi.tech@aicte.gov.in',
        institutionName: 'Delhi Institute of Advanced Technology & AI',
      });

      const formData = new FormData();
      const fakePdf = new File(['%PDF-1.4 test evidence content'], 'emergency_exits_proof.pdf', {
        type: 'application/pdf',
      });
      formData.append('file', fakePdf);

      const uploadRes = await app.request(`/undertakings/${created.id}/evidence`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${instToken}` },
        body: formData,
      });
      expect(uploadRes.status).toBe(201);
      const uploadJson = (await uploadRes.json()) as { success: boolean; undertaking: Undertaking };
      expect(uploadJson.success).toBe(true);
      expect(uploadJson.undertaking.status).toBe('SUBMITTED');

      // Check ledger entry contains SHA-256 hash, NEVER file bytes
      const uploadLedger = await store.getLedger('APP-2024-001');
      const evdEntry = uploadLedger.find((e) => e.eventType === 'UNDERTAKING_EVIDENCE_SUBMITTED');
      expect(evdEntry).toBeDefined();
      expect(evdEntry?.payload.fileHash).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.stringify(evdEntry?.payload)).not.toContain('%PDF-1.4');

      // 3. Officer verifies the undertaking
      const verifyRes = await app.request(`/undertakings/${created.id}/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${officerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          decision: 'VERIFIED',
          remarks: 'Inspected exit blueprint and site photo; condition satisfied.',
        }),
      });
      expect(verifyRes.status).toBe(200);
      const verifyJson = (await verifyRes.json()) as { success: boolean; undertaking: Undertaking };
      expect(verifyJson.undertaking.status).toBe('VERIFIED');

      const finalLedger = await store.getLedger('APP-2024-001');
      expect(finalLedger.some((e) => e.eventType === 'UNDERTAKING_VERIFIED')).toBe(true);
    });
  });

  describe('2. Overdue Marking & Automation', () => {
    it('marks undertakings OVERDUE when due date has elapsed and records ledger entry idempotently', async () => {
      // Seeded UT-DEMO-OVERDUE has a past due date
      const ut = await store.getUndertaking('UT-DEMO-OVERDUE');
      expect(ut).toBeDefined();
      expect(ut?.status).toBe('OVERDUE');

      // Create a new PENDING undertaking with a past due date
      const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const pastUt = await store.createUndertaking({
        applicationId: 'APP-2024-001',
        conditionText: 'Past due library compliance',
        dueDate: pastDate,
        status: 'PENDING',
      });

      const marked = await markOverdueUndertakings(new Date());
      expect(marked).toBeGreaterThanOrEqual(1);

      const refreshed = await store.getUndertaking(pastUt.id);
      expect(refreshed?.status).toBe('OVERDUE');

      const ledger = await store.getLedger('APP-2024-001');
      const overdueEntries = ledger.filter(
        (e) => e.eventType === 'UNDERTAKING_OVERDUE' && e.payload.undertakingId === pastUt.id
      );
      expect(overdueEntries).toHaveLength(1);

      // Second run: 0 updates, 0 duplicate ledger entries
      const secondMarked = await markOverdueUndertakings(new Date());
      expect(secondMarked).toBe(0);

      const ledgerAfterSecond = await store.getLedger('APP-2024-001');
      const overdueEntriesSecond = ledgerAfterSecond.filter(
        (e) => e.eventType === 'UNDERTAKING_OVERDUE' && e.payload.undertakingId === pastUt.id
      );
      expect(overdueEntriesSecond).toHaveLength(1);
    });
  });

  describe('3. Escalation Levels for Undertakings', () => {
    it('escalates overdue undertakings across configured levels', async () => {
      // Seeded UT-DEMO-OVERDUE is 5 days overdue (on APP-DEMO-SCRUTINY)
      // Level 1: delay 1 day -> INSTITUTION
      // Level 2: delay 3 days -> OFFICER
      // Level 3: delay 7 days (not reached yet at 5 days)
      const result = await runAlertEngine(new Date());
      expect(result.success).toBe(true);

      const escalations = await store.listEscalations();
      const utEscalations = escalations.filter((e) => e.eventType === 'UNDERTAKING');
      expect(utEscalations.length).toBeGreaterThan(0);

      const levels = utEscalations.map((e) => e.level);
      expect(levels).toContain(1);
      expect(levels).toContain(2);

      // Verify ALERT_ESCALATION ledger entry exists
      const ledger = await store.getLedger('APP-DEMO-SCRUTINY');
      expect(ledger.some((e) => e.eventType === 'ALERT_ESCALATION')).toBe(true);
    });
  });

  describe('4. Idempotent Alert Runs', () => {
    it('running the alert engine twice creates 0 duplicate notifications, escalations or logs', async () => {
      const first = await runAlertEngine(new Date());
      expect(first.success).toBe(true);
      expect(first.remindersCreated + first.escalationsCreated).toBeGreaterThan(0);

      const notifsFirst = (await store.listNotifications()).length;
      const logsFirst = (await store.listAlertLogs()).length;
      const escalationsFirst = (await store.listEscalations()).length;

      const second = await runAlertEngine(new Date());
      expect(second.remindersCreated).toBe(0);
      expect(second.escalationsCreated).toBe(0);
      expect(second.notificationsCreated).toBe(0);
      expect(second.duplicatesSkipped).toBeGreaterThan(0);

      expect((await store.listNotifications()).length).toBe(notifsFirst);
      expect((await store.listAlertLogs()).length).toBe(logsFirst);
      expect((await store.listEscalations()).length).toBe(escalationsFirst);
    });
  });

  describe('5. Unlock after a Verified Renewal', () => {
    it('verified renewal updates document validity and unlocks a locked application', async () => {
      // APP-2024-002 is locked due to expired document COMP-DEMO-EXPIRED
      // Ensure any legacy docs on APP-2024-002 are VALID so COMP-DEMO-EXPIRED is the sole blocker
      const existingDocs = await store.getComplianceDocuments('APP-2024-002');
      for (const d of existingDocs) {
        if (d.id !== 'COMP-DEMO-EXPIRED') {
          await store.saveComplianceDocument({
            ...d,
            state: 'VALID',
            daysRemaining: 180,
            tier: undefined,
          });
        }
      }

      const appBefore = await store.getApplication('APP-2024-002');
      expect(appBefore?.locked).toBe(true);

      const instToken = await makeToken({
        sub: 'USR-INST-02',
        role: 'INSTITUTION',
        name: 'Kaveri Poly',
        email: 'kaveri.poly@aicte.gov.in',
        institutionName: 'Kaveri Polytechnic & Technical Campus',
      });

      // 1. Submit renewal
      const formData = new FormData();
      const fakePdf = new File(['%PDF-1.4 renewed fire noc'], 'renewed_fire_noc.pdf', {
        type: 'application/pdf',
      });
      formData.append('file', fakePdf);

      const renewRes = await app.request('/compliance/COMP-DEMO-EXPIRED/renew', {
        method: 'POST',
        headers: { Authorization: `Bearer ${instToken}` },
        body: formData,
      });
      expect(renewRes.status).toBe(201);
      const renewJson = (await renewRes.json()) as { complianceDocument: { renewalStatus: string } };
      expect(renewJson.complianceDocument.renewalStatus).toBe('SUBMITTED');

      // Check ledger entry
      const ledgerAfterSubmit = await store.getLedger('APP-2024-002');
      expect(ledgerAfterSubmit.some((e) => e.eventType === 'DOCUMENT_RENEWAL_SUBMITTED')).toBe(true);

      // 2. Officer verifies renewal (APP-2024-002 is region SOUTH)
      const officerToken = await makeToken({
        sub: 'USR-SOUTH-01',
        role: 'OFFICER',
        name: 'South Officer',
        email: 'officer.south@aicte.gov.in',
        region: 'SOUTH',
      });

      const verifyRes = await app.request('/compliance/COMP-DEMO-EXPIRED/verify-renewal', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${officerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          decision: 'VERIFIED',
          remarks: 'Valid Fire NOC submitted; statutory norms verified.',
        }),
      });
      expect(verifyRes.status).toBe(200);
      const verifyJson = (await verifyRes.json()) as {
        success: boolean;
        unlocked: boolean;
        complianceDocument: { state: string; daysRemaining: number };
      };
      expect(verifyJson.success).toBe(true);
      expect(verifyJson.unlocked).toBe(true);
      expect(verifyJson.complianceDocument.state).toBe('VALID');
      expect(verifyJson.complianceDocument.daysRemaining).toBeGreaterThan(0);

      // Verify application is now unlocked
      const appAfter = await store.getApplication('APP-2024-002');
      expect(appAfter?.locked).toBe(false);

      // Verify ledger has APPLICATION_UNLOCKED and DOCUMENT_RENEWAL_VERIFIED
      const finalLedger = await store.getLedger('APP-2024-002');
      expect(finalLedger.some((e) => e.eventType === 'APPLICATION_UNLOCKED')).toBe(true);
      expect(finalLedger.some((e) => e.eventType === 'DOCUMENT_RENEWAL_VERIFIED')).toBe(true);
    });
  });

  describe('6. Role & Region Boundaries (One Test Per Role)', () => {
    it('INSTITUTION: cannot see or upload evidence for another institution undertaking', async () => {
      const instToken = await makeToken({
        sub: 'USR-INST-01',
        role: 'INSTITUTION',
        name: 'Delhi Tech',
        email: 'delhi.tech@aicte.gov.in',
        institutionName: 'Delhi Institute of Advanced Technology & AI',
      });

      // UT-DEMO-SUBMITTED belongs to APP-2024-002 (Kaveri Polytechnic)
      const res = await app.request('/undertakings/UT-DEMO-SUBMITTED', {
        headers: { Authorization: `Bearer ${instToken}` },
      });
      expect(res.status).toBe(403);

      const formData = new FormData();
      formData.append('file', new File(['test'], 'test.pdf', { type: 'application/pdf' }));
      const uploadRes = await app.request('/undertakings/UT-DEMO-SUBMITTED/evidence', {
        method: 'POST',
        headers: { Authorization: `Bearer ${instToken}` },
        body: formData,
      });
      expect(uploadRes.status).toBe(403);
    });

    it('OFFICER: cannot verify undertaking outside their assigned region', async () => {
      // UT-DEMO-PENDING belongs to APP-2024-001 (region: NORTH)
      // West Officer attempts to verify it -> 403 Forbidden
      const westOfficerToken = await makeToken({
        sub: 'USR-WEST-01',
        role: 'OFFICER',
        name: 'West Officer',
        email: 'officer.west@aicte.gov.in',
        region: 'WEST',
      });

      const res = await app.request('/undertakings/UT-DEMO-PENDING/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${westOfficerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ decision: 'VERIFIED' }),
      });
      expect(res.status).toBe(403);
    });

    it('COMMITTEE: cannot verify undertakings or document renewals', async () => {
      const committeeToken = await makeToken({
        sub: 'USR-COMMITTEE-01',
        role: 'COMMITTEE',
        name: 'Committee Member',
        email: 'committee@aicte.gov.in',
        region: 'WEST',
      });

      const resUt = await app.request('/undertakings/UT-DEMO-SUBMITTED/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${committeeToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ decision: 'VERIFIED' }),
      });
      expect(resUt.status).toBe(403);

      const resRen = await app.request('/compliance/COMP-DEMO-EXPIRED/verify-renewal', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${committeeToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ decision: 'VERIFIED' }),
      });
      expect(resRen.status).toBe(403);
    });

    it('CHIEF: can access and verify undertakings across all regions', async () => {
      const chiefToken = await makeToken({
        sub: 'USR-CHIEF-01',
        role: 'CHIEF',
        name: 'Chief Officer',
        email: 'chief@aicte.gov.in',
        region: 'ALL',
      });

      // Chief can see NORTH undertaking UT-DEMO-PENDING
      const res = await app.request('/undertakings/UT-DEMO-PENDING', {
        headers: { Authorization: `Bearer ${chiefToken}` },
      });
      expect(res.status).toBe(200);

      // Chief can view verification queue
      const queueRes = await app.request('/officer/verification-queue', {
        headers: { Authorization: `Bearer ${chiefToken}` },
      });
      expect(queueRes.status).toBe(200);
      const queueJson = (await queueRes.json()) as { undertakings: unknown[]; renewals: unknown[] };
      expect(queueJson.undertakings).toBeDefined();
    });
  });

  describe('7. Rejection Safeguards & Refusal Rules', () => {
    it('refuses rejection without remarks (HTTP 400)', async () => {
      const officerToken = await makeToken({
        sub: 'USR-SOUTH-01',
        role: 'OFFICER',
        name: 'South Officer',
        email: 'officer.south@aicte.gov.in',
        region: 'SOUTH',
      });

      // Attempt to reject UT-DEMO-SUBMITTED without remarks
      const res = await app.request('/undertakings/UT-DEMO-SUBMITTED/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${officerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ decision: 'REJECTED', remarks: '   ' }),
      });
      expect(res.status).toBe(400);
    });

    it('refuses rejection without confirmed sign-off on the application (HTTP 409)', async () => {
      const officerToken = await makeToken({
        sub: 'USR-SOUTH-01',
        role: 'OFFICER',
        name: 'South Officer',
        email: 'officer.south@aicte.gov.in',
        region: 'SOUTH',
      });

      // APP-2024-002 does NOT have a CONFIRM sign-off
      const appRecord = await store.getApplication('APP-2024-002');
      expect(appRecord?.signoff?.decision).not.toBe('CONFIRM');

      const res = await app.request('/undertakings/UT-DEMO-SUBMITTED/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${officerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          decision: 'REJECTED',
          remarks: 'Missing registration details and engineering stamps',
        }),
      });
      expect(res.status).toBe(409);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain('sign-off');
    });

    it('allows rejection when remarks and confirmed sign-off are present', async () => {
      const officerToken = await makeToken({
        sub: 'USR-SOUTH-01',
        role: 'OFFICER',
        name: 'South Officer',
        email: 'officer.south@aicte.gov.in',
        region: 'SOUTH',
      });

      // Record a confirmed sign-off on APP-2024-002
      await store.recordSignoff({
        id: 'SIGNOFF-TEST-002',
        applicationId: 'APP-2024-002',
        officer: 'officer.west@aicte.gov.in',
        decision: 'CONFIRM',
        deficiencyIds: [],
        timestamp: new Date().toISOString(),
      });
      await store.updateApplication('APP-2024-002', {
        signoff: {
          id: 'SIGNOFF-TEST-002',
          applicationId: 'APP-2024-002',
          officer: 'officer.west@aicte.gov.in',
          decision: 'CONFIRM',
          deficiencyIds: [],
          timestamp: new Date().toISOString(),
        },
      });

      const res = await app.request('/undertakings/UT-DEMO-SUBMITTED/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${officerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          decision: 'REJECTED',
          remarks: 'Affidavit was executed on outdated non-judicial stamp paper.',
        }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; undertaking: Undertaking };
      expect(json.undertaking.status).toBe('REJECTED');
    });
  });

  describe('8. Duplicate Prevention', () => {
    it('refuses evidence upload for already verified undertaking', async () => {
      const instToken = await makeToken({
        sub: 'USR-INST-HIMALAYA',
        role: 'INSTITUTION',
        name: 'Himalayan Director',
        email: 'himalayan@aicte.gov.in',
        institutionName: 'Himalayan Institute of Technology & Engineering',
      });

      // UT-DEMO-VERIFIED is already VERIFIED
      const formData = new FormData();
      formData.append('file', new File(['new proof'], 'new_proof.pdf', { type: 'application/pdf' }));

      const res = await app.request('/undertakings/UT-DEMO-VERIFIED/evidence', {
        method: 'POST',
        headers: { Authorization: `Bearer ${instToken}` },
        body: formData,
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain('already verified');
    });
  });
});
