import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { app } from '../app.js';
import { store } from '../db/store.js';
import { signJwt, clearAllLoginRateLimits } from '../services/auth.js';
import { encryptBankAccount, decryptBankAccount, maskBankAccount } from '../services/crypto.js';
import { getRequiredDocuments, getStateLandRecordName } from '../config/landDocuments.js';
import { getStateRegion } from '../config/states.js';
import { evaluateInstitutionRisk } from '../services/riskEngine.js';

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe('R1: Registration, OTP, Bank Encryption, Risk Engine & Institution Profile', () => {
  beforeEach(() => {
    store.seed();
    clearAllLoginRateLimits();
  });

  // ---------------------------------------------------------------------------
  // 1. State Mapping & Required Documents by Land Type & State
  // ---------------------------------------------------------------------------
  describe('1. State to Region & Required Document Specification', () => {
    it('maps Indian states to the correct AICTE regions', () => {
      expect(getStateRegion('Maharashtra')).toBe('WEST');
      expect(getStateRegion('Delhi')).toBe('NORTH');
      expect(getStateRegion('Karnataka')).toBe('SOUTH');
      expect(getStateRegion('West Bengal')).toBe('EAST');
      expect(getStateRegion('Uttar Pradesh')).toBe('CENTRAL');
      expect(getStateRegion('Assam')).toBe('NORTH_EAST');
    });

    it('returns state-specific land record names', () => {
      expect(getStateLandRecordName('Maharashtra')).toContain('7/12');
      expect(getStateLandRecordName('Tamil Nadu')).toContain('Patta');
      expect(getStateLandRecordName('Karnataka')).toContain('RTC');
      expect(getStateLandRecordName('Uttar Pradesh')).toContain('Khasra');
    });

    it('returns appropriate required documents for OWNED vs RENTED land', () => {
      const ownedDocs = getRequiredDocuments('OWNED', 'Maharashtra');
      const ownedKeys = ownedDocs.map((d) => d.docKey);
      expect(ownedKeys).toContain('landRecord');
      expect(ownedKeys).toContain('titleDeed');
      expect(ownedKeys).toContain('mutationEntry');
      expect(ownedKeys).toContain('conversionOrder');
      expect(ownedKeys).toContain('fdrCertificate');
      expect(ownedKeys).toContain('trustRegistration');
      expect(ownedKeys).toContain('buildingPlan');
      expect(ownedKeys).toContain('fireNoc');
      expect(ownedKeys).not.toContain('leaseDeed');

      const rentedDocs = getRequiredDocuments('RENTED', 'Karnataka');
      const rentedKeys = rentedDocs.map((d) => d.docKey);
      expect(rentedKeys).toContain('leaseDeed');
      expect(rentedKeys).toContain('ownerNoc');
      expect(rentedKeys).toContain('fdrCertificate');
      expect(rentedKeys).not.toContain('titleDeed');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. OTP Registration, Expiry, Wrong Attempts Lock, Resend Limit & Enumeration
  // ---------------------------------------------------------------------------
  describe('2. OTP Lifecycle & Enumeration Safety', () => {
    it('returns identical enumeration-safe response whether or not email exists', async () => {
      // 1. Non-existent email
      const res1 = await app.request('/auth/register/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'fresh.college@example.edu.in' }),
      });
      expect(res1.status).toBe(200);
      const body1 = (await res1.json()) as any;
      expect(body1.success).toBe(true);
      expect(body1.message).toContain('If the email is valid, a 6-digit verification code has been dispatched');

      // 2. Existing registered email (delhi.tech@aicte.gov.in)
      const res2 = await app.request('/auth/register/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'delhi.tech@aicte.gov.in' }),
      });
      expect(res2.status).toBe(200);
      const body2 = (await res2.json()) as any;
      expect(body2.success).toBe(true);
      expect(body2.message).toBe(body1.message); // Exact identical enumeration-safe message
    });

    it('enforces 60-second cooldown on OTP resend attempts', async () => {
      const email = 'cooldown.test@example.edu.in';

      // First OTP request
      const res1 = await app.request('/auth/register/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      expect(res1.status).toBe(200);

      // Immediate second OTP request within 60s
      const res2 = await app.request('/auth/register/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      expect(res2.status).toBe(429);
      const body2 = (await res2.json()) as any;
      expect(body2.error).toContain('wait');
      expect(res2.headers.get('Retry-After')).toBeTruthy();
    });

    it('enforces maximum 5 wrong attempts lock on OTP verification', async () => {
      const email = 'wrongattempts@example.edu.in';
      const rawOtp = '654321';
      const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');

      await store.saveOtp({
        email,
        otpHash,
        expiresAt: Date.now() + 10 * 60 * 1000,
        attempts: 0,
        lastSentAt: Date.now(),
      });

      // 5 consecutive wrong attempts
      for (let i = 0; i < 5; i++) {
        const res = await app.request('/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            collegeName: 'Attempts Test Institute',
            email,
            mobile: '9876543210',
            state: 'Maharashtra',
            password: 'StrongPassword123!',
            confirmPassword: 'StrongPassword123!',
            otp: '000000', // wrong OTP
          }),
        });
        expect(res.status).toBe(400);
        const body = (await res.json()) as any;
        expect(body.error).toContain('Invalid OTP verification code');
      }

      // 6th attempt should be blocked due to maximum attempts exceeded
      const resLocked = await app.request('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collegeName: 'Attempts Test Institute',
          email,
          mobile: '9876543210',
          state: 'Maharashtra',
          password: 'StrongPassword123!',
          confirmPassword: 'StrongPassword123!',
          otp: rawOtp, // Even with correct OTP, it is now locked
        }),
      });
      expect(resLocked.status).toBe(400);
      const bodyLocked = (await resLocked.json()) as any;
      expect(bodyLocked.error).toContain('Maximum OTP verification attempts exceeded');
    });

    it('rejects expired OTPs after 10 minutes', async () => {
      const email = 'expired@example.edu.in';
      const rawOtp = '112233';
      const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');

      await store.saveOtp({
        email,
        otpHash,
        expiresAt: Date.now() - 1000, // Expired 1 second ago
        attempts: 0,
        lastSentAt: Date.now() - 120000,
      });

      const res = await app.request('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collegeName: 'Expired OTP Academy',
          email,
          mobile: '9876543210',
          state: 'Delhi',
          password: 'StrongPassword123!',
          confirmPassword: 'StrongPassword123!',
          otp: rawOtp,
        }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toContain('OTP has expired');
    });

    it('successfully registers when OTP is valid and writes immutable ledger entry with IDs only', async () => {
      const email = 'r1.success@example.edu.in';
      const rawOtp = '789123';
      const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');

      await store.saveOtp({
        email,
        otpHash,
        expiresAt: Date.now() + 600000,
        attempts: 0,
        lastSentAt: Date.now(),
      });

      const res = await app.request('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collegeName: 'Ramanujan Institute of Artificial Intelligence',
          email,
          mobile: '9876543210',
          state: 'Tamil Nadu',
          password: 'SafePassword999!',
          confirmPassword: 'SafePassword999!',
          otp: rawOtp,
        }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.user.region).toBe('SOUTH');

      // Verify ledger entry: IDs only, no credentials or personal secrets
      const ledger = await store.getLedger(body.user.id);
      expect(ledger.length).toBeGreaterThan(0);
      const regEntry = ledger.find((e) => e.eventType === 'INSTITUTION_REGISTERED');
      expect(regEntry).toBeDefined();
      expect(regEntry?.payload.userId).toBe(body.user.id);
      expect(regEntry?.payload.region).toBe('SOUTH');
      expect((regEntry?.payload as any).password).toBeUndefined();
      expect((regEntry?.payload as any).otp).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Login Role Mismatch Validation
  // ---------------------------------------------------------------------------
  describe('3. Login Role Enforcement & Mismatch Refusal', () => {
    it('refuses login with a generic error when role in dropdown does not match account role', async () => {
      // delhi.tech@aicte.gov.in is an INSTITUTION role
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'delhi.tech@aicte.gov.in',
          password: 'Password123!',
          role: 'OFFICER', // Institution user attempting to select OFFICER in dropdown
        }),
      });

      expect(res.status).toBe(401);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Invalid email, password, or role selection'); // Generic error
    });

    it('allows login when chosen role matches account role', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'officer@aicte.gov.in',
          password: 'Password123!',
          role: 'OFFICER',
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.user.role).toBe('OFFICER');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Bank Account AES-256-GCM Encryption & Masking
  // ---------------------------------------------------------------------------
  describe('4. Bank Account Encryption & Masking at Rest', () => {
    it('encrypts bank account numbers with AES-256-GCM and masks for display', () => {
      const accountNumber = '98765432101234';
      const result = encryptBankAccount(accountNumber);

      expect(result.encrypted).toBeDefined();
      expect(result.encrypted).not.toContain('98765432101234'); // Ciphertext does not leak plaintext
      expect(result.encrypted.split(':').length).toBe(3); // iv:tag:ciphertext

      // Mask shows only last 4 digits
      expect(result.masked).toBe('••••••••••1234');
      expect(maskBankAccount('12345678')).toBe('••••5678');

      // Roundtrip decryption recovers original account number
      const decrypted = decryptBankAccount(result.encrypted);
      expect(decrypted).toBe(accountNumber);
    });

    it('saves draft profile with encrypted bank details and returns only masked number in API', async () => {
      const instToken = await signJwt({
        sub: 'USR-INST-99',
        role: 'INSTITUTION',
        name: 'Pune Institute of Tech',
        email: 'pune.tech@example.edu.in',
        institutionName: 'Pune Institute of Tech',
        region: 'WEST',
      });

      const saveRes = await app.request('/institution/profile', {
        method: 'POST',
        headers: {
          ...bearer(instToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          college: {
            name: 'Pune Institute of Tech',
            fullAddress: 'Kothrud, Pune',
            pin: '411038',
            state: 'Maharashtra',
            district: 'Pune',
          },
          contactPerson: {
            name: 'Principal Joshi',
            designation: 'Director',
            mobile: '9822001122',
            email: 'director@pune.edu.in',
          },
          bank: {
            accountHolder: 'Pune Tech Society',
            bank: 'State Bank of India',
            branch: 'Kothrud',
            accountNumber: '554433221199', // Plaintext bank account provided on save
            ifsc: 'SBIN0001234',
          },
        }),
      });

      expect(saveRes.status).toBe(200);

      // GET profile returns masked account number
      const getRes = await app.request('/institution/profile', {
        headers: bearer(instToken),
      });
      expect(getRes.status).toBe(200);
      const data = (await getRes.json()) as any;
      expect(data.bank.maskedAccountNumber).toBe('••••••••1199');
      // Must NOT return plaintext account number
      expect((data.bank as any).accountNumber).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Scoping & Cross-Region Access Refusal
  // ---------------------------------------------------------------------------
  describe('5. Scoping: Cross-Region Profile Access Refusal', () => {
    it('refuses regional officer from accessing an institution profile outside their jurisdiction', async () => {
      // 1. Create NORTH profile
      const northProfile = {
        id: 'PROF-USR-NORTH',
        institutionId: 'USR-NORTH',
        institutionName: 'Chandigarh Tech',
        status: 'SUBMITTED' as const,
        college: {
          name: 'Chandigarh Tech',
          fullAddress: 'Sector 26, Chandigarh',
          pin: '160019',
          state: 'Chandigarh',
          district: 'Chandigarh',
          region: 'NORTH' as const,
        },
        contactPerson: { name: 'Admin', designation: 'Head', mobile: '9999999999', email: 'adm@chd.edu.in' },
        trust: { name: 'Chd Trust', registrationNumber: 'TR-1', members: [] },
        bank: { accountHolder: 'Chd', bank: 'SBI', branch: 'Main', ifsc: 'SBIN01', encryptedAccountNumber: 'enc', maskedAccountNumber: '••••1234' },
        fdr: { fdrNumber: 'FDR1', bank: 'SBI', amount: 500000, issueDate: '2024-01-01', maturityDate: '2029-01-01' },
        land: { landType: 'OWNED' as const, landAreaSqm: 8000 },
        documents: {},
        missingOrFlaggedItems: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await store.saveProfile(northProfile);

      // 2. West regional officer tries to access North profile -> 403 Forbidden
      const westOfficerToken = await signJwt({
        sub: 'USR-OFFICER-WEST',
        role: 'OFFICER',
        name: 'Dr. Deshmukh',
        email: 'officer.west@aicte.gov.in',
        region: 'WEST',
      });

      const res = await app.request('/institution/profile?id=PROF-USR-NORTH', {
        headers: bearer(westOfficerToken),
      });
      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.error).toContain('outside your regional jurisdiction');
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Risk Scoring Signals & No Auto-Reject
  // ---------------------------------------------------------------------------
  describe('6. Document Risk Signals & Officer Scrutiny (No Auto-Reject)', () => {
    it('detects duplicate hash across institutions, editing tool signatures, and conflicts', () => {
      const foreignHash = 'aabbcc112233445566778899aabbcc112233445566778899aabbcc1122334455';
      const foreignHashes = new Set<string>([foreignHash]);

      const assessment = evaluateInstitutionRisk({
        institutionName: 'Apex College of Technology',
        collegeName: 'Apex College of Technology',
        landType: 'OWNED',
        declaredLandAreaSqm: 10000,
        fdrAmount: 1000000,
        fdrIssueDate: '2025-01-01',
        fdrMaturityDate: '2024-01-01', // Inverted date!
        documents: [
          {
            docKey: 'landRecord',
            name: '7/12 Land Extract',
            sha256: foreignHash, // Cross-institution duplicate!
            fileName: 'land_extract.pdf',
            pdfMetadata: { producer: 'Canva PDF Generator' }, // Suspicious editing software!
            extracted: {
              institutionName: 'Some Completely Different College', // Mismatch!
              landAreaSqm: 4000, // Conflict: 10,000 declared vs 4,000 extracted!
              confidence: 0.52, // Low confidence!
            },
          },
        ],
        existingForeignHashes: foreignHashes,
      });

      expect(assessment.overallScore).toBeGreaterThanOrEqual(70);
      expect(assessment.level).toBe('HIGH');
      expect(assessment.disclaimer).toContain('Risk indicators are assistive signals and not definitive proof');

      const signalCodes = assessment.signals.map((s) => s.code);
      expect(signalCodes).toContain('DUPLICATE_HASH_CROSS_INSTITUTION');
      expect(signalCodes).toContain('DESIGN_TOOL_METADATA');
      expect(signalCodes).toContain('INSTITUTION_NAME_MISMATCH');
      expect(signalCodes).toContain('LAND_AREA_CONFLICT');
      expect(signalCodes).toContain('ODD_FDR_DATES');
      expect(signalCodes).toContain('LOW_EXTRACTION_CONFIDENCE');
    });

    it('officer records review decision without auto-reject or blocking', async () => {
      const profileId = 'PROF-USR-REVIEW-01';
      const profile = {
        id: profileId,
        institutionId: 'USR-INST-REV',
        institutionName: 'Baramati Engineering College',
        status: 'SUBMITTED' as const,
        college: {
          name: 'Baramati Engineering College',
          fullAddress: 'Baramati, Pune',
          pin: '413102',
          state: 'Maharashtra',
          district: 'Pune',
          region: 'WEST' as const,
        },
        contactPerson: { name: 'Principal', designation: 'Head', mobile: '9876543210', email: 'baramati@edu.in' },
        trust: { name: 'Trust', registrationNumber: 'TR-10', members: [] },
        bank: { accountHolder: 'Trust', bank: 'BOI', branch: 'Baramati', ifsc: 'BKID01', encryptedAccountNumber: 'enc', maskedAccountNumber: '••••4321' },
        fdr: { fdrNumber: 'FDR1', bank: 'BOI', amount: 800000, issueDate: '2023-01-01', maturityDate: '2028-01-01' },
        land: { landType: 'OWNED' as const, landAreaSqm: 8500 },
        documents: {},
        missingOrFlaggedItems: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await store.saveProfile(profile);

      const westOfficerToken = await signJwt({
        sub: 'USR-OFFICER-WEST',
        role: 'OFFICER',
        name: 'Dr. Deshmukh',
        email: 'officer.west@aicte.gov.in',
        region: 'WEST',
      });

      // 1. Officer checks document risk
      const riskRes = await app.request(`/officer/${profileId}/risk`, {
        headers: bearer(westOfficerToken),
      });
      expect(riskRes.status).toBe(200);
      const riskData = (await riskRes.json()) as any;
      expect(riskData.riskAssessment.disclaimer).toContain('Risk indicators are assistive signals');

      // 2. Officer records ASK_CLARIFICATION with remarks (no auto-reject)
      const reviewRes = await app.request(`/officer/${profileId}/review`, {
        method: 'POST',
        headers: {
          ...bearer(westOfficerToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          decision: 'ASK_CLARIFICATION',
          remarks: 'Please provide certified true copy of conversion order from District Collectorate.',
        }),
      });
      expect(reviewRes.status).toBe(200);
      const reviewData = (await reviewRes.json()) as any;
      expect(reviewData.profile.officerReview.decision).toBe('ASK_CLARIFICATION');
      expect(reviewData.profile.status).toBe('UNDER_REVIEW');

      // Verify ledger entry (ids and hashes only)
      const ledger = await store.getLedger(profileId);
      const officerEntry = ledger.find((e) => e.eventType === 'OFFICER_REVIEW_RECORDED');
      expect(officerEntry).toBeDefined();
      expect(officerEntry?.payload.decision).toBe('ASK_CLARIFICATION');
    });
  });
});
