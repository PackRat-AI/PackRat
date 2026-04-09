import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@packrat/api/utils/env-validation', () => ({
  getEnv: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
  hash: vi.fn(),
  compare: vi.fn(),
}));

vi.mock('hono/jwt', () => ({
  sign: vi.fn(),
  verify: vi.fn(),
}));

import * as bcrypt from 'bcryptjs';
import { sign, verify } from 'hono/jwt';
import {
  generateJWT,
  generateRefreshToken,
  generateToken,
  generateVerificationCode,
  hashPassword,
  isValidApiKey,
  validateEmail,
  validatePassword,
  verifyJWT,
  verifyPassword,
} from '../auth';
import { getEnv } from '../env-validation';

// Mock Hono context
function makeMockContext(headers: Record<string, string> = {}) {
  return {
    req: {
      header: vi.fn((name: string) => headers[name]),
    },
    env: {},
  } as any;
}

describe('auth utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // generateToken
  // -------------------------------------------------------------------------
  describe('generateToken', () => {
    it('generates a random hex token', () => {
      const token = generateToken();
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it('generates token of default length 32 bytes (64 hex chars)', () => {
      const token = generateToken();
      expect(token.length).toBe(64); // 32 bytes = 64 hex characters
    });

    it('generates token of custom length', () => {
      const token = generateToken(16);
      expect(token.length).toBe(32); // 16 bytes = 32 hex characters
    });

    it('generates different tokens on each call', () => {
      const token1 = generateToken();
      const token2 = generateToken();
      expect(token1).not.toBe(token2);
    });

    it('generates token of length 1', () => {
      const token = generateToken(1);
      expect(token.length).toBe(2); // 1 byte = 2 hex characters
    });
  });

  // -------------------------------------------------------------------------
  // hashPassword
  // -------------------------------------------------------------------------
  describe('hashPassword', () => {
    it('hashes a password using bcrypt', async () => {
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed_password' as never);

      const result = await hashPassword('myPassword123');

      expect(bcrypt.hash).toHaveBeenCalledWith('myPassword123', 10);
      expect(result).toBe('hashed_password');
    });

    it('uses 10 salt rounds', async () => {
      vi.mocked(bcrypt.hash).mockResolvedValue('hash' as never);

      await hashPassword('test');

      expect(bcrypt.hash).toHaveBeenCalledWith('test', 10);
    });

    it('handles empty password', async () => {
      vi.mocked(bcrypt.hash).mockResolvedValue('hash_empty' as never);

      const result = await hashPassword('');

      expect(result).toBe('hash_empty');
    });

    it('handles special characters in password', async () => {
      vi.mocked(bcrypt.hash).mockResolvedValue('hash_special' as never);

      await hashPassword('p@$$w0rd!');

      expect(bcrypt.hash).toHaveBeenCalledWith('p@$$w0rd!', 10);
    });
  });

  // -------------------------------------------------------------------------
  // verifyPassword
  // -------------------------------------------------------------------------
  describe('verifyPassword', () => {
    it('verifies password successfully', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await verifyPassword('myPassword', 'hash');

      expect(bcrypt.compare).toHaveBeenCalledWith('myPassword', 'hash');
      expect(result).toBe(true);
    });

    it('returns false for incorrect password', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const result = await verifyPassword('wrongPassword', 'hash');

      expect(result).toBe(false);
    });

    it('handles empty password', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const result = await verifyPassword('', 'hash');

      expect(result).toBe(false);
    });

    it('handles empty hash', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const result = await verifyPassword('password', '');

      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // generateRefreshToken
  // -------------------------------------------------------------------------
  describe('generateRefreshToken', () => {
    it('generates a random hex token', () => {
      const token = generateRefreshToken();
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it('generates token of 40 bytes (80 hex chars)', () => {
      const token = generateRefreshToken();
      expect(token.length).toBe(80); // 40 bytes = 80 hex characters
    });

    it('generates different tokens on each call', () => {
      const token1 = generateRefreshToken();
      const token2 = generateRefreshToken();
      expect(token1).not.toBe(token2);
    });
  });

  // -------------------------------------------------------------------------
  // generateJWT
  // -------------------------------------------------------------------------
  describe('generateJWT', () => {
    it('generates JWT with payload and secret', async () => {
      const c = makeMockContext();
      vi.mocked(getEnv).mockReturnValue({ JWT_SECRET: 'my-secret' } as any);
      vi.mocked(sign).mockResolvedValue('jwt_token');

      const result = await generateJWT({ payload: { userId: 123 }, c });

      expect(getEnv).toHaveBeenCalledWith(c);
      expect(sign).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 123, exp: expect.any(Number) }),
        'my-secret',
      );
      expect(result).toBe('jwt_token');
    });

    it('sets expiration to 7 days from now', async () => {
      const c = makeMockContext();
      vi.mocked(getEnv).mockReturnValue({ JWT_SECRET: 'secret' } as any);
      vi.mocked(sign).mockResolvedValue('token');

      const beforeTime = Math.floor(Date.now() / 1000);
      await generateJWT({ payload: { userId: 1 }, c });
      const afterTime = Math.floor(Date.now() / 1000);

      const signCall = vi.mocked(sign).mock.calls[0]?.[0] as any;
      const exp = signCall.exp;

      // Should be approximately 7 days (604800 seconds) from now
      expect(exp).toBeGreaterThanOrEqual(beforeTime + 604800);
      expect(exp).toBeLessThanOrEqual(afterTime + 604800 + 1);
    });

    it('includes custom payload fields', async () => {
      const c = makeMockContext();
      vi.mocked(getEnv).mockReturnValue({ JWT_SECRET: 'secret' } as any);
      vi.mocked(sign).mockResolvedValue('token');

      await generateJWT({
        payload: { userId: 456, role: 'ADMIN', email: 'admin@test.com' },
        c,
      });

      const signCall = vi.mocked(sign).mock.calls[0]?.[0] as any;
      expect(signCall).toMatchObject({
        userId: 456,
        role: 'ADMIN',
        email: 'admin@test.com',
      });
    });
  });

  // -------------------------------------------------------------------------
  // verifyJWT
  // -------------------------------------------------------------------------
  describe('verifyJWT', () => {
    it('verifies valid JWT token', async () => {
      const c = makeMockContext();
      vi.mocked(getEnv).mockReturnValue({ JWT_SECRET: 'secret' } as any);
      vi.mocked(verify).mockResolvedValue({ userId: 123 });

      const result = await verifyJWT({ token: 'valid_token', c });

      expect(verify).toHaveBeenCalledWith('valid_token', 'secret');
      expect(result).toEqual({ userId: 123 });
    });

    it('returns null for invalid token', async () => {
      const c = makeMockContext();
      vi.mocked(getEnv).mockReturnValue({ JWT_SECRET: 'secret' } as any);
      vi.mocked(verify).mockRejectedValue(new Error('Invalid token'));

      const result = await verifyJWT({ token: 'invalid_token', c });

      expect(result).toBeNull();
    });

    it('returns null for expired token', async () => {
      const c = makeMockContext();
      vi.mocked(getEnv).mockReturnValue({ JWT_SECRET: 'secret' } as any);
      vi.mocked(verify).mockRejectedValue(new Error('Token expired'));

      const result = await verifyJWT({ token: 'expired_token', c });

      expect(result).toBeNull();
    });

    it('uses correct secret from environment', async () => {
      const c = makeMockContext();
      vi.mocked(getEnv).mockReturnValue({ JWT_SECRET: 'custom-secret-123' } as any);
      vi.mocked(verify).mockResolvedValue({ userId: 1 });

      await verifyJWT({ token: 'token', c });

      expect(verify).toHaveBeenCalledWith('token', 'custom-secret-123');
    });
  });

  // -------------------------------------------------------------------------
  // generateVerificationCode
  // -------------------------------------------------------------------------
  describe('generateVerificationCode', () => {
    it('generates numeric code of default length 6', () => {
      const code = generateVerificationCode();
      expect(code).toMatch(/^\d{6}$/);
    });

    it('generates numeric code of custom length', () => {
      const code = generateVerificationCode(4);
      expect(code).toMatch(/^\d{4}$/);
    });

    it('generates different codes on each call', () => {
      const code1 = generateVerificationCode();
      const code2 = generateVerificationCode();
      // Extremely unlikely to be equal
      expect(code1).not.toBe(code2);
    });

    it('generates code of length 1', () => {
      const code = generateVerificationCode(1);
      expect(code).toMatch(/^\d$/);
    });

    it('generates code of length 8', () => {
      const code = generateVerificationCode(8);
      expect(code).toMatch(/^\d{8}$/);
    });
  });

  // -------------------------------------------------------------------------
  // validatePassword
  // -------------------------------------------------------------------------
  describe('validatePassword', () => {
    it('validates strong password successfully', () => {
      const result = validatePassword('Strong123');
      expect(result).toEqual({ valid: true });
    });

    it('rejects password shorter than 8 characters', () => {
      const result = validatePassword('Short1');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('at least 8 characters');
    });

    it('rejects password without uppercase letter', () => {
      const result = validatePassword('lowercase123');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('uppercase letter');
    });

    it('rejects password without lowercase letter', () => {
      const result = validatePassword('UPPERCASE123');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('lowercase letter');
    });

    it('rejects password without number', () => {
      const result = validatePassword('NoNumbers');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('number');
    });

    it('accepts password with special characters', () => {
      const result = validatePassword('Strong123!@#');
      expect(result).toEqual({ valid: true });
    });

    it('accepts minimum valid password', () => {
      const result = validatePassword('Pass123w');
      expect(result).toEqual({ valid: true });
    });

    it('rejects empty password', () => {
      const result = validatePassword('');
      expect(result.valid).toBe(false);
    });

    it('accepts long strong password', () => {
      const result = validatePassword('VeryLongPassword123WithManyCharacters');
      expect(result).toEqual({ valid: true });
    });
  });

  // -------------------------------------------------------------------------
  // validateEmail
  // -------------------------------------------------------------------------
  describe('validateEmail', () => {
    it('validates correct email', () => {
      expect(validateEmail('user@example.com')).toBe(true);
    });

    it('validates email with subdomain', () => {
      expect(validateEmail('user@mail.example.com')).toBe(true);
    });

    it('validates email with plus sign', () => {
      expect(validateEmail('user+tag@example.com')).toBe(true);
    });

    it('validates email with dots', () => {
      expect(validateEmail('first.last@example.com')).toBe(true);
    });

    it('validates email with numbers', () => {
      expect(validateEmail('user123@example456.com')).toBe(true);
    });

    it('rejects email without @', () => {
      expect(validateEmail('userexample.com')).toBe(false);
    });

    it('rejects email without domain', () => {
      expect(validateEmail('user@')).toBe(false);
    });

    it('rejects email without extension', () => {
      expect(validateEmail('user@example')).toBe(false);
    });

    it('rejects email with spaces', () => {
      expect(validateEmail('user @example.com')).toBe(false);
    });

    it('rejects empty email', () => {
      expect(validateEmail('')).toBe(false);
    });

    it('rejects email starting with @', () => {
      expect(validateEmail('@example.com')).toBe(false);
    });

    it('rejects email with multiple @', () => {
      expect(validateEmail('user@@example.com')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // isValidApiKey
  // -------------------------------------------------------------------------
  describe('isValidApiKey', () => {
    it('validates correct API key', () => {
      const c = makeMockContext({ 'X-API-Key': 'valid-key' });
      vi.mocked(getEnv).mockReturnValue({ PACKRAT_API_KEY: 'valid-key' } as any);

      const result = isValidApiKey(c);

      expect(result).toBe(true);
    });

    it('rejects incorrect API key', () => {
      const c = makeMockContext({ 'X-API-Key': 'wrong-key' });
      vi.mocked(getEnv).mockReturnValue({ PACKRAT_API_KEY: 'correct-key' } as any);

      const result = isValidApiKey(c);

      expect(result).toBe(false);
    });

    it('returns false when no API key header provided', () => {
      const c = makeMockContext({});
      vi.mocked(getEnv).mockReturnValue({ PACKRAT_API_KEY: 'key' } as any);

      const result = isValidApiKey(c);

      expect(result).toBe(false);
    });

    it('returns false when PACKRAT_API_KEY not set', () => {
      const c = makeMockContext({ 'X-API-Key': 'some-key' });
      vi.mocked(getEnv).mockReturnValue({ PACKRAT_API_KEY: '' } as any);

      const result = isValidApiKey(c);

      expect(result).toBe(false);
    });

    it('returns false when both header and env are missing', () => {
      const c = makeMockContext({});
      vi.mocked(getEnv).mockReturnValue({ PACKRAT_API_KEY: '' } as any);

      const result = isValidApiKey(c);

      expect(result).toBe(false);
    });

    it('checks exact match (case-sensitive)', () => {
      const c = makeMockContext({ 'X-API-Key': 'MyKey' });
      vi.mocked(getEnv).mockReturnValue({ PACKRAT_API_KEY: 'mykey' } as any);

      const result = isValidApiKey(c);

      expect(result).toBe(false);
    });
  });
});
