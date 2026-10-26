import { Hono } from 'hono';
import { createHash } from 'node:crypto';
import { store } from '../db/store.js';
import { DocumentMetadata, DocumentType } from '../types.js';
import { getStorageService } from '../services/storage.js';
import { authMiddleware } from '../middleware/auth.js';
import { canReadApplication } from '../services/access.js';

export const documentsRouter = new Hono();

documentsRouter.use('*', authMiddleware);

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// POST /applications/:id/documents - multipart file upload
documentsRouter.post('/:id/documents', async (c) => {
  const applicationId = c.req.param('id');
  const user = c.get('user');

  const app = await store.getApplication(applicationId);
  if (!app) {
    return c.json({ error: `Application '${applicationId}' not found` }, 404);
  }

  if (!canReadApplication(user, app)) {
    return c.json({ error: 'Forbidden: Application is outside your scope' }, 403);
  }

  const body = await c.req.parseBody().catch(() => null);
  if (!body) {
    return c.json({ error: 'Invalid multipart body' }, 400);
  }

  const docType = body['docType'] as DocumentType;
  if (!docType || !['LEASE_DEED', 'FIRE_NOC', 'LAND_RECORD'].includes(docType)) {
    return c.json(
      { error: "Invalid docType. Must be 'LEASE_DEED', 'FIRE_NOC', or 'LAND_RECORD'" },
      400
    );
  }

  const fileItem = body['file'];
  if (!fileItem || !(fileItem instanceof File)) {
    return c.json({ error: 'Missing file in request body (field name must be "file")' }, 400);
  }

  const mimeType = fileItem.type || 'application/octet-stream';
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return c.json(
      {
        error: `Invalid file format (${mimeType}). Only PDF, PNG, and JPG documents are accepted.`,
      },
      400
    );
  }

  const arrayBuffer = await fileItem.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length > MAX_FILE_SIZE) {
    return c.json(
      {
        error: `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum limit of 10 MB.`,
      },
      400
    );
  }

  // Compute SHA-256 hash of the uploaded document bytes
  const sha256 = createHash('sha256').update(buffer).digest('hex');

  // Store file (local storage or Vercel Blob)
  const storage = getStorageService();
  const storageUrl = await storage.upload(buffer, fileItem.name, mimeType);

  const docId = `DOC-${applicationId}-${Date.now().toString().slice(-6)}`;
  const metadata: DocumentMetadata = {
    id: docId,
    applicationId,
    docType,
    fileName: fileItem.name,
    mimeType,
    sizeBytes: buffer.length,
    sha256,
    storageUrl,
    uploadedAt: new Date().toISOString(),
  };

  await store.saveDocument(metadata);

  // Write immutable ledger entry (contains ONLY metadata & cryptographic hash, NEVER file bytes)
  const actor = `${user.sub}:${user.role}`;
  await store.recordLedger(applicationId, 'DOCUMENT_UPLOADED', actor, {
    documentId: metadata.id,
    docType: metadata.docType,
    fileName: metadata.fileName,
    mimeType: metadata.mimeType,
    sizeBytes: metadata.sizeBytes,
    sha256: metadata.sha256,
    storageUrl: metadata.storageUrl,
    uploadedAt: metadata.uploadedAt,
    uploadedBy: user.email,
  });

  return c.json(metadata, 201);
});

// GET /applications/:id/documents - list uploaded document metadata
documentsRouter.get('/:id/documents', async (c) => {
  const applicationId = c.req.param('id');
  const user = c.get('user');

  const app = await store.getApplication(applicationId);
  if (!app) {
    return c.json({ error: `Application '${applicationId}' not found` }, 404);
  }

  if (!canReadApplication(user, app)) {
    return c.json({ error: 'Forbidden: Application is outside your scope' }, 403);
  }

  const docs = await store.getDocuments(applicationId);
  return c.json(docs);
});
