import { Context, Next } from 'hono';
import { verifyJwt } from '../services/auth.js';
import { AuthTokenPayload, Role, UserRole } from '../types.js';

// Extend Hono's context variable map
declare module 'hono' {
  interface ContextVariableMap {
    user: AuthTokenPayload;
  }
}

/**
 * Normalizes role string to standard uppercase UserRole ('INSTITUTION' | 'OFFICER' | 'COMMITTEE' | 'CHIEF')
 */
export function normalizeRole(role: string): UserRole {
  const upper = role.toUpperCase();
  if (upper === 'INSTITUTION' || upper === 'OFFICER' || upper === 'COMMITTEE' || upper === 'CHIEF') {
    return upper as UserRole;
  }
  return 'INSTITUTION';
}

/**
 * Resolves the acting role for legacy workflow routes.
 *
 * A verified JWT (populated by optionalAuthMiddleware) always wins. When no
 * token is present, the legacy x-role header remains supported so existing
 * deployments and tests can opt into ALLOW_DEMO_HEADER_ROLE.
 */
export function resolveActorRole(c: Context, fallback: Role = 'institution'): Role {
  const user = c.get('user');
  if (user?.role) {
    return user.role.toLowerCase() as Role;
  }
  if (process.env.ALLOW_DEMO_HEADER_ROLE === 'true') {
    const headerRole = c.req.header('x-role');
    if (headerRole) {
      return normalizeRole(headerRole).toLowerCase() as Role;
    }
  }
  return fallback;
}

/**
 * Builds the legacy demo identity from x-role / x-region when
 * ALLOW_DEMO_HEADER_ROLE=true. Returns null when the fallback is disabled or
 * no role header is present.
 */
function demoUserFromHeaders(c: Context): AuthTokenPayload | null {
  if (process.env.ALLOW_DEMO_HEADER_ROLE !== 'true') return null;
  const roleHeader = c.req.header('x-role');
  if (!roleHeader) return null;

  const normRole = normalizeRole(roleHeader);
  return {
    sub: `DEMO-${normRole}`,
    role: normRole,
    name: `Demo ${normRole}`,
    email: `demo.${normRole.toLowerCase()}@aicte.gov.in`,
    institutionName: normRole === 'INSTITUTION' ? 'Delhi Institute of Advanced Technology & AI' : undefined,
    inspectorId: normRole === 'COMMITTEE' ? 'INS-002' : undefined,
    region: (c.req.header('x-region')?.toUpperCase() as AuthTokenPayload['region']) || 'ALL',
  };
}

/**
 * Extracts Bearer token or evaluates legacy x-role only if ALLOW_DEMO_HEADER_ROLE=true
 */
export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('authorization') || c.req.header('Authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    try {
      const payload = await verifyJwt(token);
      c.set('user', payload);
      return next();
    } catch (err: unknown) {
      return c.json({ error: 'Unauthorized: Invalid or expired token' }, 401);
    }
  }

  const demoUser = demoUserFromHeaders(c);
  if (demoUser) {
    c.set('user', demoUser);
    return next();
  }

  return c.json({ error: 'Unauthorized: Missing authentication token' }, 401);
}

/**
 * Optional auth middleware for routes that can be public or enriched if logged in.
 */
export async function optionalAuthMiddleware(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('authorization') || c.req.header('Authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    try {
      const payload = await verifyJwt(token);
      c.set('user', payload);
      return next();
    } catch {
      return c.json({ error: 'Unauthorized: Invalid or expired token' }, 401);
    }
  }

  const demoUser = demoUserFromHeaders(c);
  if (demoUser) {
    c.set('user', demoUser);
  }
  return next();
}

/**
 * Enforces that the authenticated user possesses one of the allowed roles.
 */
export function requireRole(...allowedRoles: (string | string[])[]) {
  const normalizedAllowed = allowedRoles.flat().map((r) => String(r).toUpperCase());
  return async (c: Context, next: Next): Promise<Response | void> => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized: Authentication required' }, 401);
    }

    const userRole = user.role.toUpperCase();
    if (!normalizedAllowed.includes(userRole)) {
      return c.json(
        {
          error: `Forbidden: Insufficient privileges. Required role in [${normalizedAllowed.join(', ')}], current role: ${userRole}`,
        },
        403
      );
    }

    return next();
  };
}
