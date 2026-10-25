import { describe, it, expect } from 'vitest';
import {
  createLedgerEntry,
  verifyLedgerChain,
  GENESIS_HASH,
  computeEntryHash,
} from '../services/ledger.js';
import { LedgerEntry } from '../types.js';

describe('AICTE Cryptographic Audit Ledger', () => {
  const appId = 'APP-TEST-001';

  function createSampleChain(): LedgerEntry[] {
    const e1 = createLedgerEntry({
      id: 'LEDGER-001',
      applicationId: appId,
      eventType: 'APPLICATION_CREATED',
      actor: 'institution',
      payload: { institutionName: 'Test Tech Institute', status: 'SUBMITTED' },
      timestamp: '2024-01-01T10:00:00.000Z',
      prevHash: GENESIS_HASH,
    });

    const e2 = createLedgerEntry({
      id: 'LEDGER-002',
      applicationId: appId,
      eventType: 'SCRUTINY_PASSED',
      actor: 'officer',
      payload: { status: 'EVC_REQUIRED', score: 98 },
      timestamp: '2024-01-05T12:00:00.000Z',
      prevHash: e1.hash,
    });

    const e3 = createLedgerEntry({
      id: 'LEDGER-003',
      applicationId: appId,
      eventType: 'EXECUTIVE_DECISION',
      actor: 'officer',
      payload: { status: 'APPROVED', resolutionNo: 'RES-441' },
      timestamp: '2024-01-10T15:30:00.000Z',
      prevHash: e2.hash,
    });

    return [e1, e2, e3];
  }

  it('passes verification on an untampered, clean cryptographic chain', () => {
    const chain = createSampleChain();
    const result = verifyLedgerChain(chain);

    expect(result.valid).toBe(true);
    expect(result.brokenAt).toBeNull();
    expect(result.totalEntries).toBe(3);
    expect(result.message).toContain('cryptographically verified');
  });

  it('fails verification and flags the exact entry when payload is tampered', () => {
    const chain = createSampleChain();

    // Maliciously alter payload of entry 2 without updating hash
    chain[1].payload = {
      status: 'APPROVED', // Fake approval injected into history
      fraudulentNote: 'Bypassed scrutiny checks',
    };

    const result = verifyLedgerChain(chain);

    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe('LEDGER-002');
    expect(result.message).toContain('Tampering detected at entry LEDGER-002');
  });

  it('fails verification if previous hash pointer is altered', () => {
    const chain = createSampleChain();

    // Break the link between block 2 and block 3
    chain[2].prevHash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

    const result = verifyLedgerChain(chain);

    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe('LEDGER-003');
    expect(result.message).toContain('Chain link broken');
  });

  it('fails verification if genesis block has invalid prevHash', () => {
    const chain = createSampleChain();
    chain[0].prevHash = '123456';

    const result = verifyLedgerChain(chain);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe('LEDGER-001');
  });

  it('handles empty chain gracefully', () => {
    const result = verifyLedgerChain([]);
    expect(result.valid).toBe(true);
    expect(result.totalEntries).toBe(0);
  });
});
