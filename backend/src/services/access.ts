import type { Application, AuthTokenPayload, Region } from '../types.js';

/**
 * Centralised role/region access rules for application-scoped reads.
 *
 * - CHIEF: unrestricted.
 * - Region ALL (or unspecified): unrestricted for internal roles.
 * - Regional OFFICER / COMMITTEE: own region, plus applications whose region
 *   is ALL or not recorded (legacy records).
 * - INSTITUTION: only applications belonging to the caller's institution.
 */
export function hasRegionAccess(
  user: AuthTokenPayload,
  region?: Region
): boolean {
  if (user.role === 'CHIEF') return true;
  if (!user.region || user.region === 'ALL') return true;
  if (!region || region === 'ALL') return true;
  return region === user.region;
}

export function canReadApplication(
  user: AuthTokenPayload,
  application: Pick<Application, 'institutionName' | 'region'>
): boolean {
  if (user.role === 'CHIEF') return true;

  if (user.role === 'INSTITUTION') {
    return Boolean(
      user.institutionName &&
        application.institutionName === user.institutionName
    );
  }

  return hasRegionAccess(user, application.region);
}
