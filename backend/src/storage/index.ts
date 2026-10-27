/**
 * Storage module index — selects the correct IFileStorage implementation based
 * on the STORAGE_MODE environment variable.
 *
 *  STORAGE_MODE=local   → LocalFileStorage  (default, no external deps)
 *  STORAGE_MODE=postgres → PostgresFileStorage (bytes in JSONB)
 *  STORAGE_MODE=blob    → BlobFileStorage    (Vercel Blob private access)
 *
 * The BLOB_READ_WRITE_TOKEN env var is **never** committed to source control.
 */

import type { IFileStorage } from './fileStorage.js';
import { LocalFileStorage } from './localFileStorage.js';
import { PostgresFileStorage } from './postgresFileStorage.js';
import { BlobFileStorage } from './blobStorage.js';

export type { IFileStorage };
export { LocalFileStorage, PostgresFileStorage, BlobFileStorage };
export * from './fileStorage.js';

let _fileStorage: IFileStorage | null = null;

export function getFileStorage(): IFileStorage {
  if (_fileStorage) return _fileStorage;

  const mode = (process.env.STORAGE_MODE ?? 'local').toLowerCase();

  if (mode === 'blob') {
    const token = process.env.BLOB_READ_WRITE_TOKEN ?? '';
    _fileStorage = new BlobFileStorage(token);
    console.log('[storage] Mode: Vercel Blob (private)');
  } else if (mode === 'postgres') {
    _fileStorage = new PostgresFileStorage();
    console.log('[storage] Mode: Postgres JSONB bytes');
  } else {
    _fileStorage = new LocalFileStorage(process.env.UPLOAD_DIR ?? './uploads');
    console.log('[storage] Mode: local filesystem');
  }

  return _fileStorage;
}

/** For testing — reset the singleton so each test can inject a fresh instance */
export function resetFileStorage(instance?: IFileStorage): void {
  _fileStorage = instance ?? null;
}
