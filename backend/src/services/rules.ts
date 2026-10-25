import { Deficiency, ExtractedFields, RuleResult } from '../types.js';

// TODO(next): In production, an asynchronous Vision / Multimodal LLM extraction pipeline
// will OCR uploaded PDF documents (Lease Deed, Fire NOC, Building Plan) and populate
// ExtractedFields automatically before running these deterministic rules.

const MIN_LAND_AREA_SQM = 6000; // AICTE APH Chapter I land requirement for Technical Campuses
const LEASE_BUFFER_DAYS = 90;   // Lease must have >90 days remaining validity

/**
 * Rule 1: Minimum Land Area Check
 * AICTE APH 2024-25 Clause 4.1: Institution must possess requisite contiguous land area.
 */
export function checkLandArea(landAreaSqm?: number): RuleResult {
  const clause = 'AICTE APH 2024-25 Clause 4.1';
  if (landAreaSqm === undefined || landAreaSqm === null) {
    return {
      passed: false,
      message: 'Land area documentation missing or unextracted',
      clause,
      severity: 'CRITICAL',
    };
  }

  if (landAreaSqm < MIN_LAND_AREA_SQM) {
    return {
      passed: false,
      message: `Land area of ${landAreaSqm} sq.m is below the AICTE minimum threshold of ${MIN_LAND_AREA_SQM} sq.m`,
      clause,
      severity: 'CRITICAL',
    };
  }

  return {
    passed: true,
    message: `Land area of ${landAreaSqm} sq.m satisfies the AICTE minimum requirement (${MIN_LAND_AREA_SQM} sq.m)`,
    clause,
    severity: 'CRITICAL',
  };
}

/**
 * Rule 2: Land Lease Deed Expiry Check
 * AICTE APH 2024-25 Clause 4.3: Land lease deed must have minimum remaining validity (> 90 days from evaluation).
 */
export function checkLeaseValidity(leaseEndDate?: string): RuleResult {
  const clause = 'AICTE APH 2024-25 Clause 4.3';
  if (!leaseEndDate) {
    return {
      passed: false,
      message: 'Land lease deed expiration date missing or unverified',
      clause,
      severity: 'CRITICAL',
    };
  }

  const leaseDate = new Date(leaseEndDate);
  if (isNaN(leaseDate.getTime())) {
    return {
      passed: false,
      message: 'Invalid date format for land lease deed expiration',
      clause,
      severity: 'MAJOR',
    };
  }

  const now = new Date();
  const bufferTime = LEASE_BUFFER_DAYS * 24 * 60 * 60 * 1000;
  const minValidUntil = new Date(now.getTime() + bufferTime);

  if (leaseDate < now) {
    return {
      passed: false,
      message: `Land lease deed expired on ${leaseEndDate}`,
      clause,
      severity: 'CRITICAL',
    };
  }

  if (leaseDate < minValidUntil) {
    const diffDays = Math.ceil((leaseDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      passed: false,
      message: `Land lease deed expires in ${diffDays} days (must be valid for at least ${LEASE_BUFFER_DAYS} days)`,
      clause,
      severity: 'CRITICAL',
    };
  }

  return {
    passed: true,
    message: `Land lease deed valid until ${leaseEndDate} (> ${LEASE_BUFFER_DAYS} days buffer)`,
    clause,
    severity: 'CRITICAL',
  };
}

/**
 * Rule 3: Fire Safety NOC Validity Check
 * AICTE APH 2024-25 Clause 5.2: Valid Fire and Life Safety Certificate / NOC from State Fire Department.
 */
export function checkFireNoc(fireNocExpiry?: string): RuleResult {
  const clause = 'AICTE APH 2024-25 Clause 5.2';
  if (!fireNocExpiry) {
    return {
      passed: false,
      message: 'Fire and Life Safety NOC missing or unverified',
      clause,
      severity: 'CRITICAL',
    };
  }

  const nocDate = new Date(fireNocExpiry);
  if (isNaN(nocDate.getTime())) {
    return {
      passed: false,
      message: 'Invalid date format for Fire Safety NOC expiration',
      clause,
      severity: 'MAJOR',
    };
  }

  const now = new Date();
  // Set to end of the day for date comparison
  const nocEndOfDay = new Date(nocDate);
  nocEndOfDay.setHours(23, 59, 59, 999);

  if (nocEndOfDay < now) {
    return {
      passed: false,
      message: `Fire and Life Safety NOC expired on ${fireNocExpiry}`,
      clause,
      severity: 'CRITICAL',
    };
  }

  return {
    passed: true,
    message: `Fire Safety NOC is active and valid until ${fireNocExpiry}`,
    clause,
    severity: 'CRITICAL',
  };
}

/**
 * Evaluates all 3 scrutiny rules and generates the deficiency report.
 */
export function evaluateRules(extracted?: ExtractedFields): {
  results: RuleResult[];
  deficiencies: Deficiency[];
  allPassed: boolean;
} {
  const results: RuleResult[] = [
    checkLandArea(extracted?.landAreaSqm),
    checkLeaseValidity(extracted?.leaseEndDate),
    checkFireNoc(extracted?.fireNocExpiry),
  ];

  const deficiencies: Deficiency[] = results
    .filter((r) => !r.passed)
    .map((r) => ({
      message: r.message,
      clause: r.clause,
      severity: r.severity,
    }));

  return {
    results,
    deficiencies,
    allPassed: deficiencies.length === 0,
  };
}
