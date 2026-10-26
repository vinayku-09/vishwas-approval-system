/**
 * undertakings.ts - Configuration for institutional undertakings and document renewals.
 *
 * Placeholder pending the Approval Process Handbook (APH); not an official AICTE rule.
 * All duration and validity values below are product assumptions for the SIH 2026 SH26262 prototype.
 */

import { DocumentType } from '../types.js';

/**
 * Default duration in calendar days for a newly issued institutional undertaking.
 * Placeholder pending APH.
 */
export const DEFAULT_UNDERTAKING_DURATION_DAYS = 30;

/**
 * Default duration by undertaking condition category (calendar days).
 * Placeholder pending APH.
 */
export const UNDERTAKING_CATEGORY_DURATIONS: Record<string, number> = {
  INFRASTRUCTURE: 60,
  FACULTY_RECRUITMENT: 45,
  DOCUMENTARY_COMPLIANCE: 30,
  SAFETY_CERTIFICATION: 15,
  OTHER: 30,
};

/**
 * Default validity period in calendar days for renewed documents when not specified.
 * Placeholder pending APH.
 */
export const DEFAULT_RENEWAL_VALIDITY_DAYS = 365;

/**
 * Statutory renewal validity periods by document type (calendar days).
 * Placeholder pending APH.
 */
export const RENEWAL_VALIDITY_PERIODS: Record<DocumentType, number> = {
  FIRE_NOC: 365,       // 1 year statutory fire safety validity
  LEASE_DEED: 1095,    // 3 years typical land lease renewal cycle
  LAND_RECORD: 1825,   // 5 years land revenue / registry certification
};
