/**
 * Branch & Course Proposal Check Service
 *
 * PURE FUNCTIONS for evaluating proposed courses and intake against normative thresholds.
 *
 * SAFEGUARD PRINCIPLE:
 * These automated checks serve strictly as assistive indicators for officers.
 * They NEVER auto-reject or block application submission.
 * Official figures are placeholder pending APH.
 */

import {
  ProposedBranch,
  BranchRuleResult,
  BranchCheckSummary,
  BranchCheckRule,
  ComplianceDocument,
} from '../types.js';
import { COURSE_NORMS, getFacultyRatioNorm } from '../config/courseNorms.js';
import { computeExpiryState } from './expiry.js';

export interface BranchCheckContext {
  institutionLandAreaSqm?: number;
  totalProposalIntake?: number;
  complianceDocuments?: ComplianceDocument[];
  nocExpiryDate?: string;
  proposalType?: string;
}

/**
 * Evaluates a single proposed branch against AICTE normative checks.
 * Pure function: deterministic, no side-effects, no I/O.
 */
export function checkProposedBranch(
  branch: ProposedBranch,
  context: BranchCheckContext = {}
): BranchCheckSummary {
  const results: BranchRuleResult[] = [];

  // -------------------------------------------------------------------------
  // 1. FACULTY_RATIO
  // -------------------------------------------------------------------------
  const ratioNorm = getFacultyRatioNorm(branch.level, branch.program);
  const intake = branch.expectedIntake || 0;
  const requiredFaculty = Math.max(1, Math.ceil(intake / ratioNorm));
  const availableFaculty = branch.facultyAvailable || 0;
  const computedRatio = availableFaculty > 0 ? (intake / availableFaculty).toFixed(1) : 'N/A';

  if (availableFaculty >= requiredFaculty) {
    results.push({
      rule: 'FACULTY_RATIO',
      status: 'MET',
      computed: `1:${computedRatio} (${availableFaculty} faculty)`,
      required: `1:${ratioNorm} (${requiredFaculty} faculty required)`,
      reason: `Faculty count meets the normative 1:${ratioNorm} requirement (placeholder pending APH).`,
    });
  } else {
    results.push({
      rule: 'FACULTY_RATIO',
      status: 'DEFICIENT',
      computed: `1:${computedRatio} (${availableFaculty} faculty)`,
      required: `1:${ratioNorm} (${requiredFaculty} faculty required)`,
      reason: `Shortfall of ${requiredFaculty - availableFaculty} faculty members against 1:${ratioNorm} ratio (placeholder pending APH).`,
    });
  }

  // -------------------------------------------------------------------------
  // 2. FACULTY_PAY_COMPLIANCE (deficiency flag)
  // -------------------------------------------------------------------------
  const sanctioned = branch.facultySanctioned || 0;
  if (!branch.facultyPayCompliant) {
    results.push({
      rule: 'FACULTY_PAY_COMPLIANCE',
      status: 'DEFICIENT',
      computed: `Pay non-compliant; ${availableFaculty}/${sanctioned} sanctioned filled`,
      required: '100% 7th CPC / State scale compliance and sanctioned positions filled',
      reason: 'Faculty pay scale non-compliance reported or salary disbursement deficient (placeholder pending APH).',
    });
  } else if (availableFaculty < sanctioned) {
    results.push({
      rule: 'FACULTY_PAY_COMPLIANCE',
      status: 'REVIEW',
      computed: `${availableFaculty}/${sanctioned} sanctioned positions filled`,
      required: `${sanctioned} sanctioned positions`,
      reason: `${sanctioned - availableFaculty} sanctioned positions vacant; verification of ongoing recruitment required.`,
    });
  } else {
    results.push({
      rule: 'FACULTY_PAY_COMPLIANCE',
      status: 'MET',
      computed: `Compliant (${availableFaculty}/${sanctioned} filled)`,
      required: 'Scale compliant and sanctioned filled',
      reason: 'Faculty pay scale is compliant and sanctioned positions are fully staffed.',
    });
  }

  // -------------------------------------------------------------------------
  // 3. LAND_SUFFICIENCY (across total intake, reusing profile land data)
  // -------------------------------------------------------------------------
  const totalIntake = context.totalProposalIntake || branch.expectedIntake || 0;
  const requiredLand = totalIntake * COURSE_NORMS.minLandPerIntakeSqm;
  const availableLand = context.institutionLandAreaSqm || 0;

  if (availableLand <= 0) {
    results.push({
      rule: 'LAND_SUFFICIENCY',
      status: 'REVIEW',
      computed: '0 sqm recorded',
      required: `${requiredLand} sqm minimum (${COURSE_NORMS.minLandPerIntakeSqm} sqm/intake)`,
      reason: 'Institution land area not recorded in profile; officer review required to confirm title deed sufficiency.',
    });
  } else if (availableLand >= requiredLand) {
    results.push({
      rule: 'LAND_SUFFICIENCY',
      status: 'MET',
      computed: `${availableLand.toLocaleString()} sqm available`,
      required: `${requiredLand.toLocaleString()} sqm (${COURSE_NORMS.minLandPerIntakeSqm} sqm/student for ${totalIntake} total intake)`,
      reason: 'Campus land area satisfies total proposed intake norms (placeholder pending APH).',
    });
  } else {
    results.push({
      rule: 'LAND_SUFFICIENCY',
      status: 'DEFICIENT',
      computed: `${availableLand.toLocaleString()} sqm available`,
      required: `${requiredLand.toLocaleString()} sqm minimum`,
      reason: `Land deficit of ${(requiredLand - availableLand).toLocaleString()} sqm for total intake of ${totalIntake} students (placeholder pending APH).`,
    });
  }

  // -------------------------------------------------------------------------
  // 4. LABS_INFRASTRUCTURE (labs count, built-up area, library)
  // -------------------------------------------------------------------------
  const labsCount = Array.isArray(branch.labs) ? branch.labs.length : 0;
  const builtUp = branch.builtUpArea || 0;
  const lib = Boolean(branch.libraryAvailable);

  const labDeficient = labsCount < COURSE_NORMS.minLabsPerBranch;
  const areaDeficient = builtUp < COURSE_NORMS.minBuiltUpAreaSqm;
  const libDeficient = !lib;

  if (labDeficient || areaDeficient || libDeficient) {
    const reasons: string[] = [];
    if (labDeficient) reasons.push(`Labs: ${labsCount} < ${COURSE_NORMS.minLabsPerBranch} required`);
    if (areaDeficient) reasons.push(`Built-up area: ${builtUp} sqm < ${COURSE_NORMS.minBuiltUpAreaSqm} sqm required`);
    if (libDeficient) reasons.push('Departmental library access missing');

    results.push({
      rule: 'LABS_INFRASTRUCTURE',
      status: 'DEFICIENT',
      computed: `${labsCount} labs, ${builtUp} sqm, library: ${lib ? 'Yes' : 'No'}`,
      required: `${COURSE_NORMS.minLabsPerBranch} labs, ${COURSE_NORMS.minBuiltUpAreaSqm} sqm built-up area, active library`,
      reason: `Infrastructure shortfall: ${reasons.join('; ')} (placeholder pending APH).`,
    });
  } else {
    results.push({
      rule: 'LABS_INFRASTRUCTURE',
      status: 'MET',
      computed: `${labsCount} labs, ${builtUp} sqm, library available`,
      required: `${COURSE_NORMS.minLabsPerBranch} labs, ${COURSE_NORMS.minBuiltUpAreaSqm} sqm, library`,
      reason: 'Instructional laboratories, built-up area, and library facilities meet branch requirements.',
    });
  }

  // -------------------------------------------------------------------------
  // 5. AFFILIATION_NOC
  // -------------------------------------------------------------------------
  const body = (branch.affiliatingBody || '').trim();
  const nocDeclared = Boolean(branch.affiliationNocAvailable || branch.affiliationNocDocId);

  if (!body) {
    results.push({
      rule: 'AFFILIATION_NOC',
      status: 'DEFICIENT',
      computed: 'No affiliating body declared',
      required: 'State University / Board of Technical Education NOC',
      reason: 'Affiliating university or state technical board is mandatory for proposed course.',
    });
  } else if (nocDeclared) {
    results.push({
      rule: 'AFFILIATION_NOC',
      status: 'MET',
      computed: `NOC available for ${body}`,
      required: `Affiliation NOC from ${body}`,
      reason: 'Affiliating university/board NOC declared.',
    });
  } else {
    results.push({
      rule: 'AFFILIATION_NOC',
      status: 'DEFICIENT',
      computed: 'NOC missing',
      required: `NOC certificate from ${body}`,
      reason: `Mandatory NOC from ${body} not provided for proposed branch.`,
    });
  }

  // -------------------------------------------------------------------------
  // 6. INTAKE_LIMIT (allowed step increments)
  // -------------------------------------------------------------------------
  const expected = branch.expectedIntake || 0;
  const current = branch.currentIntake || 0;
  const isAllowedStep = COURSE_NORMS.allowedIntakeSteps.includes(expected);
  const increase = expected - current;

  if (expected <= 0) {
    results.push({
      rule: 'INTAKE_LIMIT',
      status: 'DEFICIENT',
      computed: `${expected} seats`,
      required: `Valid positive intake from [${COURSE_NORMS.allowedIntakeSteps.join(', ')}]`,
      reason: 'Expected intake must be greater than zero.',
    });
  } else if (!isAllowedStep) {
    results.push({
      rule: 'INTAKE_LIMIT',
      status: 'REVIEW',
      computed: `${expected} seats`,
      required: `Standard division steps: ${COURSE_NORMS.allowedIntakeSteps.join(', ')}`,
      reason: `Intake (${expected}) does not align with standard AICTE division increments (${COURSE_NORMS.allowedIntakeSteps.join(', ')}). Officer review required.`,
    });
  } else if (context.proposalType === 'INTAKE_INCREASE' && increase > COURSE_NORMS.maxIntakeIncreaseStep) {
    results.push({
      rule: 'INTAKE_LIMIT',
      status: 'DEFICIENT',
      computed: `+${increase} seat increase (from ${current} to ${expected})`,
      required: `Maximum +${COURSE_NORMS.maxIntakeIncreaseStep} seats per academic year`,
      reason: `Intake increase of ${increase} exceeds single-year ceiling of ${COURSE_NORMS.maxIntakeIncreaseStep} seats.`,
    });
  } else {
    results.push({
      rule: 'INTAKE_LIMIT',
      status: 'MET',
      computed: `${expected} seats (division step)`,
      required: 'Standard batch step increment',
      reason: 'Proposed intake matches approved batch increments and step limits.',
    });
  }

  // -------------------------------------------------------------------------
  // 7. DOCUMENT_VALIDITY (reuse existing expiry monitor)
  // -------------------------------------------------------------------------
  // Check any NOC expiry or compliance docs passed in context
  const docsToCheck = [...(context.complianceDocuments || [])];
  if (context.nocExpiryDate) {
    docsToCheck.push({
      id: 'NOC-DOC',
      applicationId: '',
      docType: 'AFFILIATION_NOC',
      expiryDate: context.nocExpiryDate,
      daysRemaining: 0,
      state: 'VALID',
    });
  }

  if (docsToCheck.length === 0) {
    // If no document expiry information was provided, mark REVIEW
    results.push({
      rule: 'DOCUMENT_VALIDITY',
      status: 'REVIEW',
      computed: 'No expiry-tracked certificates linked',
      required: 'Active affiliation/compliance documents',
      reason: 'No expiry-tracked compliance certificates attached; officer review required.',
    });
  } else {
    const expiredList: string[] = [];
    const warningList: string[] = [];

    for (const doc of docsToCheck) {
      if (doc.expiryDate) {
        const res = computeExpiryState(doc.expiryDate);
        if (res.state === 'OVERDUE') {
          expiredList.push(doc.docType || doc.id);
        } else if (res.state === 'WARNING') {
          warningList.push(`${doc.docType || doc.id} (${res.daysRemaining}d left)`);
        }
      }
    }

    if (expiredList.length > 0) {
      results.push({
        rule: 'DOCUMENT_VALIDITY',
        status: 'DEFICIENT',
        computed: `Expired: ${expiredList.join(', ')}`,
        required: 'All certificates within valid validity period',
        reason: `Mandatory documents are expired: ${expiredList.join(', ')}.`,
      });
    } else if (warningList.length > 0) {
      results.push({
        rule: 'DOCUMENT_VALIDITY',
        status: 'REVIEW',
        computed: `Expiring soon: ${warningList.join(', ')}`,
        required: 'Validity renewal in progress',
        reason: `Certificates approaching expiry: ${warningList.join(', ')}.`,
      });
    } else {
      results.push({
        rule: 'DOCUMENT_VALIDITY',
        status: 'MET',
        computed: `${docsToCheck.length} documents verified active`,
        required: 'Valid compliance documents',
        reason: 'All attached compliance certificates and NOCs are active and within validity period.',
      });
    }
  }

  // Determine overall status for this branch
  let overallStatus: 'MET' | 'DEFICIENT' | 'REVIEW' = 'MET';
  if (results.some((r) => r.status === 'DEFICIENT')) {
    overallStatus = 'DEFICIENT';
  } else if (results.some((r) => r.status === 'REVIEW')) {
    overallStatus = 'REVIEW';
  }

  return {
    branchId: branch.id,
    course: branch.course,
    level: branch.level,
    overallStatus,
    results,
  };
}

/**
 * Runs normative checks on all branches of a course proposal.
 */
export function checkCourseProposal(
  branches: ProposedBranch[],
  context: BranchCheckContext = {}
): BranchCheckSummary[] {
  // Compute total proposed intake across all branches
  const totalProposalIntake = branches.reduce((sum, b) => sum + (b.expectedIntake || 0), 0);
  const enrichedContext: BranchCheckContext = {
    ...context,
    totalProposalIntake,
  };

  return branches.map((branch) => checkProposedBranch(branch, enrichedContext));
}
