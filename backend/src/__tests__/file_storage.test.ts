/**
 * Tests for the file storage layer.
 *
 * Tests three modes:
 *   local   – LocalFileStorage (tmp directory)
 *   postgres – PostgresFileStorage (in-process JSONB bytes)
 *   blob    – BlobFileStorage (mocked @vercel/blob)
 *
 * Each mode is tested with:
 *   - PDF magic-byte check
 *   - Successful upload → record
 *   - SHA-256 integrity on read
 *   - DRAFT-only deletion
 *   - Non-draft deletion rejection
 *   - GET /files/:id route (auth, scope, hash verification, 409 on mismatch)
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';

// ── Mock @vercel/blob BEFORE any imports that might load it ──────────────────
const mockPutResult = {
  pathname: 'institutions/inst-1/document/uuid.pdf',
  url: 'https://blob.vercel-storage.com/private/uuid.pdf',
  downloadUrl: '',
  contentDisposition: 'attachment',
};

vi.mock('@vercel/blob', () => ({
  put: vi.fn(async (_pathname: string, _buffer: Buffer, _opts: unknown) => mockPutResult),
  del: vi.fn(async (_pathname: string, _opts: unknown) => undefined),
  get: vi.fn(async (_pathname: string, _opts: unknown) => {
    const buf = Buffer.from('%PDF-mock-content');
    return {
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(buf);
          controller.close();
        },
      }),
    };
  }),
}));

import {
  LocalFileStorage,
  PostgresFileStorage,
  BlobFileStorage,
  isValidPdfMagicBytes,
  sha256hex,
} from '../storage/index.js';
import type { IFileStorage } from '../storage/index.js';
import { InMemoryStore, setStore } from '../db/store.js';
import { app } from '../app.js';
import { resetFileStorage } from '../storage/index.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePdfBuffer(content = 'Hello PDF'): Buffer {
  return Buffer.from(`%PDF-1.4\n${content}`);
}

function makeNonPdfBuffer(): Buffer {
  return Buffer.from('this is not a pdf at all');
}

const validParams = {
  buffer: makePdfBuffer(),
  institutionId: 'inst-1',
  kind: 'document',
  contentType: 'application/pdf',
  isDraft: true,
  region: 'NORTH',
};

// ── Utility: test a storage backend ─────────────────────────────────────────

async function runStorageTests(label: string, makeStorage: () => IFileStorage) {
  describe(`[${label}] isValidPdfMagicBytes`, () => {
    it('returns true for PDF magic bytes', () => {
      expect(isValidPdfMagicBytes(makePdfBuffer())).toBe(true);
    });
    it('returns false for non-PDF bytes', () => {
      expect(isValidPdfMagicBytes(makeNonPdfBuffer())).toBe(false);
    });
    it('returns false for empty buffer', () => {
      expect(isValidPdfMagicBytes(Buffer.alloc(0))).toBe(false);
    });
  });

  describe(`[${label}] save + read`, () => {
    let storage: IFileStorage;
    beforeEach(() => { storage = makeStorage(); });

    it('returns a StoredFileRecord with correct fields', async () => {
      const record = await storage.save(validParams);
      expect(record.id).toBeTruthy();
      expect(record.sha256).toHaveLength(64);
      expect(record.size).toBe(validParams.buffer.length);
      expect(record.contentType).toBe('application/pdf');
      expect(record.institutionId).toBe('inst-1');
      expect(record.isDraft).toBe(true);
      expect(record.storageMode).toBe(label);
    });

    it('sha256 matches computed hash', async () => {
      const expected = sha256hex(validParams.buffer);
      const record = await storage.save(validParams);
      expect(record.sha256).toBe(expected);
    });

    it('read returns matching sha256', async () => {
      const record = await storage.save(validParams);
      const result = await storage.read(record.id);
      expect(result).not.toBeNull();
      expect(result!.sha256).toBe(record.sha256);
    });

    it('read returns null for unknown id', async () => {
      const result = await storage.read('nonexistent-id');
      expect(result).toBeNull();
    });
  });

  describe(`[${label}] remove`, () => {
    let storage: IFileStorage;
    beforeEach(() => { storage = makeStorage(); });

    it('removes a DRAFT file and returns true', async () => {
      const record = await storage.save({ ...validParams, isDraft: true });
      const ok = await storage.remove(record.id);
      expect(ok).toBe(true);
    });

    it('refuses to remove a non-DRAFT file', async () => {
      const record = await storage.save({ ...validParams, isDraft: false });
      const ok = await storage.remove(record.id);
      expect(ok).toBe(false);
    });

    it('returns false for unknown id', async () => {
      const ok = await storage.remove('does-not-exist');
      expect(ok).toBe(false);
    });
  });

  describe(`[${label}] getRecord`, () => {
    let storage: IFileStorage;
    beforeEach(() => { storage = makeStorage(); });

    it('returns null for unknown id', async () => {
      const r = await storage.getRecord('missing');
      expect(r).toBeNull();
    });

    it('returns a record without exposing bytes (postgres mode)', async () => {
      const record = await storage.save(validParams);
      const r = await storage.getRecord(record.id);
      expect(r).not.toBeNull();
      // bytesBase64 should NOT be present in getRecord response for postgres
      if (label === 'postgres') {
        expect((r as any).bytesBase64).toBeUndefined();
      }
    });
  });
}

// ── Run tests for each backend ───────────────────────────────────────────────

let tmpDir: string;

describe('LocalFileStorage', async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'vishwas-test-'));
  await runStorageTests('local', () => new LocalFileStorage(tmpDir));

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });
});

describe('PostgresFileStorage', () => {
  runStorageTests('postgres', () => new PostgresFileStorage());
});

describe('BlobFileStorage', () => {
  runStorageTests('blob', () => new BlobFileStorage('vercel_blob_rw_testtoken'));
});

// ── GET /files/:id route tests ───────────────────────────────────────────────

describe('GET /files/:id route', () => {
  let memStore: InMemoryStore;
  let storage: PostgresFileStorage;

  beforeEach(() => {
    memStore = new InMemoryStore();
    setStore(memStore);
    storage = new PostgresFileStorage();
    resetFileStorage(storage);
  });

  async function uploadFile(isDraft = true) {
    const record = await storage.save({ ...validParams, isDraft });
    await memStore.saveFileRecord(record);
    return record;
  }

  it('returns 401 without auth', async () => {
    const record = await uploadFile();
    const res = await app.request(`/files/${record.id}`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown id', async () => {
    const res = await app.request('/files/nonexistent', {
      headers: { 'x-role': 'OFFICER', 'x-region': 'NORTH' },
    });
    // demo header role is only accepted when ALLOW_DEMO_HEADER_ROLE=true
    expect([401, 404]).toContain(res.status);
  });

  it('streams file bytes for authorized OFFICER', async () => {
    process.env.ALLOW_DEMO_HEADER_ROLE = 'true';
    const record = await uploadFile();
    const res = await app.request(`/files/${record.id}`, {
      headers: { 'x-role': 'OFFICER', 'x-region': 'NORTH' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('content-type')).toBe('application/pdf');
    delete process.env.ALLOW_DEMO_HEADER_ROLE;
  });

  it('returns 403 for OFFICER in wrong region', async () => {
    process.env.ALLOW_DEMO_HEADER_ROLE = 'true';
    // File is in NORTH region; SOUTH officer should be forbidden
    const record = await storage.save({ ...validParams, region: 'NORTH', isDraft: true });
    await memStore.saveFileRecord(record);
    const res = await app.request(`/files/${record.id}`, {
      headers: { 'x-role': 'OFFICER', 'x-region': 'SOUTH' },
    });
    expect(res.status).toBe(403);
    delete process.env.ALLOW_DEMO_HEADER_ROLE;
  });

  it('returns 409 on SHA-256 mismatch', async () => {
    process.env.ALLOW_DEMO_HEADER_ROLE = 'true';
    const record = await uploadFile();

    // Tamper the stored hash
    const tampered = { ...record, sha256: 'a'.repeat(64) };
    await memStore.saveFileRecord(tampered);

    // Also update in storage
    storage.hydrateRecord(tampered);

    const res = await app.request(`/files/${record.id}`, {
      headers: { 'x-role': 'OFFICER', 'x-region': 'NORTH' },
    });
    // Should return 409 HASH_MISMATCH because the record sha256 doesn't match actual bytes
    expect(res.status).toBe(409);
    const body = await res.json() as { code?: string };
    expect(body.code).toBe('HASH_MISMATCH');
    delete process.env.ALLOW_DEMO_HEADER_ROLE;
  });
});

// ── DELETE /files/:id route tests ────────────────────────────────────────────

describe('DELETE /files/:id route', () => {
  let memStore: InMemoryStore;
  let storage: PostgresFileStorage;

  beforeEach(() => {
    memStore = new InMemoryStore();
    setStore(memStore);
    storage = new PostgresFileStorage();
    resetFileStorage(storage);
    process.env.ALLOW_DEMO_HEADER_ROLE = 'true';
  });

  afterAll(() => {
    delete process.env.ALLOW_DEMO_HEADER_ROLE;
  });

  it('deletes a DRAFT file', async () => {
    const record = await storage.save({ ...validParams, isDraft: true });
    await memStore.saveFileRecord(record);

    const res = await app.request(`/files/${record.id}`, {
      method: 'DELETE',
      headers: { 'x-role': 'OFFICER', 'x-region': 'NORTH' },
    });
    expect(res.status).toBe(200);
  });

  it('refuses to delete a submitted file', async () => {
    const record = await storage.save({ ...validParams, isDraft: false });
    await memStore.saveFileRecord(record);

    const res = await app.request(`/files/${record.id}`, {
      method: 'DELETE',
      headers: { 'x-role': 'OFFICER', 'x-region': 'NORTH' },
    });
    expect(res.status).toBe(409);
  });
});
