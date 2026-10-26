/**
 * routes.ts — Configurable approval routes, stage order and return policy.
 *
 * Every route, stage order, automatic transition and return target in the
 * Part 2 workflow lives here so policy can change without editing route
 * handlers. All values are placeholders pending the AICTE Approval Process
 * Handbook (APH) and are not official AICTE rules.
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
  /** The stage from which a final approve/reject decision is recorded. */
  decisionStage: Status;
}

export const APPROVAL_ROUTES: Record<ApprovalRouteId, ApprovalRouteDefinition> = {
  NEW_APPROVAL: {
    id: 'NEW_APPROVAL',
    name: 'New Institution Approval',
    description:
      'Placeholder route for fresh applications: scrutiny, EVC inspection, then competent-authority decision.',
    applicationTypes: ['NEW'],
    stages: ['SUBMITTED', 'SCRUTINY', 'EVC_REQUIRED', 'EVC_DONE', 'DECISION'],
    requiresEvc: true,
    decisionStage: 'DECISION',
  },
  EXTENSION_OF_APPROVAL: {
    id: 'EXTENSION_OF_APPROVAL',
    name: 'Extension of Approval',
    description:
      'Placeholder route for extension applications: scrutiny, optional inspection based on officer selection, then decision.',
    applicationTypes: ['EXTENSION_OF_APPROVAL'],
    stages: ['SUBMITTED', 'SCRUTINY', 'EVC_REQUIRED', 'EVC_DONE', 'DECISION'],
    requiresEvc: false,
    decisionStage: 'DECISION',
  },
  INTAKE_CHANGE: {
    id: 'INTAKE_CHANGE',
    name: 'Intake Change',
    description:
      'Placeholder route for intake/course changes: scrutiny, inspection when required, then decision.',
    applicationTypes: ['INTAKE_CHANGE'],
    stages: ['SUBMITTED', 'SCRUTINY', 'EVC_REQUIRED', 'EVC_DONE', 'DECISION'],
    requiresEvc: false,
    decisionStage: 'DECISION',
  },
  APPEAL: {
    id: 'APPEAL',
    name: 'Appeal (SHC / SAC)',
    description:
      'Placeholder appeal route covering the Standing Hearing Committee and Standing Appellate Committee stages.',
    applicationTypes: [],
    stages: ['APPEAL_SHC', 'APPEAL_SAC'],
    requiresEvc: false,
    decisionStage: 'APPEAL_SAC',
  },
};

export const TYPE_ROUTE_MAP: Record<ApplicationType, ApprovalRouteId> = {
  NEW: 'NEW_APPROVAL',
  EXTENSION_OF_APPROVAL: 'EXTENSION_OF_APPROVAL',
  INTAKE_CHANGE: 'INTAKE_CHANGE',
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
