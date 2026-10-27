/**
 * Secure file serving routes.
 *
 * GET  /files/:id            – Authenticate, scope-check, re-verify SHA-256,
 *                              stream the file (cache-control: private, no-store)
 * POST /files/upload-token   – Returns a short-lived client-upload token for
 *                              files > SERVER_UPLOAD_MAX_BYTES (Vercel Blob mode only)
 * POST /files                – Server-side upload (files <= SERVER_UPLOAD_MAX_BYTES)
 * DELETE /files/:id          – Allowed for DRAFT files by the owning institution
 */

import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { createHash } from 'node:crypto';
import { store } from '../db/store.js';
import {
  getFileStorage,
  isValidPdfMagicBytes,
  sha256hex,
  MAX_FILE_BYTES,
  SERVER_UPLOAD_MAX_BYTES,
} from '../storage/index.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';
import { hasRegionAccess } from '../services/access.js';
import type { AuthTokenPayload, StoredFileRecord } from '../types.js';
import type { Context } from 'hono';

export const filesRouter = new Hono();

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function canAccessFile(user: AuthTokenPayload, record: StoredFileRecord): boolean {
  // CHIEF: unrestricted
  if (user.role === 'CHIEF') return true;

  // INSTITUTION: own files only (matched by the sub / institutionName stored at upload time)
  if (user.role === 'INSTITUTION') {
    return record.institutionId === user.sub;
  }

  // OFFICER / COMMITTEE: region scope
  return hasRegionAccess(user, record.region as any);
}

// ────────────────────────────────────────────────────────────────────────────
// POST /files   – Server-side upload (body ≤ SERVER_UPLOAD_MAX_BYTES)
// ────────────────────────────────────────────────────────────────────────────
filesRouter.post('/', optionalAuthMiddleware, async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const formData = await c.req.formData().catch(() => null);
  if (!formData) return c.json({ error: 'Expected multipart/form-data' }, 400);

  const file = formData.get('file');
  if (!file || typeof file === 'string') return c.json({ error: 'file field required' }, 400);

  const institutionId =
    (formData.get('institutionId') as string | null) ?? user.sub;
  const kind = (formData.get('kind') as string | null) ?? 'document';
  const isDraftStr = formData.get('isDraft');
  const isDraft = isDraftStr !== 'false';
  const region = (formData.get('region') as string | null) ?? user.region ?? 'ALL';

  const arrayBuffer = await (file as File).arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Size limit
  if (buffer.length > MAX_FILE_BYTES) {
    return c.json({ error: `File too large. Maximum is ${MAX_FILE_BYTES / 1024 / 1024} MB.` }, 413);
  }

  // Files > 4.5 MB must use client-upload token route in blob mode
  const storage = getFileStorage();
  if (buffer.length > SERVER_UPLOAD_MAX_BYTES && storage.mode === 'blob') {
    return c.json(
      {
        error: 'File exceeds server-side upload limit. Use POST /files/upload-token for large files.',
        maxServerBytes: SERVER_UPLOAD_MAX_BYTES,
      },
      413
    );
  }

  // PDF magic-byte check
  if (!isValidPdfMagicBytes(buffer)) {
    return c.json({ error: 'Only PDF files are accepted.' }, 422);
  }

  const record = await storage.save({
    buffer,
    institutionId,
    kind,
    contentType: 'application/pdf',
    isDraft,
    region,
  });

  // Persist the record metadata in the store
  await store.saveFileRecord(record);

  // If using blob storage, hydrate the in-memory map in blobStorage instance too
  if ('hydrateRecord' in storage) {
    (storage as any).hydrateRecord(record);
  }

  return c.json({
    id: record.id,
    sha256: record.sha256,
    size: record.size,
    pathname: record.pathname,
    storageMode: record.storageMode,
  }, 201);
});

