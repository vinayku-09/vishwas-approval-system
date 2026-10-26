import { Hono } from 'hono';
import { store } from '../db/store.js';
import { computeExpiryState } from '../services/expiry.js';
import { Notification } from '../types.js';
import { DEFAULT_CRON_SECRET } from '../config/timelines.js';

export const cronRouter = new Hono();

// POST /cron/expiry-check - daily scheduled job to recompute compliance states & lock overdue applications
cronRouter.post('/expiry-check', async (c) => {
  const authHeader = c.req.header('authorization') || '';
  const expectedSecret = process.env.CRON_SECRET || DEFAULT_CRON_SECRET;

  if (!authHeader.startsWith('Bearer ') || authHeader.slice(7).trim() !== expectedSecret) {
    return c.json({ error: 'Unauthorized: Invalid or missing cron authorization token' }, 401);
  }

  const allComplianceDocs = await store.getComplianceDocuments();
  const now = new Date();
  let notificationsCreated = 0;
  let lockedApplications = 0;

  // Track which application IDs were touched this run for summary ledger entry
  const touchedApplicationIds = new Set<string>();

  for (const doc of allComplianceDocs) {
    const previousState = doc.state;
    const previousTier = doc.tier;
    const result = computeExpiryState(doc.expiryDate, now);

    // Update document record
    doc.state = result.state;
    doc.tier = result.tier;
    doc.daysRemaining = result.daysRemaining;
    doc.lastCheckedAt = now.toISOString();
    await store.saveComplianceDocument(doc);

    const isOverdue = result.state === 'OVERDUE';
    const isWarning = result.state === 'WARNING';

    // Check if document crossed a tier or became overdue
    const tierChanged = isWarning && result.tier !== previousTier;
    const becameOverdue = isOverdue && previousState !== 'OVERDUE';

    if (tierChanged || becameOverdue || (isOverdue && !doc.tier)) {
      const tierLabel = isOverdue ? 'OVERDUE' : `${result.tier}`;
      const idempotencyKey = `${doc.id}-${tierLabel}`;

      const notifId = `NOTIF-${doc.id}-${tierLabel}`;
      const notif: Notification = {
        id: notifId,
        applicationId: doc.applicationId,
        title: isOverdue
          ? `Compliance Alert: ${doc.docType} Expired`
          : `Expiry Warning: ${doc.docType} expires in ${result.daysRemaining} days`,
        message: isOverdue
          ? `Document ${doc.docType} expired on ${doc.expiryDate}. Application ${doc.applicationId} is locked.`
          : `Document ${doc.docType} is within the ${result.tier}-day renewal window (valid until ${doc.expiryDate}).`,
        type: isOverdue ? 'OVERDUE' : 'WARNING',
        read: false,
        createdAt: now.toISOString(),
        idempotencyKey,
      };

      const { created } = await store.addNotification(notif);
      if (created) {
        notificationsCreated++;
        // Write ledger entry for crossing a warning/overdue tier
        await store.recordLedger(
          doc.applicationId,
          isOverdue ? 'COMPLIANCE_DOCUMENT_OVERDUE' : 'COMPLIANCE_EXPIRY_WARNING',
          'system',
          {
            complianceDocumentId: doc.id,
            docType: doc.docType,
            expiryDate: doc.expiryDate,
            tier: result.tier,
            daysRemaining: result.daysRemaining,
            state: result.state,
          }
        );
        touchedApplicationIds.add(doc.applicationId);
      }
    }

    // If document is OVERDUE, lock the application
    if (isOverdue) {
      const app = await store.getApplication(doc.applicationId);
      if (app && !app.locked) {
        await store.updateApplication(app.id, { locked: true });
        lockedApplications++;
        await store.recordLedger(app.id, 'APPLICATION_LOCKED', 'system', {
          reason: `Locked due to expired ${doc.docType} (expired: ${doc.expiryDate})`,
          documentId: doc.id,
        });
        touchedApplicationIds.add(doc.applicationId);
      }
    }
  }

  // Write a CRON_RUN_COMPLETED ledger entry for each application touched this run.
  // This creates a durable, hash-chained record that the cron job ran and what it did,
  // enabling forensic reconstruction of who changed what and when.
  // Applications with no tier change are not written (idempotent audit).
  for (const appId of touchedApplicationIds) {
    await store.recordLedger(appId, 'CRON_RUN_COMPLETED', 'system', {
      cronJob: 'expiry-check',
      runAt: now.toISOString(),
      processedDocuments: allComplianceDocs.filter((d) => d.applicationId === appId).length,
      notificationsCreated,
      lockedApplications,
    });
  }

  return c.json({
    success: true,
    processedDocuments: allComplianceDocs.length,
    notificationsCreated,
    lockedApplications,
    timestamp: now.toISOString(),
  });
});
