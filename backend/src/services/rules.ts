import { Deficiency, ExtractedFields, ExtractedFieldValue, RuleResult } from '../types.js';
import { RULE_MIN_LAND_AREA_SQM, RULE_LEASE_BUFFER_DAYS } from '../config/timelines.js';

// Constants are now sourced from config/timelines.ts
const MIN_LAND_AREA_SQM = RULE_MIN_LAND_AREA_SQM;
const LEASE_BUFFER_DAYS = RULE_LEASE_BUFFER_DAYS;

/**
 * Rule 1: Minimum Land Area Check
 * AICTE APH 2024-25 Clause 4.1: Institution must possess requisite contiguous land area.
 */
export function checkLandArea(
  landArea?: number | ExtractedFieldValue<number>
): RuleResult {
  const clause = 'AICTE APH 2024-25 Clause 4.1';
  const isObject = typeof landArea === 'object' && landArea !== null;
  const value = isObject ? landArea.value : landArea;
  const confidence = isObject ? landArea.confidence : 1.0;
  const evidence = isObject ? landArea.evidenceText : undefined;
  const sourcePage = isObject ? landArea.sourcePage : undefined;

  if (isObject && confidence < 0.7) {
    return {
      passed: false,
      message: `Land area extraction has low confidence (${Math.round(confidence * 100)}%). Needs human review.`,
      clause,
      severity: 'MAJOR',
      evidence,
      confidence,
      sourcePage,
      needsHumanReview: true,
    };
  }

  if (value === undefined || value === null) {
    return {
      passed: false,
      message: 'Land area documentation missing or unextracted',
      clause,
      severity: 'CRITICAL',
      evidence,
      confidence,
      sourcePage,
    };
  }

  if (value < MIN_LAND_AREA_SQM) {
    return {
      passed: false,
      message: `Land area of ${value} sq.m is below the AICTE minimum threshold of ${MIN_LAND_AREA_SQM} sq.m`,
      clause,
      severity: 'CRITICAL',
      evidence,
      confidence,
      sourcePage,
    };
  }

  return {
    passed: true,
    message: `Land area of ${value} sq.m satisfies the AICTE minimum requirement (${MIN_LAND_AREA_SQM} sq.m)`,
    clause,
    severity: 'CRITICAL',
    evidence,
    confidence,
    sourcePage,
  };
}

/**
 * Rule 2: Land Lease Deed Expiry Check
 * AICTE APH 2024-25 Clause 4.3: Land lease deed must have minimum remaining validity (> 90 days from evaluation).
 */
