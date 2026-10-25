import { describe, it, expect } from 'vitest';
import { canTransition, validateTransition, getNextStatuses } from '../services/workflow.js';

describe('AICTE Approval State Machine', () => {
  describe('Valid Transitions', () => {
    it('allows SUBMITTED -> SCRUTINY', () => {
      expect(canTransition('SUBMITTED', 'SCRUTINY')).toBe(true);
      expect(validateTransition('SUBMITTED', 'SCRUTINY').valid).toBe(true);
    });

    it('allows SCRUTINY -> DEFICIENT | EVC_REQUIRED | DECISION', () => {
      expect(canTransition('SCRUTINY', 'DEFICIENT')).toBe(true);
      expect(canTransition('SCRUTINY', 'EVC_REQUIRED')).toBe(true);
      expect(canTransition('SCRUTINY', 'DECISION')).toBe(true);
    });

    it('allows DEFICIENT -> SCRUTINY', () => {
      expect(canTransition('DEFICIENT', 'SCRUTINY')).toBe(true);
    });

    it('allows EVC_REQUIRED -> EVC_DONE -> DECISION', () => {
      expect(canTransition('EVC_REQUIRED', 'EVC_DONE')).toBe(true);
      expect(canTransition('EVC_DONE', 'DECISION')).toBe(true);
    });

    it('allows DECISION -> APPROVED | REJECTED', () => {
      expect(canTransition('DECISION', 'APPROVED')).toBe(true);
      expect(canTransition('DECISION', 'REJECTED')).toBe(true);
    });

    it('allows REJECTED -> APPEAL_SHC -> APPEAL_SAC', () => {
      expect(canTransition('REJECTED', 'APPEAL_SHC')).toBe(true);
      expect(canTransition('APPEAL_SHC', 'APPEAL_SAC')).toBe(true);
      expect(canTransition('APPEAL_SAC', 'APPROVED')).toBe(true);
    });
  });

  describe('Invalid Transitions', () => {
    it('rejects self-transitions', () => {
      const res = validateTransition('SUBMITTED', 'SUBMITTED');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('already in status');
    });

    it('rejects jumping from SUBMITTED directly to APPROVED', () => {
      const res = validateTransition('SUBMITTED', 'APPROVED');
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Invalid transition from 'SUBMITTED' to 'APPROVED'");
    });

    it('rejects jumping from DEFICIENT directly to APPROVED', () => {
      const res = validateTransition('DEFICIENT', 'APPROVED');
      expect(res.valid).toBe(false);
    });

    it('rejects transitions from terminal APPROVED state', () => {
      const res = validateTransition('APPROVED', 'SCRUTINY');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Terminal state');
    });
  });

  describe('getNextStatuses helper', () => {
    it('returns valid candidate statuses for dropdown selection', () => {
      expect(getNextStatuses('SUBMITTED')).toEqual(['SCRUTINY']);
      expect(getNextStatuses('SCRUTINY')).toEqual(['DEFICIENT', 'EVC_REQUIRED', 'DECISION']);
      expect(getNextStatuses('DECISION')).toEqual(['APPROVED', 'REJECTED']);
      expect(getNextStatuses('APPROVED')).toEqual([]);
    });
  });
});
