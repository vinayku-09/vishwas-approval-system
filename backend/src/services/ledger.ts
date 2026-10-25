import { createHash } from 'node:crypto';
import { LedgerEntry } from '../types.js';

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Deterministic JSON stringifier to guarantee identical hash calculation
 * across different runtime environments regardless of object key order.
 */
export function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalJson((obj as Record<string, unknown>)[k])}`
  );
  return '{' + pairs.join(',') + '}';
}

/**
 * Computes SHA-256(prevHash + canonicalJSON(entryFields))
 */
export function computeEntryHash(
  prevHash: string,
  entryFields: {
    id: string;
    applicationId: string;
    eventType: string;
    actor: string;
    payload: Record<string, unknown>;
    timestamp: string;
  }
): string {
  const content = prevHash + canonicalJson(entryFields);
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Factory to create a new cryptographically chained LedgerEntry.
 */
export function createLedgerEntry(params: {
  id: string;
  applicationId: string;
  eventType: string;
  actor: string;
  payload: Record<string, unknown>;
  timestamp?: string;
  prevHash?: string;
}): LedgerEntry {
  const timestamp = params.timestamp || new Date().toISOString();
  const prevHash = params.prevHash || GENESIS_HASH;

  const coreFields = {
    id: params.id,
    applicationId: params.applicationId,
    eventType: params.eventType,
    actor: params.actor,
    payload: params.payload,
    timestamp,
  };

  const hash = computeEntryHash(prevHash, coreFields);

  return {
    ...coreFields,
    prevHash,
    hash,
  };
}

export interface VerificationResult {
  valid: boolean;
  brokenAt?: string | null;
  totalEntries: number;
  message: string;
}

/**
 * Verifies the integrity of an application's hash chain from genesis to tip.
 * Detects both payload tampering and chain link disruption.
 */
export function verifyLedgerChain(entries: LedgerEntry[]): VerificationResult {
  if (!entries || entries.length === 0) {
    return {
      valid: true,
      brokenAt: null,
      totalEntries: 0,
      message: 'Empty chain is trivially valid.',
    };
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Check genesis or previous link pointer
    if (i === 0) {
      if (entry.prevHash !== GENESIS_HASH) {
        return {
          valid: false,
          brokenAt: entry.id,
          totalEntries: entries.length,
          message: `Genesis entry ${entry.id} has invalid prevHash: expected ${GENESIS_HASH}, got ${entry.prevHash}`,
        };
      }
    } else {
      const prevEntry = entries[i - 1];
      if (entry.prevHash !== prevEntry.hash) {
        return {
          valid: false,
          brokenAt: entry.id,
          totalEntries: entries.length,
          message: `Chain link broken at entry ${entry.id}: prevHash ${entry.prevHash} does not match predecessor hash ${prevEntry.hash}`,
        };
      }
    }

    // Recompute self hash and compare with stored hash
    const expectedHash = computeEntryHash(entry.prevHash, {
      id: entry.id,
      applicationId: entry.applicationId,
      eventType: entry.eventType,
      actor: entry.actor,
      payload: entry.payload,
      timestamp: entry.timestamp,
    });

    if (entry.hash !== expectedHash) {
      return {
        valid: false,
        brokenAt: entry.id,
        totalEntries: entries.length,
        message: `Tampering detected at entry ${entry.id}: Stored hash (${entry.hash}) does not match recomputed hash (${expectedHash})`,
      };
    }
  }

  return {
    valid: true,
    brokenAt: null,
    totalEntries: entries.length,
    message: `All ${entries.length} ledger block(s) cryptographically verified. Hash chain integrity intact.`,
  };
}
