import { createHash, randomUUID } from 'node:crypto';
import type { StoredFileRecord, StorageMode } from '../types.js';

// ────────────────────────────────────────────────────────────────────────────
// Shared utilities
// ────────────────────────────────────────────────────────────────────────────

/** Verify the first 5 bytes equal the PDF magic bytes %PDF- */
export function isValidPdfMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 5) return false;
  return (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  );
}

/** Compute SHA-256 hex digest of a buffer */
export function sha256hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/** Maximum bytes for server-side upload (10 MB). */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/**
 * Threshold below which we handle the upload entirely server-side.
 * Files at or below 4.5 MB fit within Vercel's 4.5 MB serverless payload
 * limit even after base-64 encoding overhead.
 *
 * Files above 4.5 MB must be handled via the client-upload token route
 * (/files/upload-token) so they bypass the serverless function body limit.
 */
export const SERVER_UPLOAD_MAX_BYTES = 4.5 * 1024 * 1024;

// ────────────────────────────────────────────────────────────────────────────
// Core interface — every storage backend implements this
// ────────────────────────────────────────────────────────────────────────────

export interface FileUploadParams {
  buffer: Buffer;
  institutionId: string;
  kind: string; // e.g. 'document', 'profile', 'evidence'
  contentType: string;
  isDraft: boolean;
  region: string;
  /** Optional extra metadata to store alongside the record */
  metadata?: Record<string, unknown>;
}

export interface FileReadResult {
  stream: ReadableStream | null;
  /** null means the bytes are returned in-process (local / Postgres modes) */
  bytes?: Buffer | null;
  contentType: string;
  size: number;
  sha256: string;
  record: StoredFileRecord;
}

export interface IFileStorage {
  /** Upload a file and persist a StoredFileRecord. Returns the record. */
  save(params: FileUploadParams): Promise<StoredFileRecord>;

  /**
   * Read a file by its StoredFileRecord ID.
   * Returns null when the ID is not found or access is denied.
   */
  read(id: string): Promise<FileReadResult | null>;

  /**
   * Delete a file. Only allowed for DRAFT records.
   * Returns false when the record is not found, not DRAFT, or deletion fails.
   */
  remove(id: string): Promise<boolean>;

  /** Retrieve a stored file record by ID without fetching bytes. */
  getRecord(id: string): Promise<StoredFileRecord | null>;

  /** Current storage mode reported by this instance */
  readonly mode: StorageMode;
}

// ────────────────────────────────────────────────────────────────────────────
// Factory helper
// ────────────────────────────────────────────────────────────────────────────

export function buildPathname(
  institutionId: string,
  kind: string,
  uuid: string
): string {
  // Sanitise – no path traversal
  const safeId = institutionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeKind = kind.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `institutions/${safeId}/${safeKind}/${uuid}.pdf`;
}

export { randomUUID };
