'use client';

/**
 * FileUploadWidget
 *
 * A reusable, accessible PDF upload + download component that talks to the
 * backend /files endpoint.
 *
 * Features:
 * - Drag-and-drop or click-to-browse
 * - Client-side PDF magic-byte validation (%PDF-)
 * - 10 MB size limit warning
 * - SHA-256 display of the uploaded file
 * - Download button once a fileId is stored
 * - DRAFT-only delete button
 * - Loading states with accessible aria-busy
 * - Error and success messaging
 */

import React, { useRef, useState, useCallback, useId } from 'react';
import { Upload, FileText, X, Download, Loader2, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';
import { uploadFile, downloadFileBlob, deleteStoredFile } from '../lib/api';
import type { UploadedFileResult } from '../lib/types';

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const PDF_MAGIC = '%PDF-';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function hasPdfMagicBytes(file: File): Promise<boolean> {
  const slice = file.slice(0, 5);
  const buffer = await slice.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const magic = Array.from(bytes).map((b) => String.fromCharCode(b)).join('');
  return magic === PDF_MAGIC;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface FileUploadWidgetProps {
  /** Label shown above the upload area */
  label?: string;
  /** Hint text shown inside the dropzone */
  hint?: string;
  /** Logical kind/category for the file (e.g. 'document', 'evidence') */
  kind?: string;
  /** Whether this upload is a draft (can be deleted) */
  isDraft?: boolean;
  /** Pre-existing file ID (to show download button on load) */
  initialFileId?: string;
  /** Pre-existing file name for download */
  initialFileName?: string;
  /** Called after a successful upload with the result */
  onUploaded?: (result: UploadedFileResult) => void;
  /** Called after a successful deletion */
  onDeleted?: () => void;
  /** Whether the widget is in disabled/read-only state */
  disabled?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FileUploadWidget({
  label = 'Upload PDF',
  hint = 'Drag & drop a PDF or click to browse',
  kind = 'document',
  isDraft = true,
  initialFileId,
  initialFileName,
  onUploaded,
  onDeleted,
  disabled = false,
}: FileUploadWidgetProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [fileId, setFileId] = useState<string | undefined>(initialFileId);
  const [fileName, setFileName] = useState<string | undefined>(initialFileName);
  const [fileSize, setFileSize] = useState<number | undefined>();
  const [sha256, setSha256] = useState<string | undefined>();

  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const clearMessages = () => { setError(null); setSuccess(null); };

  const handleFile = useCallback(async (file: File) => {
    clearMessages();

    // Size check
    if (file.size > MAX_BYTES) {
      setError(`File too large. Maximum size is ${formatBytes(MAX_BYTES)}.`);
      return;
    }

    // MIME check
    if (file.type && file.type !== 'application/pdf') {
      setError('Only PDF files are accepted.');
      return;
    }

    // Magic-byte check (first 5 bytes)
    const hasMagic = await hasPdfMagicBytes(file);
    if (!hasMagic) {
      setError('File does not appear to be a valid PDF (missing %PDF- header).');
      return;
    }

    setUploading(true);
    try {
      const { data, error: uploadError } = await uploadFile(file, kind, isDraft);
      if (uploadError || !data) {
        setError(uploadError ?? 'Upload failed. Please try again.');
        return;
      }
      setFileId(data.id);
      setFileName(file.name);
      setFileSize(data.size);
      setSha256(data.sha256);
      setSuccess(`Uploaded successfully (${formatBytes(data.size)})`);
      onUploaded?.(data);
    } finally {
      setUploading(false);
    }
  }, [kind, isDraft, onUploaded]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input value so re-selecting same file works
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDownload = async () => {
    if (!fileId) return;
    clearMessages();
    setDownloading(true);
    try {
      const { error: dlError } = await downloadFileBlob(fileId, fileName ?? 'document.pdf');
      if (dlError) setError(dlError);
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!fileId || !isDraft) return;
    clearMessages();
    setDeleting(true);
    try {
      const { error: delError } = await deleteStoredFile(fileId);
      if (delError) {
        setError(delError);
        return;
      }
      setFileId(undefined);
      setFileName(undefined);
      setFileSize(undefined);
      setSha256(undefined);
      setSuccess('File removed.');
      onDeleted?.();
    } finally {
      setDeleting(false);
    }
  };

  const isWorking = uploading || downloading || deleting;

  return (
    <div className="file-upload-widget" role="group" aria-labelledby={`${id}-label`}>
      <style>{`
        .file-upload-widget {
          display: flex;
          flex-direction: column;
          gap: 10px;
          font-family: inherit;
        }
        .file-upload-widget__label {
          font-size: 0.85rem;
          font-weight: 600;
          color: #c9d1d9;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }
        .file-upload-dropzone {
          position: relative;
          border: 2px dashed rgba(99,102,241,0.4);
          border-radius: 12px;
          padding: 24px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          background: rgba(30,41,59,0.5);
          text-align: center;
        }
        .file-upload-dropzone:hover:not(.file-upload-dropzone--disabled),
        .file-upload-dropzone--dragging {
          border-color: rgba(99,102,241,0.9);
          background: rgba(99,102,241,0.06);
        }
        .file-upload-dropzone--disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .file-upload-dropzone__icon {
          color: rgba(99,102,241,0.7);
        }
        .file-upload-dropzone__hint {
          font-size: 0.82rem;
          color: #6b7280;
        }
        .file-upload-dropzone__cta {
          font-size: 0.82rem;
          color: #818cf8;
          font-weight: 500;
        }
        .file-upload-meta {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          background: rgba(16,24,40,0.6);
          border: 1px solid rgba(99,102,241,0.25);
          border-radius: 10px;
          padding: 12px 14px;
        }
        .file-upload-meta__info {
          flex: 1;
          min-width: 0;
        }
        .file-upload-meta__name {
          font-size: 0.875rem;
          font-weight: 600;
          color: #e2e8f0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .file-upload-meta__size {
          font-size: 0.75rem;
          color: #6b7280;
          margin-top: 2px;
        }
        .file-upload-meta__hash {
          font-size: 0.65rem;
          color: #4b5563;
          font-family: monospace;
          margin-top: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .file-upload-actions {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }
        .file-upload-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 0.78rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
          white-space: nowrap;
        }
        .file-upload-btn:active { transform: scale(0.97); }
        .file-upload-btn--download {
          background: rgba(99,102,241,0.15);
          color: #818cf8;
          border: 1px solid rgba(99,102,241,0.3);
        }
        .file-upload-btn--download:hover { background: rgba(99,102,241,0.3); }
        .file-upload-btn--delete {
          background: rgba(239,68,68,0.1);
          color: #f87171;
          border: 1px solid rgba(239,68,68,0.25);
        }
        .file-upload-btn--delete:hover { background: rgba(239,68,68,0.2); }
        .file-upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .file-upload-msg {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
          border-radius: 8px;
          padding: 7px 12px;
        }
        .file-upload-msg--error {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.2);
          color: #f87171;
        }
        .file-upload-msg--success {
          background: rgba(16,185,129,0.08);
          border: 1px solid rgba(16,185,129,0.2);
          color: #34d399;
        }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Label */}
      <span id={`${id}-label`} className="file-upload-widget__label">{label}</span>

      {/* Error / success banners */}
      {error && (
        <div className="file-upload-msg file-upload-msg--error" role="alert">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}
      {success && !error && (
        <div className="file-upload-msg file-upload-msg--success" role="status">
          <CheckCircle2 size={14} />
          {success}
        </div>
      )}

      {/* If we have a file ID — show metadata + actions */}
      {fileId ? (
        <div className="file-upload-meta">
          <FileText size={20} color="#818cf8" style={{ flexShrink: 0, marginTop: 2 }} />
          <div className="file-upload-meta__info">
            <div className="file-upload-meta__name">{fileName ?? fileId}</div>
            {fileSize != null && (
              <div className="file-upload-meta__size">{formatBytes(fileSize)}</div>
            )}
            {sha256 && (
              <div className="file-upload-meta__hash" title={sha256}>SHA-256: {sha256}</div>
            )}
          </div>
          <div className="file-upload-actions">
            <button
              type="button"
              className="file-upload-btn file-upload-btn--download"
              onClick={handleDownload}
              disabled={isWorking}
              aria-busy={downloading}
              title="Download file"
            >
              {downloading
                ? <Loader2 size={13} className="spin" />
                : <Download size={13} />}
              {downloading ? 'Downloading…' : 'Download'}
            </button>
            {isDraft && (
              <button
                type="button"
                className="file-upload-btn file-upload-btn--delete"
                onClick={handleDelete}
                disabled={isWorking}
                aria-busy={deleting}
                title="Remove draft file"
              >
                {deleting
                  ? <Loader2 size={13} className="spin" />
                  : <Trash2 size={13} />}
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Dropzone */
        <div
          className={[
            'file-upload-dropzone',
            dragging ? 'file-upload-dropzone--dragging' : '',
            disabled || uploading ? 'file-upload-dropzone--disabled' : '',
          ].join(' ')}
          onClick={() => !disabled && !uploading && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          role="button"
          tabIndex={disabled || uploading ? -1 : 0}
          aria-disabled={disabled || uploading}
          aria-busy={uploading}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !disabled && !uploading) {
              inputRef.current?.click();
            }
          }}
        >
          {uploading ? (
            <Loader2 size={32} className="spin file-upload-dropzone__icon" />
          ) : (
            <Upload size={32} className="file-upload-dropzone__icon" />
          )}
          <span className="file-upload-dropzone__hint">
            {uploading ? 'Uploading…' : hint}
          </span>
          {!uploading && (
            <span className="file-upload-dropzone__cta">
              Click to browse · PDF only · Max 10 MB
            </span>
          )}
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept="application/pdf,.pdf"
            style={{ display: 'none' }}
            onChange={handleInputChange}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
      )}
    </div>
  );
}
