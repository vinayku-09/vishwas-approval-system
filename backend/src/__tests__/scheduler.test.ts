import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../app.js';
import { store } from '../db/store.js';
import { runFallbackOptimizer, haversineKm, roadDistanceKm } from '../services/optimizerFallback.js';
import { OptimizationResult } from '../types.js';

describe('Phase A: Inspector Scheduling (EVC) & Conflict Resolution Tests', () => {
  beforeEach(() => {
    store.seed();
  });

  describe('1. Distance Math & Geometric Utilities', () => {
    it('computes accurate haversine and road distance with 1.3 winding factor', () => {
      // Mumbai (19.0760, 72.8777) to Pune (18.5204, 73.8567) is ~120 km great-circle
      const hav = haversineKm(19.0760, 72.8777, 18.5204, 73.8567);
      expect(hav).toBeGreaterThan(115);
      expect(hav).toBeLessThan(130);

      const road = roadDistanceKm(19.0760, 72.8777, 18.5204, 73.8567);
      expect(road).toBeCloseTo(hav * 1.3, 0);
    });
  });

  describe('2. Optimizer Constraint Enforcement (Conflict, Domain, 2-Team Distinctness)', () => {
    it('never assigns a conflicted inspector to an affiliated institution', async () => {
      const res = await app.request('/scheduling/optimize', {
        method: 'POST',
        headers: { 'x-role': 'officer' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);

      const data = (await res.json()) as OptimizationResult;
      expect(data.assignments.length).toBeGreaterThan(0);

      const affiliations = await store.getAffiliations();
      for (const assignment of data.assignments) {
        for (const inspector of assignment.inspectors) {
          const hasConflict = affiliations.some(
            (a) =>
              a.inspectorId === inspector.id &&
              a.institutionName.toLowerCase() === assignment.institutionName.toLowerCase()
          );
          expect(hasConflict).toBe(false);
        }
      }
    });

    it('demonstrates conflict filter: nearest inspector (INS-001 in Mumbai) is skipped for VJTI Mumbai due to affiliation', async () => {
      const affiliations = await store.getAffiliations();
      const vjtiConflict = affiliations.find(
        (a) => a.inspectorId === 'INS-001' && a.institutionName.includes('VJTI')
      );
      expect(vjtiConflict).toBeDefined();

      const res = await app.request('/scheduling/optimize', {
        method: 'POST',
        headers: { 'x-role': 'officer' },
        body: JSON.stringify({ applicationIds: ['APP-2024-005'] }),
      });
      expect(res.status).toBe(200);

      const data = (await res.json()) as OptimizationResult;
      const vjtiAssignment = data.assignments.find((a) => a.applicationId === 'APP-2024-005');
      expect(vjtiAssignment).toBeDefined();

      // Nearest inspector INS-001 (Mumbai) is strictly excluded
      const assignedIds = vjtiAssignment!.inspectors.map((i) => i.id);
      expect(assignedIds).not.toContain('INS-001');

      // Conflict must be documented in excludedConflicts audit
      const excludedAudit = data.excludedConflicts.find(
        (e) => e.inspectorId === 'INS-001' && e.institutionName.includes('VJTI')
      );
      expect(excludedAudit).toBeDefined();
      expect(excludedAudit!.reason).toContain('Former Department Head');
    });

    it('strictly enforces domain matching between inspectors and institution', async () => {
      const res = await app.request('/scheduling/optimize', {
        method: 'POST',
        headers: { 'x-role': 'officer' },
      });
      const data = (await res.json()) as OptimizationResult;

      for (const assignment of data.assignments) {
        for (const inspector of assignment.inspectors) {
          expect(inspector.domain).toBe(assignment.domain);
        }
      }
    });

    it('ensures each assigned team consists of exactly 2 distinct inspectors', async () => {
      const res = await app.request('/scheduling/optimize', {
        method: 'POST',
        headers: { 'x-role': 'officer' },
      });
      const data = (await res.json()) as OptimizationResult;

      for (const assignment of data.assignments) {
        expect(assignment.inspectors).toHaveLength(2);
        expect(assignment.inspectors[0].id).not.toBe(assignment.inspectors[1].id);
      }
    });

    it('reports unassigned visits with explicit reasons when constraints cannot be satisfied', async () => {
      const res = await app.request('/scheduling/optimize', {
        method: 'POST',
        headers: { 'x-role': 'officer' },
        body: JSON.stringify({ applicationIds: ['APP-2024-015'] }), // Leh, Ladakh
      });
      expect(res.status).toBe(200);

      const data = (await res.json()) as OptimizationResult;
      const unassignedLeh = data.unassigned.find((u) => u.applicationId === 'APP-2024-015');
      expect(unassignedLeh).toBeDefined();
      expect(unassignedLeh!.reason.length).toBeGreaterThan(10);
    });

    it('includes baseline comparison and percent saved >= 0 in response', async () => {
      const res = await app.request('/scheduling/optimize', {
        method: 'POST',
        headers: { 'x-role': 'officer' },
      });
      const data = (await res.json()) as OptimizationResult;

      expect(typeof data.baselineKm).toBe('number');
      expect(typeof data.optimizedKm).toBe('number');
      expect(typeof data.percentSaved).toBe('number');
      expect(data.percentSaved).toBeGreaterThanOrEqual(0);
      expect(data.baselineKm).toBeGreaterThanOrEqual(data.optimizedKm);
      expect(['ortools', 'fallback']).toContain(data.source);
    });
  });

  describe('3. Single Application EVC Scheduling Endpoint (POST /applications/:id/schedule-evc)', () => {
    it('blocks non-officer roles with 403', async () => {
      const res = await app.request('/applications/APP-2024-005/schedule-evc', {
        method: 'POST',
        headers: { 'x-role': 'institution' },
        body: JSON.stringify({
          inspectorIds: ['INS-002', 'INS-003'],
          scheduledDate: '2026-11-04',
        }),
      });
      expect(res.status).toBe(403);
    });

    it('ignores legacy x-role headers when demo header auth is disabled', async () => {
      const previous = process.env.ALLOW_DEMO_HEADER_ROLE;
      process.env.ALLOW_DEMO_HEADER_ROLE = 'false';
      try {
        const res = await app.request('/scheduling/optimize', {
          method: 'POST',
          headers: { 'x-role': 'officer' },
          body: JSON.stringify({}),
        });
        expect(res.status).toBe(403);
      } finally {
        if (previous === undefined) {
          delete process.env.ALLOW_DEMO_HEADER_ROLE;
        } else {
          process.env.ALLOW_DEMO_HEADER_ROLE = previous;
        }
      }
    });

    it('rejects an invalid bearer token instead of falling back to demo auth', async () => {
      const res = await app.request('/applications/APP-2024-005/schedule-evc', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer not-a-valid-token',
          'x-role': 'officer',
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
    });

    it('rejects scheduling if one of the inspectors has an active conflict of interest', async () => {
      // INS-001 has active conflict with APP-2024-005 (VJTI)
      const res = await app.request('/applications/APP-2024-005/schedule-evc', {
        method: 'POST',
        headers: { 'x-role': 'officer' },
        body: JSON.stringify({
          inspectorIds: ['INS-001', 'INS-002'],
          scheduledDate: '2026-11-04',
        }),
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain('Conflict of Interest');
    });

    it('rejects scheduling if inspector domain does not match application domain', async () => {
      // APP-2024-005 is CSE, INS-004 is CIVIL
      const res = await app.request('/applications/APP-2024-005/schedule-evc', {
        method: 'POST',
        headers: { 'x-role': 'officer' },
        body: JSON.stringify({
          inspectorIds: ['INS-004', 'INS-002'],
          scheduledDate: '2026-11-04',
        }),
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain('Domain mismatch');
    });

    it('successfully schedules inspection, updates application, and writes EVC_SCHEDULED ledger entry', async () => {
      const res = await app.request('/applications/APP-2024-005/schedule-evc', {
        method: 'POST',
        headers: { 'x-role': 'officer' },
        body: JSON.stringify({
          inspectorIds: ['INS-002', 'INS-003'],
          scheduledDate: '2026-11-04',
          source: 'fallback',
        }),
      });
      expect(res.status).toBe(201);

      // Verify application updated
      const appRecord = await store.getApplication('APP-2024-005');
      expect(appRecord?.scheduledInspection).toBeDefined();
      expect(appRecord?.scheduledInspection?.scheduledDate).toBe('2026-11-04');
      expect(appRecord?.scheduledInspection?.inspectors).toHaveLength(2);

      // Verify ledger entry
      const ledger = await store.getLedger('APP-2024-005');
      const evcEntry = ledger.find((e) => e.eventType === 'EVC_SCHEDULED');
      expect(evcEntry).toBeDefined();
      expect(evcEntry?.payload.source).toBe('fallback');
      expect(evcEntry?.payload.inspectorIds).toEqual(['INS-002', 'INS-003']);
    });
  });

  describe('4. Committee Inspections List & Report Filing (GET /inspections, POST /applications/:id/evc-report)', () => {
    it('returns inspection assignments with optional inspector filtering', async () => {
      const allRes = await app.request('/inspections', {
        method: 'GET',
        headers: { 'x-role': 'committee' },
      });
      expect(allRes.status).toBe(200);
      const all = (await allRes.json()) as unknown[];
      expect(all.length).toBeGreaterThanOrEqual(1);

      // Filter by inspector INS-002
      const filterRes = await app.request('/inspections?inspectorId=INS-002', {
        method: 'GET',
        headers: { 'x-role': 'committee' },
      });
      expect(filterRes.status).toBe(200);
      const filtered = (await filterRes.json()) as Array<{ inspectors: Array<{ id: string }> }>;
      for (const item of filtered) {
        expect(item.inspectors.some((i) => i.id === 'INS-002')).toBe(true);
      }
    });

    it('allows committee member to file an EVC report, moving state to EVC_DONE with hashed report ledger entry', async () => {
      // First ensure APP-2024-005 has a scheduled inspection
      await app.request('/applications/APP-2024-005/schedule-evc', {
        method: 'POST',
        headers: { 'x-role': 'officer' },
        body: JSON.stringify({
          inspectorIds: ['INS-002', 'INS-003'],
          scheduledDate: '2026-11-04',
        }),
      });

      const reportPayload = {
        findings: {
          infrastructure: 'Academic floor area of 24,000 sq.m verified with smart board classrooms.',
          faculty: 'Cadre ratio meets 1:20 norm with 18 doctorate degree holders.',
          labs: '15 server racks and 450 GPU-enabled computing nodes inspected.',
          remarks: 'Institutional infrastructure exceeds statutory minimum requirements.',
        },
        recommendation: 'RECOMMENDED' as const,
      };

      const res = await app.request('/applications/APP-2024-005/evc-report', {
        method: 'POST',
        headers: {
          'x-role': 'committee',
          'x-actor': 'INS-002',
        },
        body: JSON.stringify(reportPayload),
      });

      expect(res.status).toBe(201);
      const data = (await res.json()) as { application: { status: string }; report: { reportHash: string } };
      expect(data.application.status).toBe('EVC_DONE');
      expect(data.report.reportHash).toHaveLength(64); // SHA-256 hash length

      // Verify application status in database
      const appObj = await store.getApplication('APP-2024-005');
      expect(appObj?.status).toBe('EVC_DONE');

      // Verify cryptographic ledger entry
      const ledger = await store.getLedger('APP-2024-005');
      const reportLedgerEntry = ledger.find((e) => e.eventType === 'EVC_REPORT_SUBMITTED');
      expect(reportLedgerEntry).toBeDefined();
      expect(reportLedgerEntry?.actor).toBe('committee');
      expect(reportLedgerEntry?.payload.reportHash).toBe(data.report.reportHash);
      expect(reportLedgerEntry?.payload.recommendation).toBe('RECOMMENDED');
    });

    it('rejects EVC report submission if application is not in EVC_REQUIRED', async () => {
      // APP-2024-001 is in SUBMITTED
      const res = await app.request('/applications/APP-2024-001/evc-report', {
        method: 'POST',
        headers: { 'x-role': 'committee' },
        body: JSON.stringify({
          findings: {
            infrastructure: 'Test',
            faculty: 'Test',
            labs: 'Test',
            remarks: 'Test',
          },
          recommendation: 'RECOMMENDED',
        }),
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain('Invalid application status');
    });
  });
});
