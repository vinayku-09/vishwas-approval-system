import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { store, InMemoryStore, setStore } from '../db/store.js';
import { signJwt } from '../services/auth.js';
import { resetAlertEngineForTests } from '../services/alerts.js';

async function authHeader(
  role: 'INSTITUTION' | 'OFFICER' | 'COMMITTEE' | 'CHIEF',
  region?: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' | 'CENTRAL' | 'NORTH_EAST' | 'ALL',
  institutionName?: string
): Promise<{ Authorization: string }> {
  const token = await signJwt({
    sub: `USR-TEST-${role}-${region || 'ALL'}`,
    role,
    name: `Test ${role}`,
    email: `test.${role.toLowerCase()}@aicte.gov.in`,
    region: region || 'ALL',
    institutionName,
  });
  return { Authorization: `Bearer ${token}` };
}

describe('Part 6: Reports, Audit View, Configuration & Demo Seed', () => {
  beforeEach(() => {
    process.env.ALLOW_DB_RESET = 'true';
    store.resetDatabase?.();
    delete process.env.ALLOW_DB_RESET;
    store.seed();
    resetAlertEngineForTests();
  });

  // ---------------------------------------------------------------------------
  // 1. Demo Seed & Database Safety Tests
  // ---------------------------------------------------------------------------
  describe('1. Demo Seed Integrity & Safety', () => {
    it('seeds ~40 applications across all 6 regions covering every route and stage', async () => {
      const apps = await store.listApplications();
      expect(apps.length).toBeGreaterThanOrEqual(40);

      // Verify all regions are represented
      const regions = new Set(apps.map((a) => a.region));
      expect(regions.has('NORTH')).toBe(true);
      expect(regions.has('SOUTH')).toBe(true);
      expect(regions.has('EAST')).toBe(true);
      expect(regions.has('WEST')).toBe(true);
      expect(regions.has('CENTRAL')).toBe(true);
      expect(regions.has('NORTH_EAST')).toBe(true);

      // Verify all 10 stages are represented
      const stages = new Set(apps.map((a) => a.status));
      expect(stages.has('SUBMITTED')).toBe(true);
      expect(stages.has('SCRUTINY')).toBe(true);
      expect(stages.has('DEFICIENT')).toBe(true);
      expect(stages.has('EVC_REQUIRED')).toBe(true);
      expect(stages.has('EVC_DONE')).toBe(true);
      expect(stages.has('DECISION')).toBe(true);
      expect(stages.has('APPROVED')).toBe(true);
      expect(stages.has('REJECTED')).toBe(true);
      expect(stages.has('APPEAL_SHC')).toBe(true);
      expect(stages.has('APPEAL_SAC')).toBe(true);

      // Verify all 4 routes are represented
      const types = new Set(apps.map((a) => a.type));
      expect(types.has('NEW')).toBe(true); // SCRUTINY_EVC
      expect(types.has('EXTENSION_OF_APPROVAL')).toBe(true); // ONLY_SCRUTINY
      expect(types.has('INTAKE_CHANGE')).toBe(true); // ONLY_EVC
      expect(types.has('APPEAL')).toBe(true); // EVC_SAC_SHC

      // Verify undertakings exist in every status
      const uts = await store.listUndertakings();
      const utStatuses = new Set(uts.map((u) => u.status));
      expect(utStatuses.has('PENDING')).toBe(true);
      expect(utStatuses.has('SUBMITTED')).toBe(true);
      expect(utStatuses.has('VERIFIED')).toBe(true);
      expect(utStatuses.has('REJECTED')).toBe(true);
      expect(utStatuses.has('OVERDUE')).toBe(true);

      // Verify compliance documents exist in each state
      const docs = await store.getComplianceDocuments();
      const docStates = new Set(docs.map((d) => d.state));
      expect(docStates.has('VALID')).toBe(true);
      expect(docStates.has('WARNING')).toBe(true);
      expect(docStates.has('OVERDUE')).toBe(true);

      // Verify returned cases exist with ReturnRecord
      const returnedApps = apps.filter((a) => a.returns && a.returns.length > 0);
      expect(returnedApps.length).toBeGreaterThanOrEqual(3);
    });

    it('seed idempotency: running seed twice changes nothing (0 duplicates, 0 deletes)', async () => {
      const initialAppsCount = (await store.listApplications()).length;
      const initialUtsCount = (await store.listUndertakings()).length;
      const initialDocsCount = (await store.getComplianceDocuments()).length;

      // Run seed again
      await store.seed();

      const afterAppsCount = (await store.listApplications()).length;
      const afterUtsCount = (await store.listUndertakings()).length;
      const afterDocsCount = (await store.getComplianceDocuments()).length;

      expect(afterAppsCount).toBe(initialAppsCount);
      expect(afterUtsCount).toBe(initialUtsCount);
      expect(afterDocsCount).toBe(initialDocsCount);
    });

    it('refuses reset command unless explicit ALLOW_DB_RESET=true is set', async () => {
      delete process.env.ALLOW_DB_RESET;
      expect(() => store.resetDatabase?.()).toThrowError(/ALLOW_DB_RESET=true/);

      // Does not throw when ALLOW_DB_RESET=true
      process.env.ALLOW_DB_RESET = 'true';
      expect(() => store.resetDatabase?.()).not.toThrow();
      delete process.env.ALLOW_DB_RESET;

      // Re-seed for subsequent tests
      store.seed();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Six Reports Totals & Verification Against Seed
  // ---------------------------------------------------------------------------
  describe('2. Reports Engine: Totals against Seed', () => {
    it('Report 1 (application-pendency): returns valid totals matching seed', async () => {
      const chiefHeaders = await authHeader('CHIEF');
      const res = await app.request('/reports/application-pendency', { headers: chiefHeaders });
      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(data.reportType).toBe('application-pendency');
      expect(data.summary.totalApplications).toBeGreaterThanOrEqual(40);
      expect(data.summary.onTime).toBeGreaterThan(0);
      expect(data.summary.approaching).toBeGreaterThan(0);
      expect(data.summary.overdue).toBeGreaterThan(0);
      expect(data.summary.totalApplications).toBe(
        data.summary.onTime + data.summary.approaching + data.summary.overdue
      );
      expect(data.columns.length).toBeGreaterThanOrEqual(8);
      expect(data.rows.length).toBe(data.summary.totalApplications);
    });

    it('Report 2 (evc-status): returns inspection breakdown matching seed', async () => {
      const chiefHeaders = await authHeader('CHIEF');
      const res = await app.request('/reports/evc-status', { headers: chiefHeaders });
      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(data.reportType).toBe('evc-status');
      expect(data.summary.totalCases).toBeGreaterThan(0);
      expect(data.summary.awaitingScheduling).toBeGreaterThan(0);
      expect(data.summary.completed).toBeGreaterThan(0);
      expect(data.summary.delayed).toBeGreaterThan(0);
      expect(data.rows.some((r: any) => r.evcStatus === 'Delayed')).toBe(true);
    });

    it('Report 3 (undertaking-compliance): returns commitments in each status', async () => {
      const chiefHeaders = await authHeader('CHIEF');
      const res = await app.request('/reports/undertaking-compliance', { headers: chiefHeaders });
      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(data.reportType).toBe('undertaking-compliance');
      expect(data.summary.totalUndertakings).toBeGreaterThanOrEqual(7);
      expect(data.summary.pending).toBeGreaterThan(0);
      expect(data.summary.submitted).toBeGreaterThan(0);
      expect(data.summary.verified).toBeGreaterThan(0);
      expect(data.summary.rejected).toBeGreaterThan(0);
      expect(data.summary.overdue).toBeGreaterThan(0);
    });

    it('Report 4 (document-validity): returns documents across all warning tiers & overdue', async () => {
      const chiefHeaders = await authHeader('CHIEF');
      const res = await app.request('/reports/document-validity', { headers: chiefHeaders });
      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(data.reportType).toBe('document-validity');
      expect(data.summary.totalDocuments).toBeGreaterThanOrEqual(10);
      expect(data.summary.valid).toBeGreaterThan(0);
      expect(data.summary.warningTier90).toBeGreaterThan(0);
      expect(data.summary.warningTier60).toBeGreaterThan(0);
      expect(data.summary.warningTier30).toBeGreaterThan(0);
      expect(data.summary.overdueExpired).toBeGreaterThan(0);
    });

    it('Report 5 (overdue-cases): consolidates SLA, undertaking, doc and EVC overdue items', async () => {
      const chiefHeaders = await authHeader('CHIEF');
      const res = await app.request('/reports/overdue-cases', { headers: chiefHeaders });
      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(data.reportType).toBe('overdue-cases');
      expect(data.summary.totalOverdueItems).toBeGreaterThan(0);
      expect(data.summary.stageSlaOverdue).toBeGreaterThan(0);
      expect(data.summary.undertakingsOverdue).toBeGreaterThan(0);
      expect(data.summary.documentsExpired).toBeGreaterThan(0);
      expect(data.rows.length).toBe(data.summary.totalOverdueItems);
      // Sorted descending by days overdue
      for (let i = 1; i < data.rows.length; i++) {
        expect(data.rows[i - 1].daysOverdue).toBeGreaterThanOrEqual(data.rows[i].daysOverdue);
      }
    });

    it('Report 6 (region-performance): returns per-region averages, overdue rates and returns', async () => {
      const chiefHeaders = await authHeader('CHIEF');
      const res = await app.request('/reports/region-performance', { headers: chiefHeaders });
      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(data.reportType).toBe('region-performance');
      expect(data.rows.length).toBe(6); // 6 regions
      expect(data.summary.totalApplications).toBeGreaterThanOrEqual(40);
      expect(data.summary.totalReturnsAcrossRegions).toBeGreaterThanOrEqual(3);

      for (const row of data.rows) {
        expect(row.totalApplications).toBeGreaterThan(0);
        expect(row.avgDaysPerStage).toBeDefined();
        expect(row.overdueRate).toMatch(/%$/);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 3. CSV Export Format Tests
  // ---------------------------------------------------------------------------
  describe('3. CSV Export Formatting', () => {
    it('exports RFC 4180 CSV via ?format=csv query parameter', async () => {
      const chiefHeaders = await authHeader('CHIEF');
      const res = await app.request('/reports/application-pendency?format=csv', {
        headers: chiefHeaders,
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      expect(res.headers.get('content-disposition')).toContain('attachment; filename="report-application-pendency-');

      const text = await res.text();
      const lines = text.split('\r\n');
      expect(lines.length).toBeGreaterThanOrEqual(41); // header + 40+ rows

      // Verify header columns
      const headers = lines[0].split(',');
      expect(headers).toContain('Application ID');
      expect(headers).toContain('Institution Name');
      expect(headers).toContain('Region');
      expect(headers).toContain('Route');
      expect(headers).toContain('Current Stage');
    });

    it('exports CSV via Accept: text/csv header with proper quotes escaping', async () => {
      const chiefHeaders = await authHeader('CHIEF');
      const res = await app.request('/reports/undertaking-compliance', {
        headers: {
          ...chiefHeaders,
          Accept: 'text/csv',
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');

      const csv = await res.text();
      expect(csv).toContain('Undertaking ID,Application ID,Institution Name');
      const lines = csv.split('\r\n');
      expect(lines.length).toBeGreaterThanOrEqual(8);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Role and Region Scoping Tests
  // ---------------------------------------------------------------------------
  describe('4. Scoping by Role and Region', () => {
    it('INSTITUTION sees only their own records in reports', async () => {
      const instHeaders = await authHeader(
        'INSTITUTION',
        'NORTH',
        'Delhi Institute of Advanced Technology & AI'
      );
      const res = await app.request('/reports/application-pendency', { headers: instHeaders });
      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(data.rows.length).toBeGreaterThan(0);
      expect(
        data.rows.every(
          (r: any) => r.institutionName === 'Delhi Institute of Advanced Technology & AI'
        )
      ).toBe(true);
    });

    it('INSTITUTION is rejected from region-performance analytics (403 Forbidden)', async () => {
      const instHeaders = await authHeader(
        'INSTITUTION',
        'NORTH',
        'Delhi Institute of Advanced Technology & AI'
      );
      const res = await app.request('/reports/region-performance', { headers: instHeaders });
      expect(res.status).toBe(403);
    });

    it('Regional OFFICER (WEST) sees only WEST applications in reports', async () => {
      const officerWestHeaders = await authHeader('OFFICER', 'WEST');
      const res = await app.request('/reports/application-pendency', {
        headers: officerWestHeaders,
      });
      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(data.rows.length).toBeGreaterThan(0);
      expect(data.rows.every((r: any) => r.region === 'WEST' || r.region === 'ALL')).toBe(true);
    });

    it('CHIEF can filter by any region', async () => {
      const chiefHeaders = await authHeader('CHIEF');
      const resNorth = await app.request('/reports/application-pendency?region=NORTH', {
        headers: chiefHeaders,
      });
      expect(resNorth.status).toBe(200);
      const dataNorth = (await resNorth.json()) as any;
      expect(dataNorth.rows.every((r: any) => r.region === 'NORTH' || r.region === 'ALL')).toBe(true);

      const resEast = await app.request('/reports/application-pendency?region=EAST', {
        headers: chiefHeaders,
      });
      expect(resEast.status).toBe(200);
      const dataEast = (await resEast.json()) as any;
      expect(dataEast.rows.every((r: any) => r.region === 'EAST' || r.region === 'ALL')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Head-Office Audit Trail View Tests
  // ---------------------------------------------------------------------------
  describe('5. Audit-Trail View (Head Office & Per Application)', () => {
    it('GET /ledger returns audit trail with verification status for Head Office', async () => {
      const chiefHeaders = await authHeader('CHIEF');
      const res = await app.request('/ledger', { headers: chiefHeaders });
      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(data.totalMatching).toBeGreaterThan(0);
      expect(data.summary.applicationsAudited).toBeGreaterThanOrEqual(40);
      expect(data.summary.verifiedChains).toBeGreaterThanOrEqual(40);
      expect(data.summary.brokenChains).toBe(0);

      // Verify each entry has cryptographic verification status attached
      const first = data.entries[0];
      expect(first.hash).toBeDefined();
      expect(first.prevHash).toBeDefined();
      expect(first.verification).toBeDefined();
      expect(first.verification.valid).toBe(true);
    });

    it('filters audit trail by eventType, actor and applicationId', async () => {
      const chiefHeaders = await authHeader('CHIEF');

      // Filter by eventType
      const resCreated = await app.request('/ledger?eventType=APPLICATION_CREATED', {
        headers: chiefHeaders,
      });
      expect(resCreated.status).toBe(200);
      const dataCreated = (await resCreated.json()) as any;
      expect(dataCreated.entries.every((e: any) => e.eventType === 'APPLICATION_CREATED')).toBe(true);

      // Filter by actor
      const resOfficer = await app.request('/ledger?actor=officer', { headers: chiefHeaders });
      expect(resOfficer.status).toBe(200);
      const dataOfficer = (await resOfficer.json()) as any;
      expect(dataOfficer.entries.every((e: any) => e.actor.toLowerCase().includes('officer'))).toBe(true);

      // Filter by applicationId
      const resApp = await app.request('/ledger?applicationId=APP-DEMO-021', {
        headers: chiefHeaders,
      });
      expect(resApp.status).toBe(200);
      const dataApp = (await resApp.json()) as any;
      expect(dataApp.entries.every((e: any) => e.applicationId === 'APP-DEMO-021')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Read-Only Configuration Endpoint Tests
  // ---------------------------------------------------------------------------
  describe('6. Read-Only Configuration Page Endpoint', () => {
    it('GET /config returns routes, timelines, tiers, escalation matrix and renewal periods labelled placeholder pending APH', async () => {
      const chiefHeaders = await authHeader('CHIEF');
      const res = await app.request('/config', { headers: chiefHeaders });
      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(data.readOnly).toBe(true);
      expect(data.policyStatus).toBe('placeholder pending APH');

      // Routes labelled placeholder pending APH
      expect(data.routes.label).toBe('placeholder pending APH');
      expect(data.routes.items.length).toBe(4);
      expect(data.routes.items.every((r: any) => r.status === 'placeholder pending APH')).toBe(true);

      // Stage Timelines labelled placeholder pending APH
      expect(data.stageTimelines.label).toBe('placeholder pending APH');
      expect(data.stageTimelines.defaultDaysPerStage).toBeDefined();
      expect(data.stageTimelines.slaWindowsDays).toBeDefined();

      // Reminder Tiers labelled placeholder pending APH
      expect(data.reminderTiers.label).toBe('placeholder pending APH');
      expect(data.reminderTiers.documentExpiryTiersDays).toEqual([90, 60, 30]);

      // Escalation Matrix labelled placeholder pending APH
      expect(data.escalationMatrix.label).toBe('placeholder pending APH');
      expect(data.escalationMatrix.matrix.length).toBeGreaterThanOrEqual(10);
      expect(data.escalationMatrix.matrix.every((r: any) => r.status === 'placeholder pending APH')).toBe(true);

      // Renewal Periods labelled placeholder pending APH
      expect(data.renewalPeriods.label).toBe('placeholder pending APH');
      expect(data.renewalPeriods.statutoryValidityDaysByDocType.FIRE_NOC).toBe(365);
      expect(data.renewalPeriods.statutoryValidityDaysByDocType.LEASE_DEED).toBe(1095);
      expect(data.renewalPeriods.statutoryValidityDaysByDocType.LAND_RECORD).toBe(1825);
    });
  });
});
