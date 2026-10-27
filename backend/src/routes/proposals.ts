/**
 * Proposed Courses & Intake Routes
 *
 * Routes:
 * - POST /proposals: Create a new proposal draft
 * - GET /proposals: List proposals scoped by user role & region
 * - GET /proposals/:id: Get proposal details with live normative check results
 * - PATCH /proposals/:id: Edit draft proposal (branches, type)
 * - POST /proposals/:id/submit: Submit proposal (checks never auto-reject or block; ledger gets IDs/hashes only)
 * - POST /proposals/:id/determination: Officer determination (NO_CONCERN|ASK_CLARIFICATION|REFER, remarks mandatory; ledger gets IDs/hashes only)
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { store } from '../db/store.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { sha256 } from '../services/crypto.js';
import { checkCourseProposal } from '../services/branchCheck.js';
import { CourseProposal, ProposedBranch, ProposalType, ProposalStatus, Region } from '../types.js';

export const proposalsRouter = new Hono();

const proposedBranchSchema = z.object({
  id: z.string().optional(),
  level: z.string().min(1, 'Level is required'), // e.g. UG, PG, DIPLOMA
  program: z.string().min(1, 'Program is required'), // e.g. ENGINEERING, MANAGEMENT
  course: z.string().min(1, 'Course name is required'),
  affiliatingBody: z.string().min(1, 'Affiliating body is required'),
  currentIntake: z.number().nonnegative().default(0),
  expectedIntake: z.number().positive('Expected intake must be greater than 0'),
  shift: z.union([z.string(), z.number()]).default('1st Shift'),
  facultySanctioned: z.number().nonnegative().default(0),
  facultyAvailable: z.number().nonnegative().default(0),
  facultyPayCompliant: z.boolean().default(true),
  labs: z.array(z.string()).default([]),
  builtUpArea: z.number().nonnegative().default(0),
  libraryAvailable: z.boolean().default(true),
  affiliationNocAvailable: z.boolean().default(false),
  affiliationNocDocId: z.string().optional(),
  affiliationNocSha256: z.string().optional(),
});

const createProposalSchema = z.object({
  applicationId: z.string().optional().default('APP-GENERAL'),
  type: z.enum(['NEW_INSTITUTION', 'EOA', 'NEW_COURSE', 'INTAKE_INCREASE', 'CLOSURE']),
  branches: z.array(proposedBranchSchema).min(1, 'At least one branch is required'),
});

const updateProposalSchema = z.object({
  applicationId: z.string().optional(),
  type: z.enum(['NEW_INSTITUTION', 'EOA', 'NEW_COURSE', 'INTAKE_INCREASE', 'CLOSURE']).optional(),
  branches: z.array(proposedBranchSchema).optional(),
});

const determinationSchema = z.object({
  decision: z.enum(['NO_CONCERN', 'ASK_CLARIFICATION', 'REFER']),
  remarks: z.string().min(1, 'Remarks are mandatory for officer determination.').refine((s) => s.trim().length > 0, {
    message: 'Remarks cannot be empty or whitespace only.',
  }),
});

/**
 * Helper to fetch context (land area, compliance docs) for running checks.
 */
async function getCheckContext(institutionId: string, applicationId: string, proposalType?: string) {
  const profile = await store.getProfile(institutionId);
  const landAreaSqm = profile?.land?.landAreaSqm || 0;
  const complianceDocs = await store.getComplianceDocuments(applicationId);

  return {
    institutionLandAreaSqm: landAreaSqm,
    complianceDocuments: complianceDocs,
    proposalType,
  };
}

/**
 * Helper to check access to a specific proposal.
 */
function canAccessProposal(user: any, proposal: CourseProposal): boolean {
  if (user.role === 'CHIEF' || user.role === 'chief') {
    return true;
  }
  if (user.role === 'OFFICER' || user.role === 'officer' || user.role === 'COMMITTEE' || user.role === 'committee') {
    if (!user.region || user.region === 'ALL') {
      return true;
    }
    return proposal.region === user.region || proposal.region === 'ALL';
  }
  // Institution
  const userInst = (user.institutionName || user.id || '').toLowerCase().trim();
  const propInst = (proposal.institutionId || '').toLowerCase().trim();
  return userInst === propInst || propInst.includes(userInst) || userInst.includes(propInst);
}

/**
 * POST /proposals
 * Create a new proposal draft.
 */
