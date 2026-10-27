import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { app } from '../app.js';
import { store } from '../db/store.js';
import { signJwt } from '../services/auth.js';
import { checkProposedBranch, checkCourseProposal } from '../services/branchCheck.js';
import { ProposedBranch, UserRole, Region } from '../types.js';

describe('Proposed Courses & Intake Module', () => {
  let tokenInstA: string;
  let tokenInstB: string;
  let tokenOfficerWest: string;
  let tokenOfficerNorth: string;
  let tokenChief: string;

  beforeAll(async () => {
    tokenInstA = await signJwt({
      sub: 'USR-INST-A',
      role: 'INSTITUTION' as UserRole,
      name: 'College of Tech Alpha',
      email: 'alpha@college.edu',
      institutionName: 'College of Tech Alpha',
      region: 'WEST' as Region,
    });

    tokenInstB = await signJwt({
      sub: 'USR-INST-B',
      role: 'INSTITUTION' as UserRole,
      name: 'Beta Institute of Tech',
      email: 'beta@college.edu',
      institutionName: 'Beta Institute of Tech',
      region: 'NORTH' as Region,
    });

    tokenOfficerWest = await signJwt({
      sub: 'USR-OFF-WEST',
      role: 'OFFICER' as UserRole,
      name: 'Officer West',
      email: 'officer.west@aicte.gov.in',
      region: 'WEST' as Region,
    });

    tokenOfficerNorth = await signJwt({
      sub: 'USR-OFF-NORTH',
      role: 'OFFICER' as UserRole,
      name: 'Officer North',
      email: 'officer.north@aicte.gov.in',
      region: 'NORTH' as Region,
    });

    tokenChief = await signJwt({
      sub: 'USR-CHIEF',
      role: 'CHIEF' as UserRole,
      name: 'AICTE Chief',
      email: 'chief@aicte.gov.in',
      region: 'ALL' as Region,
    });
  });

  const validBranch: ProposedBranch = {
    id: 'BR-TEST-1',
    level: 'UG',
    program: 'ENGINEERING',
    course: 'Computer Science & Engineering',
    affiliatingBody: 'State Technical University',
    currentIntake: 60,
    expectedIntake: 120,
    shift: '1st Shift',
    facultySanctioned: 6,
    facultyAvailable: 6,
    facultyPayCompliant: true,
    labs: ['Lab 1', 'Lab 2', 'Lab 3', 'Lab 4'],
    builtUpArea: 450,
    libraryAvailable: true,
    affiliationNocAvailable: true,
  };

  // ---------------------------------------------------------------------------
  // 1. Pure Normative Checks (branchCheck.ts)
  // ---------------------------------------------------------------------------
  describe('Rule Checks (pure function)', () => {
    it('evaluates FACULTY_RATIO (MET when adequate, DEFICIENT when shortfall)', () => {
      // UG ratio norm is 1:20. For intake 120, requires ceil(120/20) = 6 faculty.
      const adequate = checkProposedBranch({ ...validBranch, expectedIntake: 120, facultyAvailable: 6 });
      const ratioMet = adequate.results.find((r) => r.rule === 'FACULTY_RATIO');
      expect(ratioMet?.status).toBe('MET');

      const deficient = checkProposedBranch({ ...validBranch, expectedIntake: 120, facultyAvailable: 4 });
      const ratioDef = deficient.results.find((r) => r.rule === 'FACULTY_RATIO');
      expect(ratioDef?.status).toBe('DEFICIENT');
      expect(ratioDef?.reason).toContain('Shortfall of 2 faculty');
    });

    it('evaluates FACULTY_PAY_COMPLIANCE (DEFICIENT when non-compliant, REVIEW when vacancies)', () => {
      // Non-compliant pay scale
      const nonCompliant = checkProposedBranch({ ...validBranch, facultyPayCompliant: false });
      const payDef = nonCompliant.results.find((r) => r.rule === 'FACULTY_PAY_COMPLIANCE');
      expect(payDef?.status).toBe('DEFICIENT');

      // Unfilled sanctioned posts
      const vacant = checkProposedBranch({ ...validBranch, facultyPayCompliant: true, facultySanctioned: 8, facultyAvailable: 6 });
      const payReview = vacant.results.find((r) => r.rule === 'FACULTY_PAY_COMPLIANCE');
      expect(payReview?.status).toBe('REVIEW');

      // Fully compliant
      const compliant = checkProposedBranch({ ...validBranch, facultyPayCompliant: true, facultySanctioned: 6, facultyAvailable: 6 });
      const payMet = compliant.results.find((r) => r.rule === 'FACULTY_PAY_COMPLIANCE');
      expect(payMet?.status).toBe('MET');
    });

    it('evaluates LAND_SUFFICIENCY across total proposed intake', () => {
      // Intake 120 * 5 sqm = 600 sqm required
      const sufficient = checkProposedBranch(validBranch, {
        institutionLandAreaSqm: 1000,
        totalProposalIntake: 120,
      });
      const landMet = sufficient.results.find((r) => r.rule === 'LAND_SUFFICIENCY');
      expect(landMet?.status).toBe('MET');

      const deficient = checkProposedBranch(validBranch, {
        institutionLandAreaSqm: 400,
        totalProposalIntake: 120,
      });
      const landDef = deficient.results.find((r) => r.rule === 'LAND_SUFFICIENCY');
      expect(landDef?.status).toBe('DEFICIENT');
      expect(landDef?.reason).toContain('Land deficit');

      const unrecorded = checkProposedBranch(validBranch, {
        institutionLandAreaSqm: 0,
        totalProposalIntake: 120,
      });
      const landReview = unrecorded.results.find((r) => r.rule === 'LAND_SUFFICIENCY');
      expect(landReview?.status).toBe('REVIEW');
    });

    it('evaluates LABS_INFRASTRUCTURE (labs count, built-up area, library)', () => {
      // Missing library
      const noLib = checkProposedBranch({ ...validBranch, libraryAvailable: false });
      expect(noLib.results.find((r) => r.rule === 'LABS_INFRASTRUCTURE')?.status).toBe('DEFICIENT');

      // Less than 4 labs
      const fewLabs = checkProposedBranch({ ...validBranch, labs: ['Lab 1', 'Lab 2'] });
      expect(fewLabs.results.find((r) => r.rule === 'LABS_INFRASTRUCTURE')?.status).toBe('DEFICIENT');

      // Area below 400 sqm
      const smallArea = checkProposedBranch({ ...validBranch, builtUpArea: 250 });
      expect(smallArea.results.find((r) => r.rule === 'LABS_INFRASTRUCTURE')?.status).toBe('DEFICIENT');

      // All satisfied
      const allGood = checkProposedBranch(validBranch);
      expect(allGood.results.find((r) => r.rule === 'LABS_INFRASTRUCTURE')?.status).toBe('MET');
    });

    it('evaluates AFFILIATION_NOC', () => {
      // Missing affiliating body
      const noBody = checkProposedBranch({ ...validBranch, affiliatingBody: '' });
      expect(noBody.results.find((r) => r.rule === 'AFFILIATION_NOC')?.status).toBe('DEFICIENT');

      // Missing NOC
      const noNoc = checkProposedBranch({ ...validBranch, affiliationNocAvailable: false });
      expect(noNoc.results.find((r) => r.rule === 'AFFILIATION_NOC')?.status).toBe('DEFICIENT');

      // Valid NOC
      const withNoc = checkProposedBranch({ ...validBranch, affiliationNocAvailable: true });
      expect(withNoc.results.find((r) => r.rule === 'AFFILIATION_NOC')?.status).toBe('MET');
    });

    it('evaluates INTAKE_LIMIT (standard divisions and increase limits)', () => {
      // Standard division (60, 120, 180, etc.)
      const standard = checkProposedBranch({ ...validBranch, expectedIntake: 120 });
      expect(standard.results.find((r) => r.rule === 'INTAKE_LIMIT')?.status).toBe('MET');

      // Non-standard division (e.g. 75)
      const nonStandard = checkProposedBranch({ ...validBranch, expectedIntake: 75 });
      expect(nonStandard.results.find((r) => r.rule === 'INTAKE_LIMIT')?.status).toBe('REVIEW');

      // Excessive increase (>60 in one year)
      const excessive = checkProposedBranch(
        { ...validBranch, currentIntake: 60, expectedIntake: 180 },
        { proposalType: 'INTAKE_INCREASE' }
      );
      expect(excessive.results.find((r) => r.rule === 'INTAKE_LIMIT')?.status).toBe('DEFICIENT');
    });

    it('evaluates DOCUMENT_VALIDITY using existing expiry monitor', () => {
      // Overdue document
      const overdueRes = checkProposedBranch(validBranch, {
        complianceDocuments: [
          {
            id: 'DOC-1',
            applicationId: 'APP-1',
            docType: 'FIRE_NOC',
            expiryDate: '2020-01-01',
            daysRemaining: -100,
            state: 'OVERDUE',
          },
        ],
      });
      expect(overdueRes.results.find((r) => r.rule === 'DOCUMENT_VALIDITY')?.status).toBe('DEFICIENT');

      // Valid future document
      const validFuture = checkProposedBranch(validBranch, {
        complianceDocuments: [
          {
            id: 'DOC-2',
            applicationId: 'APP-1',
            docType: 'FIRE_NOC',
            expiryDate: '2030-01-01',
            daysRemaining: 1500,
            state: 'VALID',
          },
        ],
      });
      expect(validFuture.results.find((r) => r.rule === 'DOCUMENT_VALIDITY')?.status).toBe('MET');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Proposal Routes, Draft Creation, Editing & Scoping
  // ---------------------------------------------------------------------------
  describe('Proposal Endpoints & Scoping', () => {
    let createdProposalId: string;

    it('creates a draft proposal and returns dynamic check indicators', async () => {
      const res = await app.request('/proposals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenInstA}`,
        },
        body: JSON.stringify({
          applicationId: 'APP-2024-TEST-001',
          type: 'NEW_COURSE',
          branches: [validBranch],
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.proposal.id).toBeDefined();
      expect(data.proposal.status).toBe('DRAFT');
      expect(data.proposal.institutionId).toBe('College of Tech Alpha');
      expect(data.proposal.checkResults).toBeDefined();
      expect(data.proposal.checkResults.length).toBe(1);

      createdProposalId = data.proposal.id;
    });

    it('allows editing draft proposals via PATCH', async () => {
      const res = await app.request(`/proposals/${createdProposalId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenInstA}`,
        },
        body: JSON.stringify({
          type: 'INTAKE_INCREASE',
          branches: [{ ...validBranch, expectedIntake: 180, facultyAvailable: 9, facultySanctioned: 9 }],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.proposal.type).toBe('INTAKE_INCREASE');
      expect(data.proposal.branches[0].expectedIntake).toBe(180);
    });

    it('scopes GET /proposals by role and region', async () => {
      // Create a second proposal by institution Beta (NORTH)
      await app.request('/proposals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenInstB}`,
        },
        body: JSON.stringify({
          applicationId: 'APP-BETA-001',
          type: 'NEW_INSTITUTION',
          branches: [validBranch],
        }),
      });

      // Inst A should only see College of Tech Alpha's proposal
      const resInstA = await app.request('/proposals', {
        headers: { Authorization: `Bearer ${tokenInstA}` },
      });
      const dataA = await resInstA.json();
      expect(dataA.proposals.every((p: any) => p.institutionId === 'College of Tech Alpha')).toBe(true);

      // Officer North should only see proposals in NORTH region
      const resOffNorth = await app.request('/proposals', {
        headers: { Authorization: `Bearer ${tokenOfficerNorth}` },
      });
      const dataNorth = await resOffNorth.json();
      expect(dataNorth.proposals.some((p: any) => p.institutionId === 'Beta Institute of Tech')).toBe(true);
      expect(dataNorth.proposals.some((p: any) => p.institutionId === 'College of Tech Alpha')).toBe(false);

      // Chief sees all proposals
      const resChief = await app.request('/proposals', {
        headers: { Authorization: `Bearer ${tokenChief}` },
      });
      const dataChief = await resChief.json();
      expect(dataChief.proposals.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Non-Blocking Submission & Ledger Verification
  // ---------------------------------------------------------------------------
  describe('Non-blocking Submission & Ledger', () => {
    it('submits proposal even if check results are DEFICIENT and writes IDs/hashes to ledger', async () => {
      // Create a proposal with deliberate deficiencies
      const deficientBranch: ProposedBranch = {
        ...validBranch,
        facultyAvailable: 1, // Shortfall against 120 intake
        facultyPayCompliant: false, // Pay scale deficient
        labs: [], // No labs
        libraryAvailable: false,
        affiliationNocAvailable: false,
      };

      const createRes = await app.request('/proposals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenInstA}`,
        },
        body: JSON.stringify({
          applicationId: 'APP-SUBMIT-DEFICIENT',
          type: 'NEW_COURSE',
          branches: [deficientBranch],
        }),
      });
      const { proposal } = await createRes.json();
      expect(proposal.checkResults[0].overallStatus).toBe('DEFICIENT');

      // Submitting the proposal must NOT be blocked or auto-rejected!
      const submitRes = await app.request(`/proposals/${proposal.id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenInstA}` },
      });

      expect(submitRes.status).toBe(200);
      const submitData = await submitRes.json();
      expect(submitData.proposal.status).toBe('SUBMITTED');

      // Verify ledger entry: contains IDs and SHA-256 hashes only!
      const ledgerEntries = await store.getLedger('APP-SUBMIT-DEFICIENT');
      const submitEntry = ledgerEntries.find((e) => e.eventType === 'COURSE_PROPOSAL_SUBMITTED');
      expect(submitEntry).toBeDefined();
      expect(submitEntry?.payload.proposalId).toBe(proposal.id);
      expect(submitEntry?.payload.branchesHash).toBeDefined();
      expect(submitEntry?.payload.checkResultsHash).toBeDefined();
      // Ensure no raw PII in payload
      expect(submitEntry?.payload.facultyNames).toBeUndefined();
    });

    it('rejects editing once a proposal has been submitted', async () => {
      // Create and submit
      const createRes = await app.request('/proposals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenInstA}`,
        },
        body: JSON.stringify({
          applicationId: 'APP-NO-EDIT',
          type: 'EOA',
          branches: [validBranch],
        }),
      });
      const { proposal } = await createRes.json();

      await app.request(`/proposals/${proposal.id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenInstA}` },
      });

      // Attempt patch on submitted proposal
      const patchRes = await app.request(`/proposals/${proposal.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenInstA}`,
        },
        body: JSON.stringify({ type: 'CLOSURE' }),
      });

      expect(patchRes.status).toBe(400);
      const patchData = await patchRes.json();
      expect(patchData.error).toContain('Cannot modify a proposal that has already been submitted');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Officer Determination & Mandatory Remarks
  // ---------------------------------------------------------------------------
  describe('Officer Determination & Safeguards', () => {
    let submittedProposalId: string;

    beforeEach(async () => {
      const createRes = await app.request('/proposals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenInstA}`,
        },
        body: JSON.stringify({
          applicationId: 'APP-DETERMINATION-TEST',
          type: 'NEW_COURSE',
          branches: [validBranch],
        }),
      });
      const { proposal } = await createRes.json();
      await app.request(`/proposals/${proposal.id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenInstA}` },
      });
      submittedProposalId = proposal.id;
    });

    it('rejects determination without remarks or with whitespace remarks', async () => {
      // Missing remarks
      const resNoRemarks = await app.request(`/proposals/${submittedProposalId}/determination`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenOfficerWest}`,
        },
        body: JSON.stringify({
          decision: 'NO_CONCERN',
          remarks: '',
        }),
      });
      expect(resNoRemarks.status).toBe(400);
      const dataNoRemarks = await resNoRemarks.json();
      expect(dataNoRemarks.error).toContain('remarks are mandatory');

      // Whitespace only
      const resWhitespace = await app.request(`/proposals/${submittedProposalId}/determination`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenOfficerWest}`,
        },
        body: JSON.stringify({
          decision: 'ASK_CLARIFICATION',
          remarks: '   \n  \t ',
        }),
      });
      expect(resWhitespace.status).toBe(400);
    });

    it('enforces regional scoping on officer determination', async () => {
      // Inst A is in WEST. Officer North should be rejected with 403.
      const resWrongRegion = await app.request(`/proposals/${submittedProposalId}/determination`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenOfficerNorth}`,
        },
        body: JSON.stringify({
          decision: 'NO_CONCERN',
          remarks: 'Approved by regional desk.',
        }),
      });
      expect(resWrongRegion.status).toBe(403);
      const dataWrong = await resWrongRegion.json();
      expect(dataWrong.error).toContain('cannot determine proposal from WEST region');
    });

    it('records valid determination and logs SHA-256 hash to ledger', async () => {
      const res = await app.request(`/proposals/${submittedProposalId}/determination`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenOfficerWest}`,
        },
        body: JSON.stringify({
          decision: 'NO_CONCERN',
          remarks: 'All departmental labs and cadre ratios verified against state university NOC.',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.proposal.status).toBe('REVIEWED');
      expect(data.proposal.determination.decision).toBe('NO_CONCERN');
      expect(data.proposal.determination.remarks).toBe(
        'All departmental labs and cadre ratios verified against state university NOC.'
      );

      // Verify ledger entry has remarksHash
      const ledgerEntries = await store.getLedger('APP-DETERMINATION-TEST');
      const reviewEntry = ledgerEntries.find((e) => e.eventType === 'COURSE_PROPOSAL_REVIEWED');
      expect(reviewEntry).toBeDefined();
      expect(reviewEntry?.payload.decision).toBe('NO_CONCERN');
      expect(reviewEntry?.payload.remarksHash).toBeDefined();
      expect(typeof reviewEntry?.payload.remarksHash).toBe('string');
      expect((reviewEntry?.payload.remarksHash as string).length).toBe(64);
    });
  });
});
