import { describe, it, expect, beforeEach } from 'vitest';
import { computeExpiryState } from '../services/expiry.js';
import { runWithRetry, ModelGeneratorFn } from '../services/extractor.js';
import { store } from '../db/store.js';
import { app } from '../app.js';
import { createHash } from 'node:crypto';

describe('Vishwas Pipeline & Regulatory Tests', () => {
  beforeEach(() => {
    store.seed();
  });

  describe('1. computeExpiryState Exact Boundary Tests', () => {
    const baseDate = new Date('2025-01-01T00:00:00.000Z');

    const getDateWithOffset = (offsetDays: number) => {
      const d = new Date(baseDate.getTime() + offsetDays * 24 * 60 * 60 * 1000);
      return d.toISOString().split('T')[0];
    };

    it('returns VALID when remaining days > 90 (e.g. 91 days)', () => {
      const res = computeExpiryState(getDateWithOffset(91), baseDate);
      expect(res.daysRemaining).toBe(91);
      expect(res.state).toBe('VALID');
      expect(res.tier).toBeUndefined();
    });

    it('returns WARNING (tier 90) when remaining days is exactly 90', () => {
      const res = computeExpiryState(getDateWithOffset(90), baseDate);
      expect(res.daysRemaining).toBe(90);
      expect(res.state).toBe('WARNING');
      expect(res.tier).toBe(90);
    });

    it('returns WARNING (tier 60) when remaining days is exactly 60', () => {
      const res = computeExpiryState(getDateWithOffset(60), baseDate);
      expect(res.daysRemaining).toBe(60);
      expect(res.state).toBe('WARNING');
      expect(res.tier).toBe(60);
    });

    it('returns WARNING (tier 30) when remaining days is exactly 30', () => {
      const res = computeExpiryState(getDateWithOffset(30), baseDate);
      expect(res.daysRemaining).toBe(30);
      expect(res.state).toBe('WARNING');
      expect(res.tier).toBe(30);
    });

    it('returns WARNING (tier 30) when remaining days is exactly 1', () => {
      const res = computeExpiryState(getDateWithOffset(1), baseDate);
      expect(res.daysRemaining).toBe(1);
      expect(res.state).toBe('WARNING');
      expect(res.tier).toBe(30);
    });

    it('returns OVERDUE when remaining days is exactly 0', () => {
      const res = computeExpiryState(getDateWithOffset(0), baseDate);
      expect(res.daysRemaining).toBe(0);
      expect(res.state).toBe('OVERDUE');
      expect(res.tier).toBeUndefined();
    });

    it('returns OVERDUE when remaining days is -1 (past expiry)', () => {
      const res = computeExpiryState(getDateWithOffset(-1), baseDate);
      expect(res.daysRemaining).toBe(-1);
      expect(res.state).toBe('OVERDUE');
      expect(res.tier).toBeUndefined();
    });
  });

  describe('2. Expiry Cron Idempotency Tests', () => {
    it('running expiry cron twice never duplicates notifications or ledger entries', async () => {
      const authHeader = { Authorization: 'Bearer dev-cron-secret' };

      // First cron run
      const res1 = await app.request('/cron/expiry-check', {
        method: 'POST',
        headers: authHeader,
      });
      expect(res1.status).toBe(200);
      const json1 = (await res1.json()) as { success: boolean; notificationsCreated: number };
      expect(json1.success).toBe(true);

      const notifsAfterFirst = await store.listNotifications();
      const countAfterFirst = notifsAfterFirst.length;

      // Second cron run (identical state)
      const res2 = await app.request('/cron/expiry-check', {
        method: 'POST',
        headers: authHeader,
      });
      expect(res2.status).toBe(200);
      const json2 = (await res2.json()) as { success: boolean; notificationsCreated: number };
      expect(json2.notificationsCreated).toBe(0); // 0 new notifications created due to idempotency

      const notifsAfterSecond = await store.listNotifications();
      expect(notifsAfterSecond.length).toBe(countAfterFirst);
    });

    it('rejects unauthorized cron requests without bearer secret', async () => {
      const res = await app.request('/cron/expiry-check', {
        method: 'POST',
        headers: { Authorization: 'Bearer invalid-token' },
      });
      expect(res.status).toBe(401);
    });
  });

  describe('3. Locked Application & Override Advancement Tests', () => {
    it('blocks advancing a locked application with 423 unless officer provides remarks', async () => {
      // APP-2024-002 is seeded as locked (expired document)
      const app2 = await store.getApplication('APP-2024-002');
      expect(app2?.locked).toBe(true);

      // Attempt advancing without override remarks
      const resBlocked = await app.request('/applications/APP-2024-002/advance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-role': 'officer',
        },
        body: JSON.stringify({ to: 'SCRUTINY' }),
      });

      expect(resBlocked.status).toBe(423);
      const errJson = (await resBlocked.json()) as { error: string };
      expect(errJson.error).toContain('locked due to expired compliance document');

      // Attempt advancing with overrideRemarks
      const resOverride = await app.request('/applications/APP-2024-002/advance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-role': 'officer',
        },
        body: JSON.stringify({
          to: 'SCRUTINY',
          overrideRemarks: 'Special dispensation granted under AICTE Emergency Clause 12.4',
        }),
      });

      expect(resOverride.status).toBe(200);
      const updated = (await resOverride.json()) as { status: string };
      expect(updated.status).toBe('SCRUTINY');

      // Check ledger recorded OVERRIDE event
      const ledger = await store.getLedger('APP-2024-002');
      const overrideEntry = ledger.find((e) => e.eventType === 'OVERRIDE');
      expect(overrideEntry).toBeDefined();
      expect(overrideEntry?.payload.remarks).toContain('Special dispensation granted');
    });
  });

  describe('4. Human Sign-Off Enforcement Tests', () => {
    it('blocks advancing to REJECTED with 409 without officer CONFIRM sign-off', async () => {
      // Set APP-2024-001 to DECISION state
      await store.updateApplication('APP-2024-001', { status: 'DECISION', signoff: undefined });

      // Attempt advance to REJECTED without signoff
      const res = await app.request('/applications/APP-2024-001/advance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-role': 'officer',
        },
        body: JSON.stringify({ to: 'REJECTED' }),
      });

      expect(res.status).toBe(409);
      const err = (await res.json()) as { error: string };
      expect(err.error).toBe('Officer sign-off required');
    });

    it('allows advancing to REJECTED after officer records CONFIRM sign-off', async () => {
      await store.updateApplication('APP-2024-001', { status: 'DECISION' });

      // Submit CONFIRM sign-off
      const signoffRes = await app.request('/applications/APP-2024-001/signoff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-role': 'officer',
        },
        body: JSON.stringify({
          decision: 'CONFIRM',
          deficiencyIds: ['DEF-LAND-001'],
          remarks: 'Reviewed deficiencies, confirming non-compliance.',
        }),
      });

      expect(signoffRes.status).toBe(200);

      // Now advance to REJECTED should succeed
      const advanceRes = await app.request('/applications/APP-2024-001/advance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-role': 'officer',
        },
        body: JSON.stringify({ to: 'REJECTED' }),
      });

      expect(advanceRes.status).toBe(200);
      const appUpdated = (await advanceRes.json()) as { status: string };
      expect(appUpdated.status).toBe('REJECTED');
    });
  });

  describe('5. Document Upload Validation & Ledger Security Tests', () => {
    it('rejects unsupported file formats with 400', async () => {
      const formData = new FormData();
      const fakeBlob = new Blob(['malicious executable'], { type: 'application/x-msdownload' });
      formData.append('file', fakeBlob, 'virus.exe');
      formData.append('docType', 'LEASE_DEED');

      const res = await app.request('/applications/APP-2024-001/documents', {
        method: 'POST',
        body: formData,
      });

      expect(res.status).toBe(400);
      const err = (await res.json()) as { error: string };
      expect(err.error).toContain('Invalid file format');
    });

    it('rejects oversized files exceeding 10 MB with 400', async () => {
      const formData = new FormData();
      // Create 11 MB dummy buffer
      const largeContent = new Uint8Array(11 * 1024 * 1024);
      const largeBlob = new Blob([largeContent], { type: 'application/pdf' });
      formData.append('file', largeBlob, 'large_drawing.pdf');
      formData.append('docType', 'LAND_RECORD');

      const res = await app.request('/applications/APP-2024-001/documents', {
        method: 'POST',
        body: formData,
      });

      expect(res.status).toBe(400);
      const err = (await res.json()) as { error: string };
      expect(err.error).toContain('exceeds maximum limit of 10 MB');
    });

    it('records valid upload in ledger with SHA-256 hash but never the file bytes', async () => {
      const fileBytes = Buffer.from('Official AICTE Land Lease Deed verified document');
      const expectedSha256 = createHash('sha256').update(fileBytes).digest('hex');

      const formData = new FormData();
      const blob = new Blob([fileBytes], { type: 'application/pdf' });
      formData.append('file', blob, 'lease_2024.pdf');
      formData.append('docType', 'LEASE_DEED');

      const res = await app.request('/applications/APP-2024-001/documents', {
        method: 'POST',
        body: formData,
      });

      expect(res.status).toBe(201);
      const metadata = (await res.json()) as { sha256: string };
      expect(metadata.sha256).toBe(expectedSha256);

      // Verify ledger entry
      const ledger = await store.getLedger('APP-2024-001');
      const uploadEntry = ledger.find((e) => e.eventType === 'DOCUMENT_UPLOADED');
      expect(uploadEntry).toBeDefined();
      expect(uploadEntry?.payload.sha256).toBe(expectedSha256);
      expect(uploadEntry?.payload.fileName).toBe('lease_2024.pdf');
      // Ensure file content bytes are NOT stored in the payload
      expect((uploadEntry?.payload as Record<string, unknown>).file).toBeUndefined();
      expect((uploadEntry?.payload as Record<string, unknown>).content).toBeUndefined();
    });
  });

  describe('6. AI Extraction Retry & Error Handling Tests', () => {
    it('retries once upon schema validation failure and succeeds if second attempt is valid', async () => {
      let attempts = 0;

      const mockModel: ModelGeneratorFn = async () => {
        attempts++;
        if (attempts === 1) {
          // Attempt 1: Invalid output missing required confidence
          return {
            landAreaSqm: { value: 7500, evidenceText: 'Land is 7500 sqm' },
          };
        }
        // Attempt 2: Valid schema
        return {
          landAreaSqm: { value: 7500, confidence: 0.9, evidenceText: 'Valid land' },
          leaseStartDate: { value: '2020-01-01', confidence: 0.85, evidenceText: 'Valid start' },
          leaseEndDate: { value: '2050-01-01', confidence: 0.88, evidenceText: 'Valid end' },
          fireNocExpiry: { value: '2028-01-01', confidence: 0.92, evidenceText: 'Valid fire' },
        };
      };

      const result = await runWithRetry(mockModel, 'test prompt');
      expect(attempts).toBe(2);
      expect(result.landAreaSqm.value).toBe(7500);
      expect(result.landAreaSqm.confidence).toBe(0.9);
    });

    it('fails with clear error if both attempts fail', async () => {
      let attempts = 0;

      const persistentlyFailingModel: ModelGeneratorFn = async () => {
        attempts++;
        throw new Error('API Gateway connection timed out');
      };

      await expect(runWithRetry(persistentlyFailingModel, 'test prompt')).rejects.toThrow(
        /Extraction failed after retry: API Gateway connection timed out/
      );
      expect(attempts).toBe(2);
    });
  });
});