proposalsRouter.post('/', authMiddleware, async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));

  const parsed = createProposalSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.format() }, 400);
  }

  const institutionId = user.institutionName || user.id;
  const institutionName = user.institutionName || user.name || 'Institution';

  // Resolve region from profile or user region
  let region: Region = user.region || 'ALL';
  const profile = await store.getProfile(institutionId);
  if (profile?.college?.region) {
    region = profile.college.region;
  }

  const proposalId = `PROP-${Date.now().toString().slice(-6)}`;
  const now = new Date().toISOString();

  // Assign branch IDs if not present
  const branches: ProposedBranch[] = parsed.data.branches.map((b, idx) => ({
    ...b,
    id: b.id || `BR-${proposalId}-${idx + 1}`,
    proposalId,
  }));

  const checkContext = await getCheckContext(institutionId, parsed.data.applicationId, parsed.data.type);
  const checkResults = checkCourseProposal(branches, checkContext);

  const proposal: CourseProposal = {
    id: proposalId,
    institutionId,
    institutionName,
    applicationId: parsed.data.applicationId,
    region,
    type: parsed.data.type,
    status: 'DRAFT',
    branches,
    checkResults,
    createdAt: now,
    updatedAt: now,
  };

  await store.saveCourseProposal(proposal);

  return c.json({ proposal }, 201);
});

/**
 * GET /proposals
 * List proposals scoped by role and region.
 */
proposalsRouter.get('/', authMiddleware, async (c) => {
  const user = c.get('user');
  const statusParam = c.req.query('status') as ProposalStatus | undefined;

  let proposals: CourseProposal[] = [];

  if (user.role === 'CHIEF' || user.role === 'chief') {
    proposals = await store.listCourseProposals({ status: statusParam });
  } else if (user.role === 'OFFICER' || user.role === 'officer' || user.role === 'COMMITTEE' || user.role === 'committee') {
    if (user.region && user.region !== 'ALL') {
      proposals = await store.listCourseProposals({ region: user.region, status: statusParam });
    } else {
      proposals = await store.listCourseProposals({ status: statusParam });
    }
  } else {
    // Institution
    const instId = user.institutionName || user.id;
    proposals = await store.listCourseProposals({ institutionId: instId, status: statusParam });
  }

  // Refresh dynamic check indicators for each proposal
  const enriched = await Promise.all(
    proposals.map(async (prop) => {
      const checkContext = await getCheckContext(prop.institutionId, prop.applicationId, prop.type);
      prop.checkResults = checkCourseProposal(prop.branches, checkContext);
      return prop;
    })
  );

  return c.json({ proposals: enriched }, 200);
});

/**
 * GET /proposals/:id
 * Retrieve a single proposal with live normative check results.
 */
proposalsRouter.get('/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const proposal = await store.getCourseProposal(id);
  if (!proposal) {
    return c.json({ error: 'Proposal not found' }, 404);
  }

  if (!canAccessProposal(user, proposal)) {
    return c.json({ error: 'Access denied: Proposal is outside your authorized scope.' }, 403);
  }

  // Re-run live checks using current profile & document records
  const checkContext = await getCheckContext(proposal.institutionId, proposal.applicationId, proposal.type);
  proposal.checkResults = checkCourseProposal(proposal.branches, checkContext);

  return c.json({ proposal }, 200);
});

/**
 * PATCH /proposals/:id
 * Edit an existing draft proposal.
 */
proposalsRouter.patch('/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const proposal = await store.getCourseProposal(id);
  if (!proposal) {
    return c.json({ error: 'Proposal not found' }, 404);
  }

  if (!canAccessProposal(user, proposal)) {
    return c.json({ error: 'Access denied: You cannot edit this proposal.' }, 403);
  }

  if (proposal.status !== 'DRAFT') {
    return c.json({ error: 'Cannot modify a proposal that has already been submitted or reviewed.' }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = updateProposalSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.format() }, 400);
  }

  if (parsed.data.type) {
    proposal.type = parsed.data.type;
  }
  if (parsed.data.applicationId) {
    proposal.applicationId = parsed.data.applicationId;
  }
  if (parsed.data.branches) {
    proposal.branches = parsed.data.branches.map((b, idx) => ({
      ...b,
      id: b.id || `BR-${proposal.id}-${idx + 1}`,
      proposalId: proposal.id,
    }));
  }

  proposal.updatedAt = new Date().toISOString();

  const checkContext = await getCheckContext(proposal.institutionId, proposal.applicationId, proposal.type);
  proposal.checkResults = checkCourseProposal(proposal.branches, checkContext);

  await store.saveCourseProposal(proposal);

  return c.json({ proposal }, 200);
});

