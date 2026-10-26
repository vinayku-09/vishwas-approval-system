import { Hono } from 'hono';
import { z } from 'zod';
import { store } from '../db/store.js';
import {
  isLoginRateLimited,
  recordFailedLogin,
  resetLoginAttempts,
  signJwt,
  verifyPassword,
} from '../services/auth.js';
import { authMiddleware } from '../middleware/auth.js';

export const authRouter = new Hono();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /auth/login
 * Validates credentials, enforces in-memory rate limiting (5 attempts / 15m),
 * and issues an 8-hour signed JWT.
 */
authRouter.post('/login', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON request body' }, 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Invalid login payload' }, 400);
  }

  const { email, password } = parsed.data;

  // Rate limiting check
  const rateLimitStatus = isLoginRateLimited(email);
  if (rateLimitStatus.limited) {
    c.header('Retry-After', String(rateLimitStatus.retryAfterSeconds || 900));
    return c.json(
      {
        error: `Too many failed login attempts. Please try again in ${rateLimitStatus.retryAfterSeconds || 900} seconds.`,
      },
      429
    );
  }

  // Lookup user
  const user = await store.getUserByEmail(email);
  if (!user) {
    recordFailedLogin(email);
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, user.passwordHash);
  if (!isValidPassword) {
    recordFailedLogin(email);
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  // Success: reset rate limit attempts
  resetLoginAttempts(email);

  // Generate JWT token
  const token = await signJwt({
    sub: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    institutionName: user.institutionName,
    inspectorId: user.inspectorId,
  });

  return c.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      institutionName: user.institutionName,
      inspectorId: user.inspectorId,
    },
  });
});

/**
 * GET /auth/me
 * Returns current authenticated user claims
 */
authRouter.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.json({ user });
});