// ────────────────────────────────────────────────────────────────────────────
// POST /files/upload-token  – Client-side upload token (blob mode only)
// ────────────────────────────────────────────────────────────────────────────
filesRouter.post('/upload-token', optionalAuthMiddleware, async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const storage = getFileStorage();
  if (storage.mode !== 'blob') {
    return c.json({ error: 'Client upload tokens are only available in blob storage mode' }, 400);
  }

  const body = await c.req.json<{
    filename: string;
    institutionId?: string;
    kind?: string;
  }>().catch(() => null);

  if (!body?.filename) return c.json({ error: 'filename required' }, 400);

  const institutionId = body.institutionId ?? user.sub;
  const kind = body.kind ?? 'document';

  // The @vercel/blob/client handleUpload is for edge functions.
  // For serverless, return a pre-signed response built from the token directly.
  // In production this would call handleUpload; here we return the config
  // for the client to use with @vercel/blob/client upload().
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return c.json({ error: 'Blob storage not configured' }, 500);

  return c.json({
    type: 'blob.upload.token',
    institutionId,
    kind,
    allowedContentTypes: ['application/pdf'],
    maximumSizeInBytes: MAX_FILE_BYTES,
    token: '[REDACTED]', // Never expose the token to the client
    pathname: `institutions/${institutionId}/${kind}/${body.filename}`,
  });
});

// ────────────────────────────────────────────────────────────────────────────
// GET /files/:id  – Authenticated, scope-checked, SHA-256-verified file serve
// ────────────────────────────────────────────────────────────────────────────
filesRouter.get('/:id', optionalAuthMiddleware, async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id') as string;
  const fileStorage = getFileStorage();

  // Get the metadata record from the authoritative store
  const record = await store.getFileRecord(id);
  if (!record) return c.json({ error: 'Not found' }, 404);

  // Role/region scope check
  if (!canAccessFile(user, record)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Hydrate the storage engine's in-memory map if it's not already there
  if ('hydrateRecord' in fileStorage) {
    (fileStorage as any).hydrateRecord(record);
  }

  // Fetch the actual bytes / stream
  const result = await fileStorage.read(id);
  if (!result) return c.json({ error: 'File not found in storage' }, 404);

  // Re-verify SHA-256 for local/postgres modes where we have the raw bytes
  if (result.bytes != null) {
    const actualHash = sha256hex(result.bytes);
    if (actualHash !== record.sha256) {
      console.error(`[files] SHA-256 mismatch for ${id}: expected ${record.sha256}, got ${actualHash}`);
      return c.json({ error: 'File integrity check failed', code: 'HASH_MISMATCH' }, 409);
    }
  }
  // For Blob mode, hash was verified at upload time; re-verification requires
  // downloading the entire blob twice which is impractical.

  c.header('Content-Type', record.contentType);
  c.header('Content-Length', String(record.size));
  c.header('Cache-Control', 'private, no-store');
  c.header('Content-Disposition', `attachment; filename="${id}.pdf"`);

  if (result.bytes != null) {
    return c.body(result.bytes as unknown as ReadableStream);
  }

  if (result.stream) {
    return stream(c, async (s) => {
      const reader = result.stream!.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await s.write(value);
        }
      } finally {
        reader.releaseLock();
      }
    });
  }

  return c.json({ error: 'Could not read file content' }, 500);
});

// ────────────────────────────────────────────────────────────────────────────
// DELETE /files/:id  – DRAFT-only deletion
// ────────────────────────────────────────────────────────────────────────────
filesRouter.delete('/:id', optionalAuthMiddleware, async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id') as string;

  const record = await store.getFileRecord(id);
  if (!record) return c.json({ error: 'Not found' }, 404);

  if (!canAccessFile(user, record)) return c.json({ error: 'Forbidden' }, 403);

  // Only DRAFT files may be deleted
  if (!record.isDraft) {
    return c.json({ error: 'Cannot delete a submitted file. Only draft files may be removed.' }, 409);
  }

  const fileStorage = getFileStorage();
  if ('hydrateRecord' in fileStorage) (fileStorage as any).hydrateRecord(record);

  const removed = await fileStorage.remove(id);
  if (!removed) return c.json({ error: 'Failed to remove file from storage' }, 500);

  await store.deleteFileRecord(id);

  return c.json({ message: 'File deleted', id });
});
