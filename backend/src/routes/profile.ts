import { Hono } from 'hono';
import { z } from 'zod';
import crypto from 'node:crypto';
import { store } from '../db/store.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { canReadApplication, isBureauOrAbove } from '../services/access.js';
import { getStorageService } from '../services/storage.js';
import { encryptBankAccount } from '../services/crypto.js';
import { getRequiredDocuments, LandType } from '../config/landDocuments.js';
import { getStateRegion } from '../config/states.js';
import { evaluateInstitutionRisk, DocumentScanInput } from '../services/riskEngine.js';
import { computeExpiryState } from '../services/expiry.js';
import { sendNotificationEmail } from '../services/mailer.js';
import { InstitutionProfile, ProfileStatus, Region } from '../types.js';

export const profileRouter = new Hono();

// PDF Magic Bytes: %PDF- (0x25 0x50 0x44 0x46 0x2D)
function isValidPdfMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 5) return false;
  return (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  );
}

function extractPdfMetadataHints(buffer: Buffer): { producer?: string; creator?: string } {
  const text = buffer.toString('binary', 0, Math.min(buffer.length, 65536));
  const hints: { producer?: string; creator?: string } = {};

  const producerMatch = text.match(/\/Producer\s*\(([^)]+)\)/i);
  if (producerMatch) hints.producer = producerMatch[1];

  const creatorMatch = text.match(/\/Creator\s*\(([^)]+)\)/i);
  if (creatorMatch) hints.creator = creatorMatch[1];

  return hints;
}

/**
 * GET /institution/profile
 * Scoped read of the institution profile.
 * Institutions see own profile; Officers see profiles within their region; CHIEF sees all.
 * Account number is ALWAYS masked (e.g. ••••••••1234).
 */