export function checkLeaseValidity(
  leaseEnd?: string | ExtractedFieldValue<string>,
  nowInput: Date = new Date()
): RuleResult {
  const clause = 'AICTE APH 2024-25 Clause 4.3';
  const isObject = typeof leaseEnd === 'object' && leaseEnd !== null;
  const value = isObject ? leaseEnd.value : leaseEnd;
  const confidence = isObject ? leaseEnd.confidence : 1.0;
  const evidence = isObject ? leaseEnd.evidenceText : undefined;
  const sourcePage = isObject ? leaseEnd.sourcePage : undefined;

  if (isObject && confidence < 0.7) {
    return {
      passed: false,
      message: `Land lease deed expiry extraction has low confidence (${Math.round(confidence * 100)}%). Needs human review.`,
      clause,
      severity: 'MAJOR',
      evidence,
      confidence,
      sourcePage,
      needsHumanReview: true,
    };
  }

  if (!value) {
    return {
      passed: false,
      message: 'Land lease deed expiration date missing or unverified',
      clause,
      severity: 'CRITICAL',
      evidence,
      confidence,
      sourcePage,
    };
  }

  const leaseDate = new Date(value);
  if (isNaN(leaseDate.getTime())) {
    return {
      passed: false,
      message: 'Invalid date format for land lease deed expiration',
      clause,
      severity: 'MAJOR',
      evidence,
      confidence,
      sourcePage,
    };
  }

  const now = nowInput;
  const bufferTime = LEASE_BUFFER_DAYS * 24 * 60 * 60 * 1000;
  const minValidUntil = new Date(now.getTime() + bufferTime);

  if (leaseDate < now) {
    return {
      passed: false,
      message: `Land lease deed expired on ${value}`,
      clause,
      severity: 'CRITICAL',
      evidence,
      confidence,
      sourcePage,
    };
  }

  if (leaseDate < minValidUntil) {
    const diffDays = Math.ceil((leaseDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      passed: false,
      message: `Land lease deed expires in ${diffDays} days (must be valid for at least ${LEASE_BUFFER_DAYS} days)`,
      clause,
      severity: 'CRITICAL',
      evidence,
      confidence,
      sourcePage,
    };
  }

  return {
    passed: true,
    message: `Land lease deed valid until ${value} (> ${LEASE_BUFFER_DAYS} days buffer)`,
    clause,
    severity: 'CRITICAL',
    evidence,
    confidence,
    sourcePage,
  };
}

/**
 * Rule 3: Fire Safety NOC Validity Check
 * AICTE APH 2024-25 Clause 5.2: Valid Fire and Life Safety Certificate / NOC from State Fire Department.
 */
export function checkFireNoc(
  fireNoc?: string | ExtractedFieldValue<string>,
  nowInput: Date = new Date()
): RuleResult {
  const clause = 'AICTE APH 2024-25 Clause 5.2';
  const isObject = typeof fireNoc === 'object' && fireNoc !== null;
  const value = isObject ? fireNoc.value : fireNoc;
  const confidence = isObject ? fireNoc.confidence : 1.0;
  const evidence = isObject ? fireNoc.evidenceText : undefined;
  const sourcePage = isObject ? fireNoc.sourcePage : undefined;

  if (isObject && confidence < 0.7) {
    return {
      passed: false,
      message: `Fire Safety NOC expiration date has low confidence (${Math.round(confidence * 100)}%). Needs human review.`,
      clause,
      severity: 'MAJOR',
      evidence,
      confidence,
      sourcePage,
      needsHumanReview: true,
    };
  }

  if (!value) {
    return {
      passed: false,
      message: 'Fire and Life Safety NOC missing or unverified',
      clause,
      severity: 'CRITICAL',
      evidence,
      confidence,
      sourcePage,
    };
  }

  const nocDate = new Date(value);
  if (isNaN(nocDate.getTime())) {
    return {
      passed: false,
      message: 'Invalid date format for Fire Safety NOC expiration',
      clause,
      severity: 'MAJOR',
      evidence,
      confidence,
      sourcePage,
    };
  }

  const now = nowInput;
  const nocEndOfDay = new Date(nocDate);
  nocEndOfDay.setHours(23, 59, 59, 999);

  if (nocEndOfDay < now) {
    return {
      passed: false,
      message: `Fire and Life Safety NOC expired on ${value}`,
      clause,
      severity: 'CRITICAL',
      evidence,
      confidence,
      sourcePage,
    };
  }

  return {
    passed: true,
    message: `Fire Safety NOC is active and valid until ${value}`,
    clause,
    severity: 'CRITICAL',
    evidence,
    confidence,
    sourcePage,
  };
}

export type InputExtractionSource =
  | ExtractedFields
  | {
      landAreaSqm?: ExtractedFieldValue<number>;
      leaseEndDate?: ExtractedFieldValue<string>;
      fireNocExpiry?: ExtractedFieldValue<string>;
    };

/**
 * Evaluates AICTE scrutiny rules against extracted fields or rich extracted field objects.
 */
export function evaluateRules(
  extracted?: InputExtractionSource,
  nowInput: Date = new Date()
): {
  results: RuleResult[];
  deficiencies: Deficiency[];
  allPassed: boolean;
} {
  const landAreaInput = extracted ? (extracted as Record<string, unknown>).landAreaSqm : undefined;
  const leaseEndInput = extracted ? (extracted as Record<string, unknown>).leaseEndDate : undefined;
  const fireNocInput = extracted ? (extracted as Record<string, unknown>).fireNocExpiry : undefined;

  const results: RuleResult[] = [
    checkLandArea(landAreaInput as number | ExtractedFieldValue<number>),
    checkLeaseValidity(leaseEndInput as string | ExtractedFieldValue<string>, nowInput),
    checkFireNoc(fireNocInput as string | ExtractedFieldValue<string>, nowInput),
  ];

  const ruleNames = ['LAND_AREA', 'LEASE_VALIDITY', 'FIRE_NOC'];

  const deficiencies: Deficiency[] = results
    .map((r, idx) => ({ r, ruleId: ruleNames[idx] }))
    .filter(({ r }) => !r.passed)
    .map(({ r, ruleId }) => ({
      id: `DEF-${ruleId}-${Date.now().toString().slice(-4)}`,
      message: r.message,
      clause: r.clause,
      severity: r.severity,
      evidence: r.evidence,
      confidence: r.confidence,
      sourcePage: r.sourcePage,
      needsHumanReview: r.needsHumanReview,
    }));

  return {
    results,
    deficiencies,
    allPassed: deficiencies.length === 0,
  };
}
