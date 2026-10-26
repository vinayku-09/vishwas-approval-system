/**
 * routes.ts - Configurable approval routes, stage order and return policy.
 *
 * Every route, stage order, automatic transition and return target in the
 * routing workflow lives here so policy can change without editing route
 * handlers. All values are placeholders pending the AICTE Approval Process
 * Handbook (APH) and are not official AICTE rules.
 *
 * The four PS route ids are the canonical source for stage order. Future
 * stage-SLA configuration must import these route stage lists instead of
 * duplicating stage names.
 */

import type {
  ApprovalRouteId,
  ApplicationType,
  ReturnCategory,
  ReturnCategoryOption,
  Status,
} from '../types.js';

export interface ApprovalRouteDefinition {
  id: ApprovalRouteId;
  name: string;
  description: string;
  applicationTypes: ApplicationType[];
  stages: Status[];
  /** Whether the route normally requires a physical EVC inspection. */
  requiresEvc: boolean;
  /**
   * The stage used when a terminal application has no matching stage in the
   * ordered route list (for example APPROVED or REJECTED).
   */
  decisionStage: Status;
}

export const APPROVAL_ROUTES: Record<ApprovalRouteId, ApprovalRouteDefinition> = {
  ONLY_SCRUTINY: {
    id: 'ONLY_SCRUTINY',
    name: 'Only Scrutiny',
    description:
      'Placeholder PS route for applications resolved by scrutiny and a competent-authority decision, without an EVC inspection stage.',
    applicationTypes: ['EXTENSION_OF_APPROVAL'],
    stages: ['SUBMITTED', 'SCRUTINY', 'DECISION'],
    requiresEvc: false,
    decisionStage: 'DECISION',
  },
  SCRUTINY_EVC: {
    id: 'SCRUTINY_EVC',
    name: 'Scrutiny + EVC',
    description:
      'Placeholder PS route for fresh applications: scrutiny, EVC inspection, then competent-authority decision.',
    applicationTypes: ['NEW'],
    stages: ['SUBMITTED', 'SCRUTINY', 'EVC_REQUIRED', 'EVC_DONE', 'DECISION'],
    requiresEvc: true,
    decisionStage: 'DECISION',
  },
  EVC_SAC_SHC: {
    id: 'EVC_SAC_SHC',
    name: 'EVC + SAC/SHC',
    description:
      'Placeholder PS route for appeal applications and EVC-backed cases that reach the Standing Hearing Committee and Standing Appellate Committee. The existing state machine order is SHC then SAC even though the PS short name lists SAC/SHC.',
    applicationTypes: ['APPEAL'],
    stages: [
      'SUBMITTED',
      'SCRUTINY',
      'EVC_REQUIRED',
      'EVC_DONE',
      'DECISION',
      'APPEAL_SHC',
      'APPEAL_SAC',
    ],
    requiresEvc: true,
    decisionStage: 'DECISION',
  },
  ONLY_EVC: {
    id: 'ONLY_EVC',
    name: 'Only EVC',
    description:
      'Placeholder PS route for intake changes resolved by EVC inspection and a competent-authority decision, without a separate scrutiny stage.',
    applicationTypes: ['INTAKE_CHANGE'],
    stages: ['SUBMITTED', 'EVC_REQUIRED', 'EVC_DONE', 'DECISION'],
    requiresEvc: true,
    decisionStage: 'DECISION',
  },
};

/**
 * Application-type mapping. APPEAL makes EVC_SAC_SHC selectable from
 * submission; rejected/appeal statuses also select it through the override.
 */
export const TYPE_ROUTE_MAP: Record<ApplicationType, ApprovalRouteId> = {
  NEW: 'SCRUTINY_EVC',
  EXTENSION_OF_APPROVAL: 'ONLY_SCRUTINY',
  INTAKE_CHANGE: 'ONLY_EVC',
  APPEAL: 'EVC_SAC_SHC',
};

/**
 * Status-based route overrides. A rejected case enters the appeal route so its
 * SAC/SHC stages are visible before the first hearing-stage transition.
 */
export const STATUS_ROUTE_MAP: Partial<Record<Status, ApprovalRouteId>> = {
  REJECTED: 'EVC_SAC_SHC',
  APPEAL_SHC: 'EVC_SAC_SHC',
  APPEAL_SAC: 'EVC_SAC_SHC',
};

/**
 * Return/revert targets are deliberately explicit rather than "any earlier
 * stage". A return always requires a category and a recorded reason.
 * Placeholder pending APH.
 */
export const RETURN_TARGETS: Partial<Record<Status, Status[]>> = {
  SCRUTINY: ['SUBMITTED', 'DEFICIENT'],
  DEFICIENT: ['SCRUTINY'],
  EVC_REQUIRED: ['SCRUTINY', 'DEFICIENT'],
  EVC_DONE: ['EVC_REQUIRED', 'SCRUTINY', 'DEFICIENT'],
  DECISION: ['EVC_DONE', 'EVC_REQUIRED', 'SCRUTINY', 'DEFICIENT'],
};

export const RETURN_CATEGORY_IDS = [
  'DEFICIENCY',
  'DOCUMENT_MISSING',
  'CLARIFICATION',
  'COMPLIANCE',
  'OTHER',
] as const;

export const RETURN_CATEGORIES: ReturnCategoryOption[] = [
  {
    id: 'DEFICIENCY',
    label: 'Deficiency',
    description: 'Norms or evidence do not satisfy the configured scrutiny rules.',
  },
  {
    id: 'DOCUMENT_MISSING',
    label: 'Document missing',
    description: 'A required statutory document or page is absent.',
  },
  {
    id: 'CLARIFICATION',
    label: 'Clarification required',
    description: 'The institution must explain or reconcile submitted information.',
  },
  {
    id: 'COMPLIANCE',
    label: 'Compliance issue',
    description: 'A monitored compliance document or undertaking needs action.',
  },
  {
    id: 'OTHER',
    label: 'Other recorded reason',
    description: 'A reason outside the standard categories; the note is mandatory.',
  },
];

export const RETURN_CATEGORY_MAP: Record<ReturnCategory, ReturnCategoryOption> =
  Object.fromEntries(RETURN_CATEGORIES.map((category) => [category.id, category])) as Record<
    ReturnCategory,
    ReturnCategoryOption
  >;

export const SAFEGUARD_NOTICE =
  'Automated checks assist the competent authority; they do not decide the case. Every rejection, return, override or closure requires a human sign-off with a recorded reason and is written to the audit ledger.';
