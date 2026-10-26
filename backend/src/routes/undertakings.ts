import { Hono } from 'hono';
import { createHash } from 'node:crypto';
import { store } from '../db/store.js';
import { authMiddleware } from '../middleware/auth.js';
import { canReadApplication } from '../services/access.js';
import { getStorageService } from '../services/storage.js';
import { computeExpiryState } from '../services/expiry.js';
import {
  DEFAULT_UNDERTAKING_DURATION_DAYS,
  DEFAULT_RENEWAL_VALIDITY_DAYS,
  RENEWAL_VALIDITY_PERIODS,
} from '../config/undertakings.js';
import type {
  ComplianceDocument,
  Undertaking,
  UndertakingEvidence,
  UndertakingStatus,
  UndertakingVerification,
} from '../types.js';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const undertakingsRouter = new Hono();
export const complianceRouter = new Hono();
export const officerQueueRouter = new Hono();

undertakingsRouter.use('*', authMiddleware);
complianceRouter.use('*', authMiddleware);
officerQueueRouter.use('*', authMiddleware);

// -------------------------------------------------------------
// UNDERTAKINGS
// -------------------------------------------------------------

// GET /undertakings - list undertakings scoped to caller's role and region
undertakingsRouter.get('/', async (c) => {
  const user = c.get('user');
  const statusParam = c.req.query('status') as UndertakingStatus | undefined;
  const appIdParam = c.req.query('applicationId');

  const allUndertakings = await store.listUndertakings({
    status: statusParam,
    applicationId: appIdParam,
  });

  // Filter undertakings based on application access scope
  const filtered: Undertaking[] = [];
  for (const ut of allUndertakings) {
    const app = await store.getApplication(ut.applicationId);
    if (!app) continue;
    if (canReadApplication(user, app)) {
      filtered.push(ut);
    }
  }

  return c.json(filtered);
});

// GET /undertakings/:id - details of an undertaking
undertakingsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  const ut = await store.getUndertaking(id);
  if (!ut) {
    return c.json({ error: `Undertaking '${id}' not found` }, 404);
  }

  const app = await store.getApplication(ut.applicationId);
  if (!app || !canReadApplication(user, app)) {
    return c.json({ error: 'Forbidden: Undertaking is outside your scope' }, 403);
  }

  return c.json(ut);
});

