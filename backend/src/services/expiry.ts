import { ExpiryState, WarningTier } from '../types.js';

export interface ExpiryCalculationResult {
  state: ExpiryState;
  tier?: WarningTier;
  daysRemaining: number;
}

/**
 * Pure function computing the expiry state of a compliance document.
 * 
 * Boundaries:
 * - daysRemaining > 90: VALID
 * - 61 <= daysRemaining <= 90: WARNING (tier 90)
 * - 31 <= daysRemaining <= 60: WARNING (tier 60)
 * - 1 <= daysRemaining <= 30: WARNING (tier 30)
 * - daysRemaining <= 0: OVERDUE
 */
export function computeExpiryState(
  expiryDateInput: string | Date,
  nowInput: Date = new Date()
): ExpiryCalculationResult {
  const target = typeof expiryDateInput === 'string' ? new Date(expiryDateInput) : expiryDateInput;
  const now = nowInput;

  // Normalize both dates to UTC midnight for precise integer day comparisons
  const targetMidnight = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate()
  );
  const nowMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );

  const diffMs = targetMidnight - nowMidnight;
  const daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (daysRemaining <= 0) {
    return {
      state: 'OVERDUE',
      daysRemaining,
    };
  }

  if (daysRemaining > 90) {
    return {
      state: 'VALID',
      daysRemaining,
    };
  }

  let tier: WarningTier = 90;
  if (daysRemaining <= 30) {
    tier = 30;
  } else if (daysRemaining <= 60) {
    tier = 60;
  } else {
    tier = 90;
  }

  return {
    state: 'WARNING',
    tier,
    daysRemaining,
  };
}
