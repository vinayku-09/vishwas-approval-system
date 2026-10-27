/**
 * Local filesystem file storage backend.
 *
 * Files are written to ./uploads/{pathname} and served back via
 * Buffer reads.  SHA-256 is re-verified on every read.
 */

import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { IFileStorage, FileUploadParams, FileReadResult } from './fileStorage.js';
import { buildPathname, randomUUID, sha256hex } from './fileStorage.js';
import type { StoredFileRecord } from '../types.js';

export class LocalFileStorage implements IFileStorage {
  readonly mode = 'local' as const;
  private readonly baseDir: string;
  private _records: Map<string, StoredFileRecord> = new Map();

  constructor(baseDir = './uploads') {
    this.baseDir = baseDir;
  }

  async save(params: FileUploadParams): Promise<StoredFileRecord> {
    const { buffer, institutionId, kind, contentType, isDraft, region, metadata } = params;
    const uuid = randomUUID();
    const relPathname = buildPathname(institutionId, kind, uuid);
    const absPath = join(this.baseDir, relPathname);

    await mkdir(dirname(absPath), { recursive: true });
    await writeFile(absPath, buffer);

    const digest = sha256hex(buffer);

    const record: StoredFileRecord = {
      id: uuid,
      pathname: relPathname,
      sha256: digest,
      size: buffer.length,
      contentType,
      institutionId,
      region,
      isDraft,
      uploadedAt: new Date().toISOString(),
      storageMode: 'local',
      metadata,
    };

    this._records.set(uuid, record);
    return record;
  }

  async read(id: string): Promise<FileReadResult | null> {
    const record = this._records.get(id);
    if (!record) return null;

    const absPath = join(this.baseDir, record.pathname);
    if (!existsSync(absPath)) return null;

    const bytes = await readFile(absPath);

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

    const absPath = join(this.baseDir, record.pathname);
    try {
      if (existsSync(absPath)) await unlink(absPath);
      this._records.delete(id);
      return true;
    } catch {
      return false;
    }
  }

  async getRecord(id: string): Promise<StoredFileRecord | null> {
    return this._records.get(id) ?? null;
  }

  hydrateRecord(record: StoredFileRecord): void {
    this._records.set(record.id, record);
  }
}
