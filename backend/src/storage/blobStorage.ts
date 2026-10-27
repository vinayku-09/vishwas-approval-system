/**
 * Vercel Blob storage backend.
 *
 * All files are stored with access:'private' so the CDN URL is never publicly
 * guessable.  The pathname follows the pattern:
 *   institutions/{institutionId}/{kind}/{uuid}.pdf
 *
 * Stored metadata: pathname, sha256, size, contentType, institutionId, region.
 * No public URLs are ever returned to clients.  The GET /files/:id route
 * authenticates, checks region/role scope, re-verifies the SHA-256, then
 * streams the bytes back to the caller using the @vercel/blob get() API.
 */

import { put, del, get as blobGet } from '@vercel/blob';
import type { IFileStorage, FileUploadParams, FileReadResult } from './fileStorage.js';
import {
  buildPathname,
  randomUUID,
  sha256hex,
} from './fileStorage.js';
import type { StoredFileRecord } from '../types.js';

export class BlobFileStorage implements IFileStorage {
  readonly mode = 'blob' as const;
  private readonly token: string;

  constructor(token: string) {
    if (!token || token.trim().length === 0) {
      throw new Error('BlobFileStorage: BLOB_READ_WRITE_TOKEN is required');
    }
    this.token = token;
  }

  // In-memory fallback map — in Blob mode the record is re-fetched via the
  // stored pathname, but we also keep it in store-layer so /files/:id queries
  // work without an extra Vercel round-trip in tests.
  // The actual authoritative metadata is the StoredFileRecord in the DB/store.
  private _records: Map<string, StoredFileRecord> = new Map();

  async save(params: FileUploadParams): Promise<StoredFileRecord> {
    const { buffer, institutionId, kind, contentType, isDraft, region, metadata } = params;
    const uuid = randomUUID();
    const pathname = buildPathname(institutionId, kind, uuid);
    const digest = sha256hex(buffer);

    // Upload to Vercel Blob with private access + random suffix
    const result = await put(pathname, buffer, {
      access: 'private',
      contentType,
      addRandomSuffix: true,
      token: this.token,
    });

    const record: StoredFileRecord = {
      id: uuid,
      pathname: result.pathname,
      sha256: digest,
      size: buffer.length,
      contentType,
      institutionId,
      region,
      isDraft,
      uploadedAt: new Date().toISOString(),
      storageMode: 'blob',
      metadata,
    };

    this._records.set(uuid, record);
    return record;
  }

  async read(id: string): Promise<FileReadResult | null> {
    const record = this._records.get(id);
    if (!record) return null;

    const response = await blobGet(record.pathname, {
      access: 'private',
      token: this.token,
    });

    if (!response || !response.stream) return null;

    return {
      stream: response.stream,
      bytes: null,
      contentType: record.contentType,
      size: record.size,
      sha256: record.sha256,
      record,
    };
  }

  async remove(id: string): Promise<boolean> {
    const record = this._records.get(id);
    if (!record) return false;
    if (!record.isDraft) return false; // never delete submitted evidence

    try {
      await del(record.pathname, { token: this.token });
      this._records.delete(id);
      return true;
    } catch {
      return false;
    }
  }

  async getRecord(id: string): Promise<StoredFileRecord | null> {
    return this._records.get(id) ?? null;
  }

  /** Called by the store layer to hydrate the in-memory map after a save */
  hydrateRecord(record: StoredFileRecord): void {
    this._records.set(record.id, record);
  }
}
