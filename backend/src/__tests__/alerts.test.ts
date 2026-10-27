import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { store } from '../db/store.js';
import { signJwt } from '../services/auth.js';
import {
  runAlertEngine,
  resetAlertEngineForTests,
} from '../services/alerts.js';
import { buildAlertEmail, setAlertEmailSenderForTests } from '../services/mailer.js';

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;
const ORIGINAL_MAIL_MODE = process.env.MAIL_MODE;
const ORIGINAL_DEMO_HEADER = process.env.ALLOW_DEMO_HEADER_ROLE;

async function officerToken(region: 'WEST' | 'ALL' | 'NORTH'): Promise<string> {
  return signJwt({
    sub: `USR-${region}`,
    role: 'OFFICER',
    name: `Officer ${region}`,
    email: `officer.${region.toLowerCase()}@aicte.gov.in`,
    region,
  });
}

describe('Phase C: Alert & Escalation Engine', () => {
  beforeEach(() => {
    process.env.ALLOW_DB_RESET = 'true';
    store.resetDatabase?.();
    delete process.env.ALLOW_DB_RESET;
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
    if (ORIGINAL_DEMO_HEADER === undefined) delete process.env.ALLOW_DEMO_HEADER_ROLE;
    else process.env.ALLOW_DEMO_HEADER_ROLE = ORIGINAL_DEMO_HEADER;
  });

  describe('1. Cron endpoint security', () => {
    it('refuses all requests with 503 when CRON_SECRET is unset', async () => {
      delete process.env.CRON_SECRET;
      const getRes = await app.request('/cron/alerts');
      const postRes = await app.request('/cron/alerts', { method: 'POST' });
      expect(getRes.status).toBe(503);
      expect(postRes.status).toBe(503);
    });

    it('rejects a missing or wrong bearer token with 401', async () => {
      const missing = await app.request('/cron/alerts');
      expect(missing.status).toBe(401);

      const wrong = await app.request('/cron/alerts', {
        headers: { Authorization: 'Bearer nope' },
      });
      expect(wrong.status).toBe(401);
    });

    it('supports both GET and POST with the configured secret', async () => {
      const getRes = await app.request('/cron/alerts', {
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      expect(getRes.status).toBe(200);

      store.seed();
      resetAlertEngineForTests();
      const postRes = await app.request('/cron/alerts', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      expect(postRes.status).toBe(200);
    });
  });

  describe('2. Reminder & escalation generation', () => {
    it('creates reminders and escalations across every category', async () => {
      const result = await runAlertEngine(new Date());
      expect(result.success).toBe(true);
      expect(result.remindersCreated).toBeGreaterThan(0);
      expect(result.escalationsCreated).toBeGreaterThan(0);

      const logs = await store.listAlertLogs();
      const types = new Set(logs.map((log) => log.eventType));
      expect(types.has('DOCUMENT_EXPIRY')).toBe(true);
      expect(types.has('PENDENCY')).toBe(true);
      expect(types.has('REPORT_SUBMISSION')).toBe(true);
      expect(types.has('UNDERTAKING')).toBe(true);
      expect(types.has('DOCUMENT_AUTHENTICITY')).toBe(true);

      const escalations = await store.listEscalations();
      expect(escalations.length).toBeGreaterThan(0);
      expect(escalations.every((e) => e.status === 'OPEN')).toBe(true);
    });

    it('is idempotent: reruns never duplicate notifications, emails or ledger entries', async () => {
      await runAlertEngine(new Date());
      const notificationsAfterFirst = (await store.listNotifications()).length;
      const logsAfterFirst = (await store.listAlertLogs()).length;
      const escalationsAfterFirst = (await store.listEscalations()).length;

      const second = await runAlertEngine(new Date());
      expect(second.remindersCreated).toBe(0);
      expect(second.escalationsCreated).toBe(0);
      expect(second.notificationsCreated).toBe(0);

      expect((await store.listNotifications()).length).toBe(notificationsAfterFirst);
      expect((await store.listAlertLogs()).length).toBe(logsAfterFirst);
      expect((await store.listEscalations()).length).toBe(escalationsAfterFirst);
    });

    it('writes ALERT_REMINDER and ALERT_ESCALATION ledger entries', async () => {
      await runAlertEngine(new Date());
      const logs = await store.listAlertLogs();
      const sample = logs[0];
      const ledger = await store.getLedger(sample.applicationId);
      expect(ledger.some((e) => e.eventType === 'ALERT_REMINDER' || e.eventType === 'ALERT_ESCALATION')).toBe(true);
    });
  });

  describe('3. Email delivery', () => {
    it('contains only application id, one-line reason and portal link', () => {
      const email = buildAlertEmail({
        to: 'officer@aicte.gov.in',
        applicationId: 'APP-2024-002',
        eventType: 'DOCUMENT_EXPIRY',
        kind: 'Reminder',
      });
      expect(email.text).toContain('APP-2024-002');
      expect(email.text).toContain('/alerts');
      expect(email.text.split('\n')).toHaveLength(3);
      // No document numbers, file names or personal data
      expect(email.text).not.toMatch(/FIRE_NOC|lease|NOC-/i);
    });

    it('records FAILED status after one retry when delivery fails', async () => {
      let attempts = 0;
      setAlertEmailSenderForTests(async () => {
        attempts += 1;
        return { status: 'FAILED', error: 'smtp down' };
      });
      await runAlertEngine(new Date());
      expect(attempts).toBeGreaterThanOrEqual(2); // at least one retry

      const logs = await store.listAlertLogs();
      expect(logs.some((log) => log.mailStatus === 'FAILED')).toBe(true);
    });
  });

  describe('4. Escalation lifecycle & scoping', () => {
    it('acknowledges and resolves an escalation, requiring remarks and writing ledger entries', async () => {
      await runAlertEngine(new Date());
      const escalations = await store.listEscalations({ status: 'OPEN' });
      const target = escalations[0];
      const token = await officerToken('ALL');
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

      const ackRes = await app.request(`/escalations/${target.id}/acknowledge`, {
        method: 'POST',
        headers,
      });
      expect(ackRes.status).toBe(200);
      const ackBody = (await ackRes.json()) as { escalation: { status: string } };
      expect(ackBody.escalation.status).toBe('ACKNOWLEDGED');

      const missingRemarks = await app.request(`/escalations/${target.id}/resolve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ remarks: '   ' }),
      });
      expect(missingRemarks.status).toBe(400);

      const resolveRes = await app.request(`/escalations/${target.id}/resolve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ remarks: 'Institution submitted renewed NOC.' }),
      });
      expect(resolveRes.status).toBe(200);
      const resolved = await store.getEscalation(target.id);
      expect(resolved?.status).toBe('RESOLVED');
      expect(resolved?.remarks).toContain('renewed NOC');

      const ledger = await store.getLedger(target.applicationId);
      expect(ledger.some((e) => e.eventType === 'ESCALATION_ACKNOWLEDGED')).toBe(true);
      expect(ledger.some((e) => e.eventType === 'ESCALATION_RESOLVED')).toBe(true);
    });

    it('scopes officer listings to their region while CHIEF sees everything', async () => {
      await runAlertEngine(new Date());

      const westToken = await officerToken('WEST');
      const westRes = await app.request('/escalations', {
        headers: { Authorization: `Bearer ${westToken}` },
      });
      expect(westRes.status).toBe(200);
      const westBody = (await westRes.json()) as {
        escalations: { region: string }[];
      };
      expect(westBody.escalations.length).toBeGreaterThan(0);
      expect(westBody.escalations.every((e) => e.region === 'WEST' || e.region === 'ALL')).toBe(true);

      const chiefToken = await signJwt({
        sub: 'USR-CHIEF',
        role: 'CHIEF',
        name: 'Chief',
        email: 'chief@aicte.gov.in',
        region: 'ALL',
      });
      const chiefRes = await app.request('/escalations', {
        headers: { Authorization: `Bearer ${chiefToken}` },
      });
      const chiefBody = (await chiefRes.json()) as { total: number };
      expect(chiefBody.total).toBeGreaterThanOrEqual(westBody.escalations.length);
    });

    it('rejects institution callers and unauthenticated requests', async () => {
      const unauth = await app.request('/escalations');
      expect(unauth.status).toBe(401);

      const institutionToken = await signJwt({
        sub: 'USR-INST',
        role: 'INSTITUTION',
        name: 'Institution',
        email: 'inst@example.edu',
        institutionName: 'Delhi Institute of Advanced Technology & AI',
      });
      const res = await app.request('/escalations', {
        headers: { Authorization: `Bearer ${institutionToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('scopes notifications for institutions and regional officers', async () => {
      await runAlertEngine(new Date());
      const allNotifications = await store.listNotifications();

      const institutionToken = await signJwt({
        sub: 'USR-INST',
        role: 'INSTITUTION',
        name: 'Institution',
        email: 'inst@example.edu',
        institutionName: 'Delhi Institute of Advanced Technology & AI',
      });
      const institutionRes = await app.request('/notifications', {
        headers: { Authorization: `Bearer ${institutionToken}` },
      });
      expect(institutionRes.status).toBe(200);
      const institutionBody = (await institutionRes.json()) as {
        institutionName?: string;
      }[];
      expect(
        institutionBody.every(
          (n) =>
            !n.institutionName ||
            n.institutionName === 'Delhi Institute of Advanced Technology & AI'
        )
      ).toBe(true);
      expect(institutionBody.length).toBeLessThan(allNotifications.length);

      const westToken = await officerToken('WEST');
      const westRes = await app.request('/notifications', {
        headers: { Authorization: `Bearer ${westToken}` },
      });
      const westBody = (await westRes.json()) as { region?: string }[];
      expect(
        westBody.every((n) => !n.region || n.region === 'WEST' || n.region === 'ALL')
      ).toBe(true);
    });

    it('honors the demo x-role header only when explicitly enabled', async () => {
      await runAlertEngine(new Date());
      const allNotifications = await store.listNotifications();

      delete process.env.ALLOW_DEMO_HEADER_ROLE;
      const disabled = await app.request('/notifications', {
        headers: { 'x-role': 'institution' },
      });
      expect(disabled.status).toBe(401);

      process.env.ALLOW_DEMO_HEADER_ROLE = 'true';
      const enabled = await app.request('/notifications', {
        headers: { 'x-role': 'institution' },
      });
      const scoped = (await enabled.json()) as { institutionName?: string }[];
      expect(
        scoped.every(
          (n) =>
            !n.institutionName ||
            n.institutionName === 'Delhi Institute of Advanced Technology & AI'
        )
      ).toBe(true);
      expect(scoped.length).toBeLessThan(allNotifications.length);
    });
  });
});
