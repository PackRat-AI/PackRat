import { randomBytes } from 'node:crypto';
import { getEnv } from '@packrat/api/utils/env-validation';
import * as bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

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

// Generate a JWT token. The optional `c` parameter exists for backwards
// compatibility with legacy Hono routes that still pass a Context.
export async function generateJWT({
  payload,
  c,
  expiresIn = '7d',
}: {
  payload: Omit<JWTPayload, 'iat' | 'exp'> & { exp?: number };
  c?: { env?: Record<string, unknown> };
  expiresIn?: string;
}): Promise<string> {
  const { JWT_SECRET } = getEnv(c);
  const jwt = new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt();

  if (typeof payload.exp === 'number') {
    jwt.setExpirationTime(payload.exp);
  } else {
    jwt.setExpirationTime(expiresIn);
  }

  return jwt.sign(secretKey(JWT_SECRET));
}

// Verify a JWT token. The optional `c` is accepted for backwards compatibility.
export async function verifyJWT({
  token,
  c,
}: {
  token: string;
  c?: { env?: Record<string, unknown> };
}): Promise<JWTPayload | null> {
  try {
    const { JWT_SECRET } = getEnv(c);
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
export function validatePassword(password: string): {
  valid: boolean;
  message?: string;
} {
  if (password.length < 8) {
    return {
      valid: false,
      message: 'Password must be at least 8 characters long',
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one uppercase letter',
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one lowercase letter',
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one number',
    };
  }

  return { valid: true };
}

// Validate email format
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

type HonoContextLike = {
  req: { header: (name: string) => string | undefined };
  env?: Record<string, unknown>;
};

// Validate API key – accepts Headers (Elysia path), raw header map, or
// Hono Context (legacy routes).
export function isValidApiKey(
  input: Record<string, string | undefined> | Headers | HonoContextLike,
): boolean {
  let apiKeyHeader: string | undefined | null;

  if (input instanceof Headers) {
    apiKeyHeader = input.get('x-api-key');
  } else if (
    typeof input === 'object' &&
    input !== null &&
    'req' in input &&
    typeof (input as HonoContextLike).req?.header === 'function'
  ) {
    // Hono Context
    apiKeyHeader = (input as HonoContextLike).req.header('X-API-Key');
  } else {
    const headers = input as Record<string, string | undefined>;
    apiKeyHeader = headers['x-api-key'] ?? headers['X-API-Key'];
  }

  if (!apiKeyHeader) return false;
  const envForKey =
    typeof input === 'object' && input !== null && 'env' in input
      ? getEnv(input as { env?: Record<string, unknown> })
      : getEnv();
  const { PACKRAT_API_KEY } = envForKey;
  if (!PACKRAT_API_KEY) return false;
  return apiKeyHeader === PACKRAT_API_KEY;
}