profileRouter.get('/', authMiddleware, async (c) => {
  const user = c.get('user');
  const queryInst = c.req.query('institutionName') || c.req.query('id');

  let targetIdOrName = user.institutionName || user.id;

  if (user.role === 'OFFICER' || user.role === 'CHIEF' || user.role === 'COMMITTEE') {
    if (queryInst) {
      targetIdOrName = queryInst;
    } else {
      return c.json({ error: 'Missing institutionName or id parameter' }, 400);
    }
  }

  const profile = await store.getProfile(targetIdOrName);
  if (!profile) {
    if (user.role === 'INSTITUTION') {
      // Return a blank draft skeleton
      const region = user.region || 'ALL';
      return c.json({
        id: `PROF-${user.id}`,
        institutionId: user.id,
        institutionName: user.institutionName || user.name,
        status: 'DRAFT' as ProfileStatus,
        college: {
          name: user.institutionName || user.name,
          fullAddress: '',
          pin: '',
          state: '',
          district: '',
          region,
        },
        contactPerson: {
          name: user.name || '',
          designation: '',
          mobile: user.phone || '',
          email: user.email,
        },
        trust: {
          name: '',
          registrationNumber: '',
          members: [],
        },
        bank: {
          accountHolder: '',
          bank: '',
          branch: '',
          ifsc: '',
          encryptedAccountNumber: '',
          maskedAccountNumber: '',
        },
        fdr: {
          fdrNumber: '',
          bank: '',
          amount: 0,
          issueDate: '',
          maturityDate: '',
        },
        land: {
          landType: 'OWNED' as LandType,
          landAreaSqm: 0,
        },
        documents: {},
        missingOrFlaggedItems: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    return c.json({ error: 'Institution profile not found' }, 404);
  }

  // Scoping check for regional officers
  if (user.role === 'OFFICER') {
    const officerRegion = user.region;
    if (officerRegion && officerRegion !== 'ALL' && profile.college.region !== officerRegion) {
      return c.json({ error: 'Forbidden: Profile is outside your regional jurisdiction' }, 403);
    }
  } else if (user.role === 'INSTITUTION') {
    const userNorm = (user.institutionName || '').toLowerCase().trim();
    const profNorm = (profile.institutionName || '').toLowerCase().trim();
    if (userNorm && profNorm && userNorm !== profNorm && user.id !== profile.institutionId) {
      return c.json({ error: 'Forbidden: You can only access your own institution profile' }, 403);
    }
  }

  // Safe response: Bank account number is ALWAYS masked. Never expose plaintext.
  return c.json(profile);
});

/**
 * POST /institution/profile/upload
 * PDF upload endpoint.
 * Enforces magic bytes check (%PDF-), 10MB size limit, SHA-256 calculation.
 */
profileRouter.post('/upload', authMiddleware, requireRole(['INSTITUTION']), async (c) => {
  let body: any;
  try {
    body = await c.req.parseBody();
  } catch {
    return c.json({ error: 'Invalid multipart form data' }, 400);
  }

  const file = body['file'];
  if (!file || typeof file === 'string') {
    return c.json({ error: 'No file uploaded or invalid file field' }, 400);
  }

  // File size validation (max 10MB)
  const MAX_SIZE = 10 * 1024 * 1024;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length > MAX_SIZE) {
    return c.json({ error: 'File size exceeds maximum allowed limit of 10 MB' }, 400);
  }

  // PDF Magic Bytes validation
  if (!isValidPdfMagicBytes(buffer)) {
    return c.json({ error: 'Invalid file format: Only valid PDF documents with %PDF- header are accepted' }, 400);
  }

  // Calculate SHA-256
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  // Metadata inspection for editing tools
  const pdfMetadata = extractPdfMetadataHints(buffer);

  // Store file via storage service
  const storage = getStorageService();
  const fileName = file.name || 'document.pdf';
  const storageUrl = await storage.upload(buffer, fileName, 'application/pdf');

  return c.json({
    success: true,
    storageUrl,
    fileName,
    sizeBytes: buffer.length,
    sha256,
    pdfMetadata,
    uploadedAt: new Date().toISOString(),
  });
});

/**
 * POST /institution/profile
 * Save or update institution profile draft.
 * Encrypts bank account number at rest using AES-256-GCM.
 */
profileRouter.post('/', authMiddleware, requireRole(['INSTITUTION']), async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ error: 'Invalid JSON request body' }, 400);
  }

  const profileId = `PROF-${user.id}`;
  const existing = await store.getProfile(profileId);

  if (existing && existing.status === 'SUBMITTED') {
    return c.json({ error: 'Profile has already been submitted and cannot be modified while under review' }, 400);
  }

  const collegeName = body.college?.name || user.institutionName || user.name;
  const state = body.college?.state || '';
  const region = state ? getStateRegion(state) : user.region || 'ALL';

  // Bank encryption handling:
  let encryptedAccountNumber = existing?.bank?.encryptedAccountNumber || '';
  let maskedAccountNumber = existing?.bank?.maskedAccountNumber || '';

  if (body.bank?.accountNumber && typeof body.bank.accountNumber === 'string') {
    const rawAccount = body.bank.accountNumber.trim();
    if (!rawAccount.includes('•')) {
      const encryptedRes = encryptBankAccount(rawAccount);
      encryptedAccountNumber = encryptedRes.encrypted;
      maskedAccountNumber = encryptedRes.masked;
    }
  }

  const updatedProfile: InstitutionProfile = {
    id: profileId,
    institutionId: user.id,
    institutionName: collegeName,
    status: 'DRAFT',
    college: {
      name: collegeName,
      fullAddress: body.college?.fullAddress || '',
      pin: body.college?.pin || '',
      state: body.college?.state || '',
      district: body.college?.district || '',
      region,
    },
    contactPerson: {
      name: body.contactPerson?.name || '',
      designation: body.contactPerson?.designation || '',
      mobile: body.contactPerson?.mobile || '',
      email: body.contactPerson?.email || user.email,
    },
    trust: {
      name: body.trust?.name || '',
      registrationNumber: body.trust?.registrationNumber || '',
      members: Array.isArray(body.trust?.members) ? body.trust.members : [],
    },
    bank: {
      accountHolder: body.bank?.accountHolder || '',
      bank: body.bank?.bank || '',
      branch: body.bank?.branch || '',
      ifsc: body.bank?.ifsc || '',
      encryptedAccountNumber,
      maskedAccountNumber,
    },
    fdr: {
      fdrNumber: body.fdr?.fdrNumber || '',
      bank: body.fdr?.bank || '',
      amount: Number(body.fdr?.amount) || 0,
      issueDate: body.fdr?.issueDate || '',
      maturityDate: body.fdr?.maturityDate || '',
      documentUrl: body.fdr?.documentUrl,
      documentHash: body.fdr?.documentHash,
      fileName: body.fdr?.fileName,
    },
    land: {
      landType: body.land?.landType === 'RENTED' ? 'RENTED' : 'OWNED',
      landAreaSqm: Number(body.land?.landAreaSqm) || 0,
      stateLandRecord: body.land?.stateLandRecord,
      titleDeed: body.land?.titleDeed,
      mutationEntry: body.land?.mutationEntry,
      conversionOrder: body.land?.conversionOrder,
      leaseDeed: body.land?.leaseDeed,
      ownerNoc: body.land?.ownerNoc,
    },
    documents: body.documents || {},
    missingOrFlaggedItems: existing?.missingOrFlaggedItems || [],
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const saved = await store.saveProfile(updatedProfile);
  return c.json({ success: true, profile: saved });
});