/**
 * POST /proposals/:id/submit
 * Submit proposal. Checks NEVER auto-reject or block!
 * Ledger records IDs and SHA-256 hashes only.
 */
proposalsRouter.post('/:id/submit', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const proposal = await store.getCourseProposal(id);
  if (!proposal) {
    return c.json({ error: 'Proposal not found' }, 404);
  }

  if (!canAccessProposal(user, proposal)) {
    return c.json({ error: 'Access denied: You cannot submit this proposal.' }, 403);
  }

  if (proposal.status !== 'DRAFT') {
    return c.json({ error: `Proposal has already been ${proposal.status.toLowerCase()}.` }, 400);
  }

  const checkContext = await getCheckContext(proposal.institutionId, proposal.applicationId, proposal.type);
  const checkResults = checkCourseProposal(proposal.branches, checkContext);

  // SAFEGUARD RULE: Checks never auto-reject or block.
  // The proposal is marked SUBMITTED regardless of whether checkResults contain DEFICIENT.
  const now = new Date().toISOString();
  proposal.status = 'SUBMITTED';
  proposal.submittedAt = now;
  proposal.updatedAt = now;
  proposal.checkResults = checkResults;

  await store.saveCourseProposal(proposal);

  // LEDGER INVARIANT: Ledger gets IDs and hashes only (no raw PII or unhashed free text)
  const totalIntake = proposal.branches.reduce((acc, b) => acc + (b.expectedIntake || 0), 0);
  const branchesSha256 = sha256(JSON.stringify(proposal.branches));
  const checkResultsSha256 = sha256(JSON.stringify(checkResults));

  await store.recordLedger(
    proposal.applicationId || proposal.id,
    'COURSE_PROPOSAL_SUBMITTED',
    user.email,
    {
      proposalId: proposal.id,
      institutionId: proposal.institutionId,
      applicationId: proposal.applicationId,
      proposalType: proposal.type,
      branchCount: proposal.branches.length,
      totalIntake,
      branchesHash: branchesSha256,
      checkResultsHash: checkResultsSha256,
    }
  );

  return c.json({
    message: 'Course proposal submitted successfully. Automated checks serve as assistive indicators.',
    proposal,
  }, 200);
});

/**
 * POST /proposals/:id/determination
 * Officer determination: NO_CONCERN | ASK_CLARIFICATION | REFER.
 * Remarks are strictly mandatory.
 * Regional scoping enforced.
 * Ledger gets IDs and hashes only.
 */
proposalsRouter.post('/:id/determination', authMiddleware, requireRole(['OFFICER', 'CHIEF', 'officer', 'chief']), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const proposal = await store.getCourseProposal(id);
  if (!proposal) {
    return c.json({ error: 'Proposal not found' }, 404);
  }

  // Scoping check for regional officers
  if (user.role === 'OFFICER' || user.role === 'officer') {
    if (user.region && user.region !== 'ALL' && proposal.region !== 'ALL' && proposal.region !== user.region) {
      return c.json({
        error: `Access denied: Regional officer (${user.region}) cannot determine proposal from ${proposal.region} region.`,
      }, 403);
    }
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = determinationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Determination validation failed: remarks are mandatory.', details: parsed.error.format() }, 400);
  }

  const now = new Date().toISOString();
  proposal.status = 'REVIEWED';
  proposal.determination = {
    decision: parsed.data.decision,
    remarks: parsed.data.remarks.trim(),
    officerId: user.id,
    officerEmail: user.email,
    officerRegion: user.region,
    determinedAt: now,
  };
  proposal.updatedAt = now;

  await store.saveCourseProposal(proposal);

  // LEDGER INVARIANT: Ledger gets IDs and hashes only
  const remarksSha256 = sha256(parsed.data.remarks.trim());

  await store.recordLedger(
    proposal.applicationId || proposal.id,
    'COURSE_PROPOSAL_REVIEWED',
    user.email,
    {
      proposalId: proposal.id,
      applicationId: proposal.applicationId,
      decision: parsed.data.decision,
      remarksHash: remarksSha256,
      officerId: user.id,
    }
  );

  return c.json({
    message: 'Proposal determination recorded successfully.',
    proposal,
  }, 200);
});
