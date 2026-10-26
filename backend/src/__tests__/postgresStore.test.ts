import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { InMemoryStore, setStore } from '../db/store.js';
import { resetAlertEngineForTests } from '../services/alerts.js';
import { setAlertEmailSenderForTests } from '../services/mailer.js';
import { signJwt } from '../services/auth.js';
import { createTestDatabase, type TestDatabase } from './helpers/postgres.js';

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;
const ORIGINAL_MAIL_MODE = process.env.MAIL_MODE;
const ORIGINAL_DEMO_HEADER = process.env.ALLOW_DEMO_HEADER_ROLE;

let testDb: TestDatabase;

async function officerToken(region: 'NORTH' | 'WEST'): Promise<string> {
  return signJwt({
    sub: `USR-${region}`,
    role: 'OFFICER',
    name: `Officer ${region}`,
    email: `officer.${region.toLowerCase()}@aicte.gov.in`,
    region,
  });
}

describe('Postgres persistence (Drizzle)', () => {
  beforeAll(async () => {
    testDb = await createTestDatabase();
  });

  beforeEach(async () => {
    setStore(testDb.store);
    await testDb.store.seed();
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

  afterAll(async () => {
    setStore(new InMemoryStore());
    await testDb.close();
  });

  it('applies migrations and seeds every repository collection', async () => {
    expect((await testDb.store.listApplications()).length).toBe(15);
    expect((await testDb.store.listUsers()).length).toBe(7);
    expect((await testDb.store.getLedger('APP-2024-002')).length).toBeGreaterThan(1);
    expect((await testDb.store.listNotifications()).length).toBe(2);
  });

  it('double cron run creates no duplicate notifications, emails or escalations', async () => {
    const sentEmails: string[] = [];
    setAlertEmailSenderForTests(async (email) => {
      sentEmails.push(email.to);
      return { status: 'SENT' };
    });

    const headers = { Authorization: 'Bearer test-cron-secret' };
    const firstRes = await app.request('/cron/alerts', { headers });
    expect(firstRes.status).toBe(200);
    const first = (await firstRes.json()) as {
      success: boolean;
      notificationsCreated: number;
      escalationsCreated: number;
      emailsQueued: number;
    };
    expect(first.success).toBe(true);
    expect(first.notificationsCreated).toBeGreaterThan(0);
    expect(first.escalationsCreated).toBeGreaterThan(0);
    expect(first.emailsQueued).toBeGreaterThan(0);

    const notificationCount = (await testDb.store.listNotifications()).length;
    const alertLogCount = (await testDb.store.listAlertLogs()).length;
    const escalationCount = (await testDb.store.listEscalations()).length;
    const emailCount = sentEmails.length;

    const secondRes = await app.request('/cron/alerts', { headers });
    expect(secondRes.status).toBe(200);
    const second = (await secondRes.json()) as {
      notificationsCreated: number;
      escalationsCreated: number;
      emailsQueued: number;
      duplicatesSkipped: number;
    };
    expect(second.notificationsCreated).toBe(0);
    expect(second.escalationsCreated).toBe(0);
    expect(second.emailsQueued).toBe(0);
    expect(second.duplicatesSkipped).toBeGreaterThan(0);

    expect((await testDb.store.listNotifications()).length).toBe(notificationCount);
    expect((await testDb.store.listAlertLogs()).length).toBe(alertLogCount);
    expect((await testDb.store.listEscalations()).length).toBe(escalationCount);
    expect(sentEmails.length).toBe(emailCount);
  });

  it('requires authentication and scopes notifications by region', async () => {
    const unauth = await app.request('/notifications');
    expect(unauth.status).toBe(401);

    const now = new Date().toISOString();
    await testDb.store.addNotification({
      id: 'NOTIF-WEST-AUTH',
      applicationId: 'APP-2024-005',
      title: 'West only',
      message: 'Should never be visible to a North officer.',
      type: 'INFO',
      read: false,
      createdAt: now,
      idempotencyKey: 'test-notif-west-scope',
      recipientRole: 'OFFICER',
      region: 'WEST',
    });
    await testDb.store.addNotification({
      id: 'NOTIF-NORTH-AUTH',
      applicationId: 'APP-2024-007',
      title: 'North only',
      message: 'Visible to a North officer.',
      type: 'INFO',
      read: false,
      createdAt: now,
      idempotencyKey: 'test-notif-north-scope',
      recipientRole: 'OFFICER',
      region: 'NORTH',
    });

    const northToken = await officerToken('NORTH');
    const res = await app.request('/notifications', {
      headers: { Authorization: `Bearer ${northToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; region?: string }[];
    expect(body.some((notification) => notification.id === 'NOTIF-NORTH-AUTH')).toBe(true);
    expect(body.some((notification) => notification.id === 'NOTIF-WEST-AUTH')).toBe(false);
    expect(body.every((notification) => !notification.region || notification.region === 'NORTH' || notification.region === 'ALL')).toBe(true);
  });
});