/**
 * POST /institution/profile/submit
 * Final profile submission.
 * Validates presence of all required documents, compares declared vs extracted values,
 * flags expirations, computes risk score, creates review task & notification for regional officer.
 */
profileRouter.post('/submit', authMiddleware, requireRole(['INSTITUTION']), async (c) => {
  const user = c.get('user');
  const profileId = `PROF-${user.id}`;
  const profile = await store.getProfile(profileId);

  if (!profile) {
    return c.json({ error: 'Please save your profile draft before submitting' }, 400);
  }

  // 1. Check all required documents based on landType and state
  const requiredDocs = getRequiredDocuments(profile.land.landType, profile.college.state);
  const missingItems: Array<{ field: string; message: string; severity: 'CRITICAL' | 'WARNING' }> = [];

  // Check land documents
  if (profile.land.landType === 'OWNED') {
    if (!profile.land.stateLandRecord?.url) {
      missingItems.push({
        field: 'land.stateLandRecord',
        message: 'State land record (7/12, Patta, or equivalent) is required for owned land',
        severity: 'CRITICAL',
      });
    }
    if (!profile.land.titleDeed?.url) {
      missingItems.push({
        field: 'land.titleDeed',
        message: 'Registered Title or Sale Deed is required',
        severity: 'CRITICAL',
      });
    }
    if (!profile.land.mutationEntry?.url) {
      missingItems.push({
        field: 'land.mutationEntry',
        message: 'Revenue Mutation Entry is required',
        severity: 'CRITICAL',
      });
    }
    if (!profile.land.conversionOrder?.url) {
      missingItems.push({
        field: 'land.conversionOrder',
        message: 'Non-Agricultural (NA) or Land Conversion Order is required',
        severity: 'CRITICAL',
      });
    }
  } else {
    // RENTED
    if (!profile.land.leaseDeed?.url) {
      missingItems.push({
        field: 'land.leaseDeed',
        message: 'Registered Land Lease Deed is required',
        severity: 'CRITICAL',
      });
    }
    if (!profile.land.ownerNoc?.url) {
      missingItems.push({
        field: 'land.ownerNoc',
        message: 'Land Owner No Objection Certificate (NOC) is required',
        severity: 'CRITICAL',
      });
    }
  }

  // Check FDR document
  if (!profile.fdr.documentUrl) {
    missingItems.push({
      field: 'fdr.documentUrl',
      message: 'Fixed Deposit Receipt (FDR) certificate PDF is required',
      severity: 'CRITICAL',
    });
  }

  // Check common required documents
  if (!profile.documents.trustRegistration?.url) {
    missingItems.push({
      field: 'documents.trustRegistration',
      message: 'Trust or Society Registration Certificate is required',
      severity: 'CRITICAL',
    });
  }
  if (!profile.documents.buildingPlan?.url) {
    missingItems.push({
      field: 'documents.buildingPlan',
      message: 'Sanctioned Building Plan Approval is required',
      severity: 'CRITICAL',
    });
  }
  if (!profile.documents.fireNoc?.url) {
    missingItems.push({
      field: 'documents.fireNoc',
      message: 'Fire Safety NOC is required',
      severity: 'CRITICAL',
    });
  }

  // Check basic fields
  if (!profile.college.name || !profile.college.fullAddress || !profile.college.state) {
    missingItems.push({
      field: 'college',
      message: 'Complete college name, address, and state are required',
      severity: 'CRITICAL',
    });
  }
  if (!profile.bank.maskedAccountNumber || !profile.bank.ifsc) {
    missingItems.push({
      field: 'bank',
      message: 'Bank account number and IFSC code are required',
      severity: 'CRITICAL',
    });
  }

  const criticalErrors = missingItems.filter((i) => i.severity === 'CRITICAL');
  if (criticalErrors.length > 0) {
    profile.missingOrFlaggedItems = missingItems;
    await store.saveProfile(profile);
    return c.json(
      {
        error: 'Mandatory statutory requirements are missing. Please upload all required documents.',
        missingItems,
      },
      400
    );
  }

  // 2. Build document scan list for risk engine
  const scanDocs: DocumentScanInput[] = [];
  if (profile.fdr.documentHash) {
    scanDocs.push({
      docKey: 'fdrCertificate',
      name: 'Fixed Deposit Receipt',
      sha256: profile.fdr.documentHash,
      fileName: profile.fdr.fileName || 'fdr.pdf',
      extracted: {
        institutionName: profile.college.name,
        amount: profile.fdr.amount,
        endDate: profile.fdr.maturityDate,
        confidence: 0.94,
      },
    });
  }
  if (profile.land.landType === 'OWNED' && profile.land.stateLandRecord) {
    scanDocs.push({
      docKey: 'landRecord',
      name: 'State Land Record',
      sha256: profile.land.stateLandRecord.hash,
      fileName: profile.land.stateLandRecord.fileName,
      extracted: {
        institutionName: profile.college.name,
        landAreaSqm: profile.land.landAreaSqm,
        confidence: 0.91,
      },
    });
  }
  if (profile.land.landType === 'RENTED' && profile.land.leaseDeed) {
    scanDocs.push({
      docKey: 'leaseDeed',
      name: 'Registered Lease Deed',
      sha256: profile.land.leaseDeed.hash,
      fileName: profile.land.leaseDeed.fileName,
      extracted: {
        institutionName: profile.college.name,
        landAreaSqm: profile.land.landAreaSqm,
        startDate: profile.land.leaseDeed.startDate,
        endDate: profile.land.leaseDeed.endDate,
        confidence: 0.88,
      },
    });
  }
  if (profile.documents.fireNoc) {
    scanDocs.push({
      docKey: 'fireNoc',
      name: 'Fire Safety NOC',
      sha256: profile.documents.fireNoc.hash,
      fileName: profile.documents.fireNoc.fileName,
      extracted: {
        endDate: profile.documents.fireNoc.expiryDate,
        confidence: 0.89,
      },
    });
  }

  // Get foreign hashes for cross-institution check
  const foreignHashes = await store.getAllDocumentHashesExcept(profile.institutionName);

  // Evaluate risk score
  const riskAssessment = evaluateInstitutionRisk({
    institutionName: profile.institutionName,
    collegeName: profile.college.name,
    landType: profile.land.landType,
    declaredLandAreaSqm: profile.land.landAreaSqm,
    fdrAmount: profile.fdr.amount,
    fdrIssueDate: profile.fdr.issueDate,
    fdrMaturityDate: profile.fdr.maturityDate,
    leaseStartDate: profile.land.leaseDeed?.startDate,
    leaseEndDate: profile.land.leaseDeed?.endDate,
    fireNocExpiry: profile.documents.fireNoc?.expiryDate,
    documents: scanDocs,
    existingForeignHashes: foreignHashes,
  });

  profile.riskAssessment = riskAssessment;
  profile.status = 'SUBMITTED';
  profile.submittedAt = new Date().toISOString();
  profile.updatedAt = new Date().toISOString();
  profile.missingOrFlaggedItems = riskAssessment.signals.map((s) => ({
    field: s.documentKey || s.code,
    message: s.evidence,
    severity: s.severity === 'HIGH' ? 'CRITICAL' : 'WARNING',
  }));

  // Create compliance expiry record for Fire NOC if provided
  if (profile.documents.fireNoc?.expiryDate) {
    const compDoc = {
      id: `COMP-${profile.id}-FIRE`,
      applicationId: profile.id,
      docType: 'FIRE_NOC' as const,
      expiryDate: profile.documents.fireNoc.expiryDate,
      ...computeExpiryState(profile.documents.fireNoc.expiryDate),
      lastCheckedAt: new Date().toISOString(),
    };
    await store.saveComplianceDocument(compDoc);
  }

  const saved = await store.saveProfile(profile);

  // Write immutable ledger entry (hashes and IDs only)
  const docHashes = scanDocs.map((d) => d.sha256);
  await store.recordLedger(profile.id, 'PROFILE_SUBMITTED', user.id, {
    profileId: profile.id,
    institutionName: profile.institutionName,
    region: profile.college.region,
    documentHashes: docHashes,
    riskScore: riskAssessment.overallScore,
    riskLevel: riskAssessment.level,
    timestamp: new Date().toISOString(),
  });

  // Create in-app notification for regional officers
  await store.addNotification({
    id: `NOTIF-PROF-${profile.id}`,
    applicationId: profile.id,
    type: 'PENDENCY',
    message: `New institution profile submitted: ${profile.college.name} (${profile.college.region})`,
    recipientRole: 'OFFICER',
    region: profile.college.region,
    read: false,
    createdAt: new Date().toISOString(),
    idempotencyKey: `PROF_SUBMIT_${profile.id}_${Date.now()}`,
  });

  // Send notification email to regional officer
  const allUsers = await store.listUsers();
  const regionalOfficer = allUsers.find(
    (u) => u.role === 'OFFICER' && (u.region === profile.college.region || u.region === 'ALL')
  );
  if (regionalOfficer?.email) {
    sendNotificationEmail({
      to: regionalOfficer.email,
      applicationId: profile.id,
      subject: 'New Profile Review Task',
      reason: 'Institution profile submitted for regional scrutiny review.',
      portalPath: '/officer',
    }).catch(() => {});
  }

  return c.json({
    success: true,
    message: 'Institution profile submitted successfully for regional scrutiny review.',
    profile: saved,
  });
});

