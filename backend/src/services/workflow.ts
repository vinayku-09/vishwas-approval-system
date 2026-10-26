import { Status } from '../types.js';

/**
 * AICTE State Machine Transition Table
 * 
 * SUBMITTED -> SCRUTINY | EVC_REQUIRED -> DEFICIENT | EVC_REQUIRED | DECISION
 * DEFICIENT -> SCRUTINY; EVC_REQUIRED -> EVC_DONE -> DECISION
 * DECISION -> APPROVED | REJECTED; REJECTED -> APPEAL_SHC -> APPEAL_SAC
 * APPEAL_SHC -> APPEAL_SAC | APPROVED; APPEAL_SAC -> APPROVED | REJECTED
 *
 * SUBMITTED can enter EVC_REQUIRED directly only for the configured ONLY_EVC
 * route; route-level validation in the advance handler enforces that boundary.
 */
export const TRANSITIONS: Record<Status, Status[]> = {
  SUBMITTED: ['SCRUTINY', 'EVC_REQUIRED'],
  SCRUTINY: ['DEFICIENT', 'EVC_REQUIRED', 'DECISION'],
  DEFICIENT: ['SCRUTINY'],
  EVC_REQUIRED: ['EVC_DONE'],
  EVC_DONE: ['DECISION'],
  DECISION: ['APPROVED', 'REJECTED'],
  REJECTED: ['APPEAL_SHC'],
  APPEAL_SHC: ['APPEAL_SAC', 'APPROVED'],
  APPEAL_SAC: ['APPROVED', 'REJECTED'],
  APPROVED: [], // Terminal approved state
};

export function canTransition(from: Status, to: Status): boolean {
  const allowed = TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function validateTransition(from: Status, to: Status): { valid: boolean; error?: string } {
  if (from === to) {
    return { valid: false, error: `Application is already in status '${from}'` };
  }

  const allowed = TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    const allowedStr = allowed.length > 0 ? allowed.join(', ') : 'None (Terminal state)';
    return {
      valid: false,
      error: `Invalid transition from '${from}' to '${to}'. Allowed next states: [${allowedStr}]`,
    };
  }

  return { valid: true };
}

export function getNextStatuses(from: Status): Status[] {
  return TRANSITIONS[from] || [];
}
