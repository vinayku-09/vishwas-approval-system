/**
 * Postgres (in-process) file storage backend.
 *
 * Files are stored as base64 inside the StoredFileRecord JSONB.
 * Suitable for small proof-of-concept use; for large files prefer the blob
 * or local mode.
 */

import type { IFileStorage, FileUploadParams, FileReadResult } from './fileStorage.js';
import { buildPathname, randomUUID, sha256hex } from './fileStorage.js';
import type { StoredFileRecord } from '../types.js';

export class PostgresFileStorage implements IFileStorage {
  readonly mode = 'postgres' as const;
  private _records: Map<string, StoredFileRecord> = new Map();

  async save(params: FileUploadParams): Promise<StoredFileRecord> {
    const { buffer, institutionId, kind, contentType, isDraft, region, metadata } = params;
    const uuid = randomUUID();
    const pathname = buildPathname(institutionId, kind, uuid);
    const digest = sha256hex(buffer);

    const record: StoredFileRecord = {
      id: uuid,
      pathname,
      sha256: digest,
      size: buffer.length,
      contentType,
      institutionId,
      region,
      isDraft,
      uploadedAt: new Date().toISOString(),
      storageMode: 'postgres',
      bytesBase64: buffer.toString('base64'),
      metadata,
    };

    this._records.set(uuid, record);
    return record;
  }

  async read(id: string): Promise<FileReadResult | null> {
    const record = this._records.get(id);
    if (!record || !record.bytesBase64) return null;

    const bytes = Buffer.from(record.bytesBase64, 'base64');

    return {
      stream: null,
      bytes,
      contentType: record.contentType,
      size: bytes.length,
      sha256: record.sha256,
      record,
    };
  }

  async remove(id: string): Promise<boolean> {
    const record = this._records.get(id);
    if (!record) return false;
    if (!record.isDraft) return false; // never delete submitted evidence
    this._records.delete(id);
    return true;
  }

  async getRecord(id: string): Promise<StoredFileRecord | null> {
    const r = this._records.get(id);
    if (!r) return null;
    // Don't expose bytes in record metadata queries
    const { bytesBase64: _, ...safe } = r;
    return safe as StoredFileRecord;
  }

  hydrateRecord(record: StoredFileRecord): void {
    this._records.set(record.id, record);
  }
}