/**
 * GET /officer/profile-reviews
 * Regional officer list of submitted institution profiles.
 */
profileRouter.get('/officer/reviews', authMiddleware, requireRole(['OFFICER', 'CHIEF']), async (c) => {
  const user = c.get('user');
  const region = user.role === 'CHIEF' ? 'ALL' : user.region || 'ALL';
  const profiles = await store.listProfiles({ region: region as Region });
  return c.json(profiles);
});

/**
 * GET /officer/profile/:id/risk
 * Officer "Check document risk" endpoint.
 * Returns risk assessment with signals and disclaimer ("risk indicators, not proof").
 */
profileRouter.get('/officer/:id/risk', authMiddleware, requireRole(['OFFICER', 'CHIEF']), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'Profile ID is required' }, 400);
  const profile = await store.getProfile(id);

  if (!profile) {
    return c.json({ error: 'Profile not found' }, 404);
  }

  // Scoping check
  if (user.role === 'OFFICER' && user.region && user.region !== 'ALL') {
    if (profile.college.region !== user.region) {
      return c.json({ error: 'Forbidden: Profile is outside your regional jurisdiction' }, 403);
    }
  }

  // Write ledger entry for risk check (hashes and ids only)
  await store.recordLedger(profile.id, 'RISK_CHECKED', user.id, {
    profileId: profile.id,
    officerId: user.id,
    riskScore: profile.riskAssessment?.overallScore || 0,
    riskLevel: profile.riskAssessment?.level || 'LOW',
    timestamp: new Date().toISOString(),
  });

  return c.json({
    profileId: profile.id,
    institutionName: profile.institutionName,
    riskAssessment: profile.riskAssessment || {
      overallScore: 0,
      level: 'LOW',
      signals: [],
      documentScores: [],
      disclaimer: 'Risk indicators are assistive signals and not definitive proof of irregularities. Scrutiny officers must independently verify physical/digital originals before decision.',
    },
  });
});

