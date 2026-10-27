import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { AuthTokenPayload, Region, UserRole } from '../types.js';
import { resolveJwtSecret } from '../config/timelines.js';

/**
 * Returns the JWT secret as a Uint8Array for jose.
 *
 * Resolution order (see config/timelines.ts for full logic):
 *  1. JWT_SECRET env var  — always takes priority.
 *  2. DEV_JWT_SECRET fallback — only when NODE_ENV !== 'production'.
 *  3. Throws in production when JWT_SECRET is absent.
 *
 * This enables zero-setup local dev and test runs.
 */
export function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(resolveJwtSecret());
}

/**
 * Signs an 8-hour JWT with the required claims.
 */
export async function signJwt(payload: {
  sub: string;
  id?: string;
  role: UserRole;
  name: string;
  email: string;
  phone?: string;
  institutionName?: string;
  inspectorId?: string;
  region?: Region;
}): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({
    id: payload.id || payload.sub,
    role: payload.role,
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    institutionName: payload.institutionName,
    inspectorId: payload.inspectorId,
    region: payload.region,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret);
}

/**
 * Verifies a JWT token and returns the typed payload.
 */
export async function verifyJwt(token: string): Promise<AuthTokenPayload> {
  const secret = getJwtSecret();
  const { payload } = await jwtVerify(token, secret);
  return {
    sub: payload.sub as string,
    id: (payload.id as string) || (payload.sub as string),
    role: payload.role as UserRole,
    name: payload.name as string,
    email: payload.email as string,
    phone: payload.phone as string | undefined,
    institutionName: payload.institutionName as string | undefined,
    inspectorId: payload.inspectorId as string | undefined,
    region: payload.region as Region | undefined,
    exp: payload.exp,
    iat: payload.iat,
  };
}

/**
 * Hashes a plaintext password using bcrypt.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/**
 * Verifies a plaintext password against a bcrypt hash.
 */
export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

// ---------------------------------------------------------------------------
// In-Memory Login Rate Limiting (5 failed attempts per 15 minutes per email)
// ---------------------------------------------------------------------------

interface RateLimitRecord {
  failures: number;
  windowStart: number;
}

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;

const loginAttempts = new Map<string, RateLimitRecord>();

/**
 * Checks whether an email is currently rate-limited.
 */
export function isLoginRateLimited(email: string, now = Date.now()): {
  limited: boolean;
  retryAfterSeconds?: number;
} {
  const key = email.toLowerCase().trim();
  const record = loginAttempts.get(key);
  if (!record) {
    return { limited: false };
  }

  // If window expired, reset
  if (now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.delete(key);
    return { limited: false };
  }

  if (record.failures >= MAX_FAILED_ATTEMPTS) {
    const remainingMs = RATE_LIMIT_WINDOW_MS - (now - record.windowStart);
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
    };
  }

  return { limited: false };
}

/**
 * Records a failed login attempt for an email.
 */
export function recordFailedLogin(email: string, now = Date.now()): void {
  const key = email.toLowerCase().trim();
  const record = loginAttempts.get(key);

  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.set(key, { failures: 1, windowStart: now });
  } else {
    record.failures += 1;
  }
}

/**
 * Resets failed attempts after a successful login.
 */
export function resetLoginAttempts(email: string): void {
  const key = email.toLowerCase().trim();
  loginAttempts.delete(key);
}

/**
 * Clears all rate-limiting state (useful in automated tests).
 */
export function clearAllLoginRateLimits(): void {
  loginAttempts.clear();
  registrationAttempts.clear();
}

const registrationAttempts = new Map<string, RateLimitRecord>();

/**
 * Checks whether registration is rate-limited for an IP or email.
 */
export function isRegisterRateLimited(identifier: string, now = Date.now()): {
  limited: boolean;
  retryAfterSeconds?: number;
} {
  const key = identifier.toLowerCase().trim();
  const record = registrationAttempts.get(key);
  if (!record) {
    return { limited: false };
  }

  if (now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    registrationAttempts.delete(key);
    return { limited: false };
  }

  if (record.failures >= MAX_FAILED_ATTEMPTS) {
    const remainingMs = RATE_LIMIT_WINDOW_MS - (now - record.windowStart);
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
    };
  }

  return { limited: false };
}

/**
 * Records a registration attempt.
 */
export function recordRegisterAttempt(identifier: string, now = Date.now()): void {
  const key = identifier.toLowerCase().trim();
  const record = registrationAttempts.get(key);
  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    registrationAttempts.set(key, { failures: 1, windowStart: now });
  } else {
    record.failures += 1;
  }
}
