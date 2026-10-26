/**
 * timelines.ts — Single source of truth for all timeline & threshold constants
 * across the Vishwas AICTE Approval System.
 *
 * Every magic number relating to time windows, SLA budgets, expiry tiers,
 * or cron cadence MUST be sourced from this file.  Changing a value here
 * propagates automatically to SLA calculation, expiry computation, cron
 * secret fallback, and JWT dev-fallback.
 *
 * Reference: AICTE Approval Process Handbook (APH) 2024-25
 */

// ---------------------------------------------------------------------------
// SLA (Service Level Agreement) Configuration
// ---------------------------------------------------------------------------

/** Total calendar days an officer has to process a NEW application. */
export const SLA_WINDOW_DAYS_NEW = 21;

/** Total calendar days for EXTENSION_OF_APPROVAL processing. */
export const SLA_WINDOW_DAYS_EXTENSION = 21;

/** Total calendar days for INTAKE_CHANGE processing. */
export const SLA_WINDOW_DAYS_INTAKE_CHANGE = 21;

/**
 * Fraction of the SLA window elapsed before the status escalates from
 * ON_TIME to WARNING (e.g. 0.8 = 80% of window elapsed).
 */
export const SLA_WARNING_THRESHOLD = 0.8;

// ---------------------------------------------------------------------------
// Compliance Document Expiry Warning Tiers (AICTE APH Clause 7)
// ---------------------------------------------------------------------------

/** First warning tier: issue WARNING when ≤ 90 days remain. */
export const EXPIRY_TIER_HIGH = 90 as const;

/** Second warning tier: escalate WARNING when ≤ 60 days remain. */
export const EXPIRY_TIER_MEDIUM = 60 as const;

/** Third warning tier: critical WARNING when ≤ 30 days remain. */
export const EXPIRY_TIER_LOW = 30 as const;

/** All tiers in descending order — used for tier-detection loops. */
export const EXPIRY_TIERS = [EXPIRY_TIER_HIGH, EXPIRY_TIER_MEDIUM, EXPIRY_TIER_LOW] as const;

// ---------------------------------------------------------------------------
// AICTE Scrutiny Rule Thresholds (AICTE APH 2024-25)
// ---------------------------------------------------------------------------

/** Minimum campus land area in square metres (APH Clause 4.1). */
export const RULE_MIN_LAND_AREA_SQM = 6000;

/** Minimum remaining validity days on land lease deed at evaluation time (APH Clause 4.3). */
export const RULE_LEASE_BUFFER_DAYS = 90;

// ---------------------------------------------------------------------------
// Cron & Scheduler Configuration
// ---------------------------------------------------------------------------

/**
 * Default bearer secret protecting the /cron/expiry-check endpoint.
 * Override via CRON_SECRET env var in deployed environments.
 */
export const DEFAULT_CRON_SECRET = 'dev-cron-secret';

// ---------------------------------------------------------------------------
// JWT / Auth Configuration
// ---------------------------------------------------------------------------

/**
 * Fallback JWT signing secret used ONLY in non-production environments
 * (i.e. NODE_ENV !== 'production') when JWT_SECRET env var is absent.
 *
 * This enables zero-setup local development and test runs without requiring
 * an environment file.  This value MUST NOT be used in any deployed environment.
 */
export const DEV_JWT_SECRET = 'dev-jwt-secret-aicte-vishwas-2024';

/**
 * Resolves the JWT secret in the correct priority order:
 *   1. JWT_SECRET environment variable (always wins)
 *   2. DEV_JWT_SECRET — only when not in production
 *   3. Throws in production if JWT_SECRET is absent
 *
 * Centralised here so that both auth.ts and tests import from one place.
 */
export function resolveJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET;
  if (envSecret && envSecret.trim().length > 0) {
    return envSecret.trim();
  }
  if (process.env.NODE_ENV !== 'production') {
    return DEV_JWT_SECRET;
  }
  throw new Error(
    'JWT_SECRET is required in production. Set the JWT_SECRET environment variable.'
  );
}

// ---------------------------------------------------------------------------
// Inspection / Scheduling Configuration
// ---------------------------------------------------------------------------

/** Duration of a physical campus inspection in hours. */
export const INSPECTION_DURATION_HOURS = 4;

/** Earliest permitted start time for inspections (24-h format). */
export const INSPECTION_START_HOUR = 9;

/** Latest permitted end time for inspections (24-h format). */
export const INSPECTION_END_HOUR = 18;

/** Assumed average road travel speed in km/h. */
export const TRAVEL_SPEED_KMH = 40;

/** Road-to-haversine winding factor for Indian road network. */
export const ROAD_WINDING_FACTOR = 1.3;