// POST /undertakings - create an undertaking (Officer or Chief)
undertakingsRouter.post('/', async (c) => {
  const user = c.get('user');
  if (user.role !== 'OFFICER' && user.role !== 'CHIEF') {
    return c.json({ error: 'Forbidden: Only officers or chief may issue undertakings' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body || !body.applicationId || !body.conditionText) {
    return c.json({ error: 'applicationId and conditionText are required' }, 400);
  }

  const app = await store.getApplication(body.applicationId);
  if (!app) {
    return c.json({ error: `Application '${body.applicationId}' not found` }, 404);
  }

  if (!canReadApplication(user, app)) {
    return c.json({ error: 'Forbidden: Application is outside your regional scope' }, 403);
  }

  const dueDate =
    body.dueDate ||
    new Date(Date.now() + DEFAULT_UNDERTAKING_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const ut = await store.createUndertaking({
    applicationId: app.id,
    conditionText: String(body.conditionText).trim(),
    dueDate,
    createdBy: user.email,
    status: 'PENDING',
  });

  const actor = `${user.sub}:${user.role}`;
  await store.recordLedger(app.id, 'UNDERTAKING_CREATED', actor, {
    undertakingId: ut.id,
    conditionText: ut.conditionText,
    dueDate: ut.dueDate,
    createdBy: user.email,
  });

  return c.json(ut, 201);
});

// POST /undertakings/:id/evidence - upload evidence for an undertaking
undertakingsRouter.post('/:id/evidence', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  const ut = await store.getUndertaking(id);
  if (!ut) {
    return c.json({ error: `Undertaking '${id}' not found` }, 404);
  }

  const app = await store.getApplication(ut.applicationId);
  if (!app || !canReadApplication(user, app)) {
    return c.json({ error: 'Forbidden: Undertaking is outside your scope' }, 403);
  }

  if (ut.status === 'VERIFIED') {
    return c.json({ error: 'Cannot upload evidence for an already verified undertaking' }, 400);
  }

  const body = await c.req.parseBody().catch(() => null);
  if (!body) {
    return c.json({ error: 'Invalid multipart body' }, 400);
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

  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const storage = getStorageService();
  const storageUrl = await storage.upload(buffer, fileItem.name, mimeType);

  const evidenceId = `EVD-${id}-${Date.now().toString().slice(-6)}`;
  const evd: UndertakingEvidence = {
    id: evidenceId,
    undertakingId: id,
    fileName: fileItem.name,
    fileHash: sha256,
    storageRef: storageUrl,
    submittedBy: user.email,
    submittedAt: new Date().toISOString(),
  };

  await store.saveEvidence(evd);
  const updated = await store.updateUndertaking(id, { status: 'SUBMITTED' });

  // Immutable ledger entry: ONLY SHA-256 hash, NEVER file bytes
  const actor = `${user.sub}:${user.role}`;
  await store.recordLedger(app.id, 'UNDERTAKING_EVIDENCE_SUBMITTED', actor, {
    undertakingId: id,
    evidenceId: evd.id,
    fileName: evd.fileName,
    fileHash: evd.fileHash,
    submittedBy: evd.submittedBy,
  });

  return c.json({ success: true, evidence: evd, undertaking: updated }, 201);
});

// POST /undertakings/:id/verify - Officer/Chief verification or rejection
undertakingsRouter.post('/:id/verify', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  if (user.role !== 'OFFICER' && user.role !== 'CHIEF') {
    return c.json({ error: 'Forbidden: Only officers or chief may verify undertakings' }, 403);
  }

  const ut = await store.getUndertaking(id);
  if (!ut) {
    return c.json({ error: `Undertaking '${id}' not found` }, 404);
  }

  const app = await store.getApplication(ut.applicationId);
  if (!app || !canReadApplication(user, app)) {
    return c.json({ error: 'Forbidden: Application is outside your regional scope' }, 403);
  }

  const body = (await c.req.json().catch(() => null)) as {
    decision?: 'VERIFIED' | 'REJECTED';
    remarks?: string;
  } | null;

  if (!body || !body.decision || !['VERIFIED', 'REJECTED'].includes(body.decision)) {
    return c.json({ error: "decision must be 'VERIFIED' or 'REJECTED'" }, 400);
  }

  const now = new Date().toISOString();
  const actor = `${user.sub}:${user.role}`;

  if (body.decision === 'REJECTED') {
    // Rejection requires remarks (refused without remarks)
    if (!body.remarks || body.remarks.trim().length === 0) {
      return c.json({ error: 'Rejection requires remarks' }, 400);
    }

    // Rejection requires the existing confirmed sign-off on the application
    const signoff = app.signoff || (await store.getSignoff(app.id));
    if (signoff?.decision !== 'CONFIRM') {
      return c.json({ error: 'Confirmed officer sign-off required before rejection' }, 409);
    }

    const verification: UndertakingVerification = {
      id: `VERIF-${id}-${Date.now().toString().slice(-6)}`,
      undertakingId: id,
      officer: user.email,
      decision: 'REJECTED',
      remarks: body.remarks.trim(),
      timestamp: now,
    };

    await store.saveVerification(verification);
    const updated = await store.updateUndertaking(id, { status: 'REJECTED' });

    await store.recordLedger(app.id, 'UNDERTAKING_REJECTED', actor, {
      undertakingId: id,
      verificationId: verification.id,
      officer: user.email,
      remarks: verification.remarks,
    });

    return c.json({ success: true, undertaking: updated, verification });
  }

  // Decision === 'VERIFIED'
  const verification: UndertakingVerification = {
    id: `VERIF-${id}-${Date.now().toString().slice(-6)}`,
    undertakingId: id,
    officer: user.email,
    decision: 'VERIFIED',
    remarks: body.remarks?.trim() || 'Undertaking verified by officer',
    timestamp: now,
  };

  await store.saveVerification(verification);
  const updated = await store.updateUndertaking(id, { status: 'VERIFIED' });

  await store.recordLedger(app.id, 'UNDERTAKING_VERIFIED', actor, {
    undertakingId: id,
    verificationId: verification.id,
    officer: user.email,
    remarks: verification.remarks,
  });

  return c.json({ success: true, undertaking: updated, verification });
});

// -------------------------------------------------------------
// COMPLIANCE RENEWALS
// -------------------------------------------------------------

// POST /compliance/:id/renew - submit a renewed document for an expiring or expired compliance record
complianceRouter.post('/:id/renew', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  const allDocs = await store.getComplianceDocuments();
  const doc = allDocs.find((d) => d.id === id);
  if (!doc) {
    return c.json({ error: `Compliance document '${id}' not found` }, 404);
  }

  const app = await store.getApplication(doc.applicationId);
  if (!app || !canReadApplication(user, app)) {
    return c.json({ error: 'Forbidden: Document is outside your scope' }, 403);
  }

  const body = await c.req.parseBody().catch(() => null);
  if (!body) {
    return c.json({ error: 'Invalid multipart body' }, 400);
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

  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const storage = getStorageService();
  const storageUrl = await storage.upload(buffer, fileItem.name, mimeType);

  const proposedValidity = typeof body['proposedValidityDate'] === 'string'
    ? body['proposedValidityDate']
    : undefined;

  doc.renewalStatus = 'SUBMITTED';
  doc.renewalEvidence = {
    fileName: fileItem.name,
    fileHash: sha256,
    storageRef: storageUrl,
    submittedBy: user.email,
    submittedAt: new Date().toISOString(),
    proposedValidityDate: proposedValidity,
  };

  await store.saveComplianceDocument(doc);

  // Write immutable ledger entry (hash only, never file bytes)
  const actor = `${user.sub}:${user.role}`;
  await store.recordLedger(app.id, 'DOCUMENT_RENEWAL_SUBMITTED', actor, {
    complianceDocumentId: doc.id,
    docType: doc.docType,
    fileName: fileItem.name,
    fileHash: sha256,
    submittedBy: user.email,
  });

  return c.json({ success: true, complianceDocument: doc }, 201);
});

// POST /compliance/:id/verify-renewal - Officer/Chief verification of renewed document
complianceRouter.post('/:id/verify-renewal', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  if (user.role !== 'OFFICER' && user.role !== 'CHIEF') {
    return c.json({ error: 'Forbidden: Only officers or chief may verify document renewals' }, 403);
  }

  const allDocs = await store.getComplianceDocuments();
  const doc = allDocs.find((d) => d.id === id);
  if (!doc) {
    return c.json({ error: `Compliance document '${id}' not found` }, 404);
  }

  const app = await store.getApplication(doc.applicationId);
  if (!app || !canReadApplication(user, app)) {
    return c.json({ error: 'Forbidden: Application is outside your regional scope' }, 403);
  }

  if (doc.renewalStatus !== 'SUBMITTED') {
    return c.json({ error: 'Document does not have a submitted renewal pending verification' }, 400);
  }

  const body = (await c.req.json().catch(() => null)) as {
    decision?: 'VERIFIED' | 'REJECTED';
    remarks?: string;
  } | null;

  if (!body || !body.decision || !['VERIFIED', 'REJECTED'].includes(body.decision)) {
    return c.json({ error: "decision must be 'VERIFIED' or 'REJECTED'" }, 400);
  }

  const now = new Date();
  const actor = `${user.sub}:${user.role}`;

  if (body.decision === 'REJECTED') {
    if (!body.remarks || body.remarks.trim().length === 0) {
      return c.json({ error: 'Rejection requires remarks' }, 400);
    }

    // Existing confirmed sign-off check
    const signoff = app.signoff || (await store.getSignoff(app.id));
    if (signoff?.decision !== 'CONFIRM') {
      return c.json({ error: 'Confirmed officer sign-off required before rejection' }, 409);
    }

    doc.renewalStatus = 'REJECTED';
    doc.renewalVerification = {
      officer: user.email,
      decision: 'REJECTED',
      remarks: body.remarks.trim(),
      timestamp: now.toISOString(),
    };

    await store.saveComplianceDocument(doc);

    await store.recordLedger(app.id, 'DOCUMENT_RENEWAL_REJECTED', actor, {
      complianceDocumentId: doc.id,
      docType: doc.docType,
      officer: user.email,
      remarks: body.remarks.trim(),
    });

    return c.json({ success: true, complianceDocument: doc });
  }

  // Decision === 'VERIFIED'
  // Verified renewal updates the validity date and unlocks a locked application
  const validityDays =
    RENEWAL_VALIDITY_PERIODS[doc.docType] || DEFAULT_RENEWAL_VALIDITY_DAYS;
  const newExpiryDate =
    doc.renewalEvidence?.proposedValidityDate ||
    new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  doc.expiryDate = newExpiryDate;
  const compResult = computeExpiryState(newExpiryDate, now);
  doc.state = compResult.state;
  doc.tier = compResult.tier;
  doc.daysRemaining = compResult.daysRemaining;
  doc.renewalStatus = 'VERIFIED';
  doc.renewalVerification = {
    officer: user.email,
    decision: 'VERIFIED',
    remarks: body.remarks?.trim() || 'Renewal verified and validity updated',
    timestamp: now.toISOString(),
  };

  await store.saveComplianceDocument(doc);

  // Check if application is locked and whether this renewal unlocks it
  let unlocked = false;
  if (app.locked) {
    const appDocs = await store.getComplianceDocuments(app.id);
    const stillOverdue = appDocs.some((d) => d.id !== doc.id && d.state === 'OVERDUE');
    if (!stillOverdue) {
      await store.updateApplication(app.id, { locked: false });
      unlocked = true;
      await store.recordLedger(app.id, 'APPLICATION_UNLOCKED', actor, {
        reason: `Unlocked after verified renewal of ${doc.docType}`,
        complianceDocumentId: doc.id,
        newExpiryDate,
      });
    }
  }

  await store.recordLedger(app.id, 'DOCUMENT_RENEWAL_VERIFIED', actor, {
    complianceDocumentId: doc.id,
    docType: doc.docType,
    newExpiryDate,
    officer: user.email,
    unlocked,
  });

  return c.json({ success: true, complianceDocument: doc, unlocked });
});

// -------------------------------------------------------------
// OFFICER VERIFICATION QUEUE
// -------------------------------------------------------------

// GET /officer/verification-queue - returns submitted undertakings and renewals scoped by region
officerQueueRouter.get('/', async (c) => {
  const user = c.get('user');
  if (user.role !== 'OFFICER' && user.role !== 'CHIEF') {
    return c.json({ error: 'Forbidden: Verification queue is restricted to officers and chief' }, 403);
  }

  // 1. Pending Undertakings (status: SUBMITTED)
  const allUndertakings = await store.listUndertakings({ status: 'SUBMITTED' });
  const pendingUndertakings: Undertaking[] = [];
  for (const ut of allUndertakings) {
    const app = await store.getApplication(ut.applicationId);
    if (app && canReadApplication(user, app)) {
      pendingUndertakings.push(ut);
    }
  }

  // 2. Pending Document Renewals (renewalStatus: SUBMITTED)
  const allCompliance = await store.getComplianceDocuments();
  const pendingRenewals: (ComplianceDocument & { institutionName?: string; region?: string })[] = [];
  for (const doc of allCompliance) {
    if (doc.renewalStatus === 'SUBMITTED') {
      const app = await store.getApplication(doc.applicationId);
      if (app && canReadApplication(user, app)) {
        pendingRenewals.push({
          ...doc,
          institutionName: app.institutionName,
          region: app.region,
        });
      }
    }
  }

  return c.json({
    undertakings: pendingUndertakings,
    renewals: pendingRenewals,
  });
});
