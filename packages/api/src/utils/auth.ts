import { randomBytes } from 'node:crypto';
import { getEnv } from '@packrat/api/utils/env-validation';
import * as bcrypt from 'bcryptjs';
import type { Context } from 'hono';
import { sign, verify } from 'hono/jwt';
import type { JWTPayload } from 'hono/utils/jwt/types';

// Generate a random token
export function generateToken(length = 32): string {
  return randomBytes(length).toString('hex');
}

// Hash a password using bcrypt
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

// Verify a password against a hash
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

// Generate a refresh token
export function generateRefreshToken(): string {
  return randomBytes(40).toString('hex');
}

// Generate a JWT token{
export async function generateJWT({
  payload,
  c,
}: {
  payload: JWTPayload;
  c: Context;
}): Promise<string> {
  const { JWT_SECRET } = getEnv(c);
  return await sign(
    {
      ...payload,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
    },
    JWT_SECRET,
  );
}

// Verify a JWT token
export async function verifyJWT({
  token,
  c,
}: {
  token: string;
  c: Context;
}): Promise<JWTPayload | null> {
  try {
    const { JWT_SECRET } = getEnv(c);
    return await verify(token, JWT_SECRET);
  } catch (_error) {
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
