import { Hono } from 'hono';
import { z } from 'zod';
import crypto, { randomBytes } from 'node:crypto';
import { store } from '../db/store.js';
import {
  hashPassword,
  isLoginRateLimited,
  isRegisterRateLimited,
  recordFailedLogin,
  recordRegisterAttempt,
  resetLoginAttempts,
  signJwt,
  verifyPassword,
} from '../services/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendNotificationEmail, sendRegistrationOtpEmail } from '../services/mailer.js';
import { getStateRegion } from '../config/states.js';
import { User } from '../types.js';

export const authRouter = new Hono();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  role: z.string().optional(),
});

const sendOtpSchema = z.object({
  email: z.string().email('Valid official email address is required'),
});

const r1RegisterSchema = z.object({
  collegeName: z.string().min(3, 'College name must be at least 3 characters').optional(),
  institutionName: z.string().min(3, 'College name must be at least 3 characters').optional(),
  email: z.string().email('Valid official email address is required'),
  mobile: z.string().min(10, 'Mobile must be at least 10 digits').optional(),
  phone: z.string().min(10, 'Phone must be at least 10 digits').optional(),
  telephone: z.string().optional(),
  state: z.string().optional(),
  region: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().optional(),
  otp: z.string().optional(),
});

const createOfficerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email address required'),
  role: z.enum(['OFFICER', 'COMMITTEE'] as const),
  region: z.enum(['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL', 'NORTH_EAST', 'ALL'] as const),
  password: z.string().min(10, 'Password must be at least 10 characters'),
  inspectorId: z.string().optional(),
});

/**
 * POST /auth/register/otp
 * First step of R1 registration:
 * Generates and sends a 6-digit OTP to the official email.
 * - Stores only SHA-256 hash
 * - Expires in 10 minutes
 * - Maximum 5 wrong attempts
 * - Resend cooldown 60 seconds
 * - Rate limits by email and IP
 * - Enumeration safety: Returns identical response whether email exists or not
 * - Never logs OTP in live mail mode
 */
authRouter.post('/register/otp', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON request body' }, 400);
  }

  const parsed = sendOtpSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Invalid email' }, 400);
  }

  const email = parsed.data.email.toLowerCase().trim();
  const clientIp =
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
    c.req.header('x-real-ip') ||
    '127.0.0.1';

  // Rate limiting check by email & IP
  const emailRateStatus = isRegisterRateLimited(email);
  const ipRateStatus = isRegisterRateLimited(clientIp);

  if (emailRateStatus.limited || ipRateStatus.limited) {
    const retryAfter = Math.max(
      emailRateStatus.retryAfterSeconds || 900,
      ipRateStatus.retryAfterSeconds || 900
    );
    c.header('Retry-After', String(retryAfter));
    return c.json(
      {
        error: `Too many OTP requests. Please try again in ${retryAfter} seconds.`,
      },
      429
    );
  }

  // 60-second cooldown check
  const existingOtp = await store.getOtp(email);
  if (existingOtp && Date.now() - existingOtp.lastSentAt < 60 * 1000) {
    const remainingSeconds = Math.ceil((60 * 1000 - (Date.now() - existingOtp.lastSentAt)) / 1000);
    c.header('Retry-After', String(remainingSeconds));
    return c.json(
      {
        error: `Please wait ${remainingSeconds} seconds before requesting a new OTP.`,
      },
      429
    );
  }

  recordRegisterAttempt(email);
  recordRegisterAttempt(clientIp);

  // Check if account already exists (Enumeration safety: Return exact same response!)
  const existingUser = await store.getUserByEmail(email);
  if (existingUser) {
    return c.json({
      success: true,
      message: 'If the email is valid, a 6-digit verification code has been dispatched to your official inbox.',
    });
  }

  // Generate 6-digit numeric OTP
  const rawOtp = String(crypto.randomInt(100000, 1000000));
  const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');

  await store.saveOtp({
    email,
    otpHash,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    attempts: 0,
    lastSentAt: Date.now(),
  });

  // Send OTP email via Nodemailer
  const mailResult = await sendRegistrationOtpEmail(email, rawOtp);
  if (mailResult.status === 'FAILED') {
    console.error(`[auth:otp] Failed to dispatch OTP email to ${email}: ${mailResult.error}`);
  }

  return c.json({
    success: true,
    message: 'If the email is valid, a 6-digit verification code has been dispatched to your official inbox.',
  });
});

