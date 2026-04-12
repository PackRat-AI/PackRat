import { randomBytes } from 'node:crypto';
import { getEnv } from '@packrat/api/utils/env-validation';
import * as bcrypt from 'bcryptjs';
import { jwtVerify, SignJWT } from 'jose';

export type JWTPayload = {
  userId: number;
  role?: 'USER' | 'ADMIN';
  exp?: number;
  iat?: number;
  [key: string]: unknown;
};

// Generate a random token
export function generateToken(length = 32): string {
  return randomBytes(length).toString('hex');
}

// Hash a password using bcrypt
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

// Verify a password against a hash
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Generate a refresh token
export function generateRefreshToken(): string {
  return randomBytes(40).toString('hex');
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

// Generate a JWT token
export async function generateJWT({
  payload,
  expiresIn = '7d',
}: {
  payload: Omit<JWTPayload, 'iat' | 'exp'> & { exp?: number };
  expiresIn?: string;
}): Promise<string> {
  const { JWT_SECRET } = getEnv();
  const jwt = new SignJWT({ ...payload }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt();

  if (typeof payload.exp === 'number') {
    jwt.setExpirationTime(payload.exp);
  } else {
    jwt.setExpirationTime(expiresIn);
  }

  return jwt.sign(secretKey(JWT_SECRET));
}

// Verify a JWT token
export async function verifyJWT({ token }: { token: string }): Promise<JWTPayload | null> {
  try {
    const { JWT_SECRET } = getEnv();
    const { payload } = await jwtVerify(token, secretKey(JWT_SECRET), {
      algorithms: ['HS256'],
    });
    return payload as JWTPayload;
  } catch {
    return null;
  }
}

// Generate a random numeric verification code
export function generateVerificationCode(length = 6): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

// Validate password strength
const HAS_UPPERCASE = /[A-Z]/;
const HAS_LOWERCASE = /[a-z]/;
const HAS_DIGIT = /[0-9]/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validatePassword(password: string): {
  valid: boolean;
  message?: string;
} {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!HAS_UPPERCASE.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!HAS_LOWERCASE.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!HAS_DIGIT.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  return { valid: true };
}

// Validate email format
export function validateEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

/**
 * Validate API key from either a `Headers` instance (Elysia path) or a raw
 * header map.
 */
export function isValidApiKey(headers: Headers | Record<string, string | undefined>): boolean {
  let apiKeyHeader: string | undefined | null;
  if (headers instanceof Headers) {
    apiKeyHeader = headers.get('x-api-key');
  } else {
    apiKeyHeader = headers['x-api-key'] ?? headers['X-API-Key'];
  }
  if (!apiKeyHeader) return false;
  const { PACKRAT_API_KEY } = getEnv();
  if (!PACKRAT_API_KEY) return false;
  return apiKeyHeader === PACKRAT_API_KEY;
}
