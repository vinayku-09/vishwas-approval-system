import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const DEV_FALLBACK_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function getEncryptionKey(): Buffer {
  const envKey = process.env.BANK_ENCRYPTION_KEY;
  if (envKey && envKey.trim().length >= 32) {
    // If 64 hex chars, parse as hex; otherwise take 32 bytes from utf8
    if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
      return Buffer.from(envKey, 'hex');
    }
    return crypto.createHash('sha256').update(envKey).digest();
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('BANK_ENCRYPTION_KEY (32-byte key) is strictly required in production');
  }

  return Buffer.from(DEV_FALLBACK_KEY, 'hex');
}

/**
 * Returns masked account number showing only the last 4 digits (e.g. ••••••••1234).
 */
export function maskBankAccount(accountNumber: string): string {
  const clean = accountNumber.replace(/[\s-]/g, '');
  if (clean.length <= 4) {
    return '••••' + clean;
  }
  const lastFour = clean.slice(-4);
  const maskLength = Math.max(4, clean.length - 4);
  return '•'.repeat(maskLength) + lastFour;
}

/**
 * Encrypts a bank account number at rest using AES-256-GCM.
 * Returns both the encrypted ciphertext payload (iv:tag:ciphertext) and masked display string.
 */
export function encryptBankAccount(accountNumber: string): {
  encrypted: string;
  masked: string;
} {
  const clean = accountNumber.trim();
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(clean, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload = `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  const masked = maskBankAccount(clean);

  return {
    encrypted: payload,
    masked,
  };
}

/**
 * Decrypts an encrypted bank account payload.
 * Should only be used when authorized or internally verified. Never expose in logs/ledger/emails.
 */
export function decryptBankAccount(encryptedPayload: string): string {
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted bank payload format');
  }

  const [ivHex, tagHex, cipherHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(cipherHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