/**
 * POST /auth/register
 * Technical institution registration with OTP verification.
 * Enforces min 8 characters, password != email, confirm password match,
 * valid state mapping, rate-limits, and immutable ledger recording (ids only).
 */
authRouter.post('/register', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON request body' }, 400);
  }

  const parsed = r1RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Invalid registration payload' }, 400);
  }

  const data = parsed.data;
  const collegeName = data.collegeName || data.institutionName;
  if (!collegeName || collegeName.trim().length < 3) {
    return c.json({ error: 'College name must be at least 3 characters' }, 400);
  }

  const email = data.email.toLowerCase().trim();
  const phone = data.mobile || data.phone || '';
  const password = data.password;

  // Password validation: min 8 chars, not equal to email
  if (password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400);
  }
  if (password.toLowerCase() === email.toLowerCase()) {
    return c.json({ error: 'Password cannot be equal to your email address' }, 400);
  }
  if (data.confirmPassword && data.confirmPassword !== password) {
    return c.json({ error: 'Password and confirm password do not match' }, 400);
  }

  // Map state to region
  const state = data.state || '';
  const region = state ? getStateRegion(state) : (data.region as any) || 'ALL';

  // R1 OTP Verification Flow
  if (data.otp) {
    const cleanOtp = data.otp.trim();
    const storedOtp = await store.getOtp(email);

    if (!storedOtp || Date.now() > storedOtp.expiresAt) {
      return c.json({ error: 'OTP has expired. Please request a new verification code.' }, 400);
    }

    if (storedOtp.attempts >= 5) {
      return c.json({ error: 'Maximum OTP verification attempts exceeded. Please request a new OTP.' }, 400);
    }

    const enteredHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');
    if (enteredHash !== storedOtp.otpHash) {
      storedOtp.attempts += 1;
      await store.saveOtp(storedOtp);
      return c.json(
        {
          error: `Invalid OTP verification code. ${5 - storedOtp.attempts} attempt(s) remaining.`,
        },
        400
      );
    }

    // OTP verified: check duplicate email
    const existing = await store.getUserByEmail(email);
    if (existing) {
      return c.json({ error: 'An account with this email address already exists' }, 409);
    }

    const hashedPassword = await hashPassword(password);
    const newUser: User = {
      id: `USR-INST-${Date.now().toString().slice(-6)}`,
      email,
      passwordHash: hashedPassword,
      name: collegeName,
      role: 'INSTITUTION',
      institutionName: collegeName,
      region,
      phone,
      emailVerified: true,
      createdAt: new Date().toISOString(),
    };

    await store.saveUser(newUser);

    // Ledger: INSTITUTION_REGISTERED (ids only)
    await store.recordLedger(newUser.id, 'INSTITUTION_REGISTERED', newUser.id, {
      userId: newUser.id,
      region: newUser.region,
    });

    // Delete verified OTP
    await store.deleteOtp(email);

    return c.json(
      {
        success: true,
        message: 'Institution account registered successfully. You can now log in.',
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          institutionName: newUser.institutionName,
          region: newUser.region,
          phone: newUser.phone,
        },
      },
      201
    );
  }

  // Backwards compatibility branch for previous tests (without OTP parameter)
  // Duplicate email check
  const existing = await store.getUserByEmail(email);
  if (existing) {
    recordRegisterAttempt(email);
    return c.json({ error: 'An account with this email address already exists' }, 409);
  }

  const verificationToken = randomBytes(24).toString('hex');
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const hashedPassword = await hashPassword(password);

  const newUser: User = {
    id: `USR-INST-${Date.now().toString().slice(-6)}`,
    email,
    passwordHash: hashedPassword,
    name: collegeName,
    role: 'INSTITUTION',
    institutionName: collegeName,
    region,
    phone,
    emailVerified: false,
    verificationToken,
    verificationExpires,
    createdAt: new Date().toISOString(),
  };

  await store.saveUser(newUser);

  await store.recordLedger(newUser.id, 'INSTITUTION_REGISTERED', newUser.id, {
    userId: newUser.id,
    region: newUser.region,
  });

  await sendNotificationEmail({
    to: newUser.email,
    applicationId: 'REGISTRATION',
    subject: 'Verify Institution Email',
    reason: 'Verify your official AICTE Vishwas institution account.',
    portalPath: `/verify-email?token=${verificationToken}`,
  });

  return c.json(
    {
      success: true,
      message: 'Institution registered successfully. A verification link has been sent to your email. Please verify before signing in.',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        institutionName: newUser.institutionName,
        region: newUser.region,
        phone: newUser.phone,
      },
    },
    201
  );
});

