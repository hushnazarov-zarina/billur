import crypto from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(crypto.scrypt) as (
  password: string, salt: string, keylen: number
) => Promise<Buffer>;

const SCRYPT_KEYLEN = 64;

export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scryptAsync(plain, salt, SCRYPT_KEYLEN)).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored || !plain) return false;
  if (!stored.startsWith('scrypt:')) return false;
  const parts = stored.split(':');
  if (parts.length !== 3) return false;
  const [, salt, hashHex] = parts;
  try {
    const test = await scryptAsync(plain, salt, SCRYPT_KEYLEN);
    const stor = Buffer.from(hashHex, 'hex');
    if (stor.length !== test.length) return false;
    return crypto.timingSafeEqual(stor, test);
  } catch {
    return false;
  }
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// QR token: workerId.issuedAt.nonce.hmac
export function generateQrToken(workerId: string): string {
  const secret = process.env.QR_SECRET;
  if (!secret) throw new Error('QR_SECRET not configured');
  const issuedAt = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(8).toString('hex');
  const payload = `${workerId}.${issuedAt}.${nonce}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 16);
  return `${payload}.${hmac}`;
}

export function validateQrToken(token: string): {
  valid: boolean;
  workerId?: string;
  issuedAt?: number;
  error?: string;
} {
  const secret = process.env.QR_SECRET;
  if (!secret) return { valid: false, error: 'config' };
  const parts = token.split('.');
  if (parts.length !== 4) return { valid: false, error: 'format' };
  const [workerId, issuedAtStr, nonce, hmac] = parts;
  const expected = crypto.createHmac('sha256', secret)
    .update(`${workerId}.${issuedAtStr}.${nonce}`)
    .digest('hex').slice(0, 16);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) {
      return { valid: false, error: 'hmac' };
    }
  } catch {
    return { valid: false, error: 'hmac' };
  }
  return { valid: true, workerId, issuedAt: parseInt(issuedAtStr) };
}