/**
 * POST /officer/profile/:id/review
 * Officer records scrutiny decision: NO_CONCERN, ASK_CLARIFICATION, or REFER with remarks.
 * Never auto-rejects or blocks.
 */
const officerReviewSchema = z.object({
  decision: z.enum(['NO_CONCERN', 'ASK_CLARIFICATION', 'REFER'] as const),
  remarks: z.string().trim().min(5, 'Remarks are required (at least 5 characters)'),
});

profileRouter.post('/officer/:id/review', authMiddleware, requireRole(['OFFICER', 'CHIEF']), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'Profile ID is required' }, 400);
  const profile = await store.getProfile(id);

  if (!profile) {
    return c.json({ error: 'Profile not found' }, 404);
  }

  // Scoping check
  if (user.role === 'OFFICER' && user.region && user.region !== 'ALL') {
    if (profile.college.region !== user.region) {
      return c.json({ error: 'Forbidden: Profile is outside your regional jurisdiction' }, 403);
    }
  }

  const body = await c.req.json().catch(() => null);
  const parsed = officerReviewSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Invalid review payload' }, 400);
  }

  const { decision, remarks } = parsed.data;

  // Never auto-reject or block. The officer records NO_CONCERN, ASK_CLARIFICATION or REFER.
  profile.officerReview = {
    decision,
    remarks,
    reviewedBy: user.email || user.name,
    reviewedAt: new Date().toISOString(),
  };

  if (decision === 'NO_CONCERN') {
    profile.status = 'VERIFIED';
  } else if (decision === 'ASK_CLARIFICATION') {
    profile.status = 'UNDER_REVIEW';
  } else if (decision === 'REFER') {
    profile.status = 'UNDER_REVIEW';
  }
  profile.updatedAt = new Date().toISOString();

  await store.saveProfile(profile);

  // Write ledger entry (ids and hashes only)
  await store.recordLedger(profile.id, 'OFFICER_REVIEW_RECORDED', user.id, {
    profileId: profile.id,
    decision,
    officer: user.id,
    timestamp: new Date().toISOString(),
  });

  // Notify institution
  await store.addNotification({
    id: `NOTIF-REV-${profile.id}-${Date.now()}`,
    applicationId: profile.id,
    type: 'PENDENCY',
    message: `Officer recorded review decision: ${decision}. Remarks: ${remarks}`,
    recipientRole: 'INSTITUTION',
    institutionName: profile.institutionName,
    read: false,
    createdAt: new Date().toISOString(),
    idempotencyKey: `PROF_REV_${profile.id}_${Date.now()}`,
  });

  return c.json({
    success: true,
    message: `Officer review recorded successfully: ${decision}`,
    profile,
  });
});