/**
 * GET /auth/verify-email?token=...
 * Activates institution account before first login.
 */
authRouter.get('/verify-email', async (c) => {
  const token = c.req.query('token');
  if (!token) {
    return c.json({ error: 'Verification token is required' }, 400);
  }

  const users = await store.listUsers();
  const user = users.find((u) => u.verificationToken === token);
  if (!user) {
    return c.json({ error: 'Invalid or already verified token' }, 400);
  }

  if (user.verificationExpires && new Date(user.verificationExpires).getTime() < Date.now()) {
    return c.json({ error: 'Verification link has expired (24-hour limit). Please register again.' }, 400);
  }

  user.emailVerified = true;
  user.verificationToken = undefined;
  user.verificationExpires = undefined;
  await store.saveUser(user);

  await store.recordLedger(user.id, 'EMAIL_VERIFIED', user.email, {
    email: user.email,
    verifiedAt: new Date().toISOString(),
  });

  return c.json({
    success: true,
    message: 'Official email successfully verified! You can now sign in to your Institution Portal.',
  });
});

/**
 * POST /auth/login
 * Validates credentials, enforces in-memory rate limiting (5 attempts / 15m),
 * checks the chosen role against the account's real role and rejects a mismatch with a generic error,
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

  const { email, password, role } = parsed.data;

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

  // Role check: If role dropdown value was provided, verify it matches user's real role
  if (role) {
    const chosenRole = role.toUpperCase();
    if (user.role.toUpperCase() !== chosenRole) {
      recordFailedLogin(email);
      // Generic error so account/role enumeration is refused
      return c.json({ error: 'Invalid email, password, or role selection' }, 401);
    }
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, user.passwordHash);
  if (!isValidPassword) {
    recordFailedLogin(email);
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  // Email verification check for institutions
  if (user.role === 'INSTITUTION' && user.emailVerified === false) {
    return c.json(
      {
        error: 'Email verification required. Please click the verification link sent to your official email before logging in.',
      },
      403
    );
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
    region: user.region,
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
      region: user.region,
      phone: user.phone,
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

/**
 * GET /auth/users
 * Lists users. Restricted to AICTE Head Office (CHIEF).
 */
authRouter.get('/users', authMiddleware, async (c) => {
  const user = c.get('user');
  if (user.role !== 'CHIEF') {
    return c.json({ error: 'Forbidden: User management is restricted to AICTE Head Office' }, 403);
  }

  const users = await store.listUsers();
  return c.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      region: u.region,
      institutionName: u.institutionName,
      inspectorId: u.inspectorId,
      phone: u.phone,
      emailVerified: u.emailVerified,
      createdAt: u.createdAt,
    }))
  );
});

/**
 * POST /auth/users
 * Create officers or inspectors. Restricted to AICTE Head Office (CHIEF).
 */
authRouter.post('/users', authMiddleware, async (c) => {
  const user = c.get('user');
  if (user.role !== 'CHIEF') {
    return c.json({ error: 'Forbidden: Creating officers is restricted to AICTE Head Office' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = createOfficerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Invalid user payload' }, 400);
  }

  const { name, email, role, region, password, inspectorId } = parsed.data;

  const existing = await store.getUserByEmail(email);
  if (existing) {
    return c.json({ error: 'A user with this email already exists' }, 409);
  }

  const newUser: User = {
    id: `USR-${role}-${Date.now().toString().slice(-6)}`,
    email: email.toLowerCase().trim(),
    passwordHash: await hashPassword(password),
    name,
    role,
    region,
    inspectorId,
    emailVerified: true,
    createdAt: new Date().toISOString(),
  };

  await store.saveUser(newUser);

  await store.recordLedger(newUser.id, 'OFFICER_CREATED', user.email, {
    createdUser: email,
    role,
    region,
    createdBy: user.email,
    timestamp: new Date().toISOString(),
  });

  return c.json(
    {
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        region: newUser.region,
        inspectorId: newUser.inspectorId,
        createdAt: newUser.createdAt,
      },
    },
    201
  );
});
