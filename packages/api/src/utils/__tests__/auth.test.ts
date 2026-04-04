import { beforeEach, describe, expect, it, vi } from 'vitest';
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

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('node:crypto', () => ({
  randomBytes: vi.fn((length: number) => ({
    toString: (encoding: string) => 'a'.repeat(length * 2),
  })),
}));

vi.mock('bcryptjs', () => ({
  hash: vi.fn((password: string) => Promise.resolve(`hashed_${password}`)),
  compare: vi.fn((password: string, hash: string) => Promise.resolve(hash === `hashed_${password}`)),
}));

vi.mock('hono/jwt', () => ({
  sign: vi.fn((payload: any, secret: string) => Promise.resolve('signed_token')),
  verify: vi.fn((token: string, secret: string) => {
    if (token === 'valid_token') {
      return Promise.resolve({ userId: 1, role: 'USER' });
    }
    throw new Error('Invalid token');
  }),
}));

vi.mock('@packrat/api/utils/env-validation', () => ({
  getEnv: vi.fn(() => ({
    JWT_SECRET: 'test-secret',
    PACKRAT_API_KEY: 'test-api-key',
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockContext() {
  return {
    req: {
      header: vi.fn((key: string) => {
        if (key === 'X-API-Key') return 'test-api-key';
        return undefined;
      }),
    },
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('auth utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateToken', () => {
    it('generates a hex token with default length', () => {
      const token = generateToken();
      expect(token).toBe('a'.repeat(64)); // 32 bytes * 2 hex chars
    });

    it('generates a hex token with custom length', () => {
      const token = generateToken(16);
      expect(token).toBe('a'.repeat(32)); // 16 bytes * 2 hex chars
    });
  });

  describe('generateRefreshToken', () => {
    it('generates a 40-byte hex token', () => {
      const token = generateRefreshToken();
      expect(token).toBe('a'.repeat(80)); // 40 bytes * 2 hex chars
    });
  });

  describe('hashPassword', () => {
    it('hashes a password', async () => {
      const hash = await hashPassword('password123');
      expect(hash).toBe('hashed_password123');
    });

    it('uses bcrypt to hash the password', async () => {
      const bcrypt = await import('bcryptjs');
      await hashPassword('test');
      expect(bcrypt.hash).toHaveBeenCalledWith('test', 10);
    });
  });

  describe('verifyPassword', () => {
    it('returns true for matching password and hash', async () => {
      const result = await verifyPassword('password123', 'hashed_password123');
      expect(result).toBe(true);
    });

    it('returns false for non-matching password and hash', async () => {
      const result = await verifyPassword('password123', 'hashed_wrong');
      expect(result).toBe(false);
    });
  });

  describe('generateJWT', () => {
    it('generates a JWT with payload and expiry', async () => {
      const c = makeMockContext();
      const token = await generateJWT({
        payload: { userId: 1, role: 'USER' },
        c,
      });

      expect(token).toBe('signed_token');

      const { sign } = await import('hono/jwt');
      expect(sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          role: 'USER',
          exp: expect.any(Number),
        }),
        'test-secret',
      );
    });

    it('sets expiry to 7 days from now', async () => {
      const c = makeMockContext();
      const beforeTime = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;

      await generateJWT({
        payload: { userId: 1 },
        c,
      });

      const { sign } = await import('hono/jwt');
      const callArgs = (sign as ReturnType<typeof vi.fn>).mock.calls[0][0];

      expect(callArgs.exp).toBeGreaterThanOrEqual(beforeTime - 5);
      expect(callArgs.exp).toBeLessThanOrEqual(beforeTime + 5);
    });
  });

  describe('verifyJWT', () => {
    it('returns payload for valid token', async () => {
      const c = makeMockContext();
      const payload = await verifyJWT({ token: 'valid_token', c });

      expect(payload).toEqual({ userId: 1, role: 'USER' });
    });

    it('returns null for invalid token', async () => {
      const c = makeMockContext();
      const payload = await verifyJWT({ token: 'invalid_token', c });

      expect(payload).toBeNull();
    });
  });

  describe('generateVerificationCode', () => {
    it('generates a 6-digit code by default', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const code = generateVerificationCode();

      expect(code).toHaveLength(6);
      expect(code).toMatch(/^\d+$/);

      vi.restoreAllMocks();
    });

    it('generates a code of custom length', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const code = generateVerificationCode(4);

      expect(code).toHaveLength(4);
      expect(code).toMatch(/^\d+$/);

      vi.restoreAllMocks();
    });
  });

  describe('validatePassword', () => {
    it('accepts a valid password', () => {
      const result = validatePassword('StrongPass123');
      expect(result).toEqual({ valid: true });
    });

    it('rejects password shorter than 8 characters', () => {
      const result = validatePassword('Short1');
      expect(result).toEqual({
        valid: false,
        message: 'Password must be at least 8 characters long',
      });
    });

    it('rejects password without uppercase letter', () => {
      const result = validatePassword('lowercase123');
      expect(result).toEqual({
        valid: false,
        message: 'Password must contain at least one uppercase letter',
      });
    });

    it('rejects password without lowercase letter', () => {
      const result = validatePassword('UPPERCASE123');
      expect(result).toEqual({
        valid: false,
        message: 'Password must contain at least one lowercase letter',
      });
    });

    it('rejects password without number', () => {
      const result = validatePassword('NoNumbersHere');
      expect(result).toEqual({
        valid: false,
        message: 'Password must contain at least one number',
      });
    });

    it('accepts password with special characters', () => {
      const result = validatePassword('Valid@Pass123');
      expect(result).toEqual({ valid: true });
    });
  });

  describe('validateEmail', () => {
    it('accepts valid email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
      expect(validateEmail('test+tag@example.com')).toBe(true);
    });

    it('rejects invalid email addresses', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('invalid@')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('test @example.com')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });
  });

  describe('isValidApiKey', () => {
    it('returns true when API key matches', () => {
      const c = makeMockContext();
      expect(isValidApiKey(c)).toBe(true);
    });

    it('returns false when API key is missing', () => {
      const c = {
        req: { header: vi.fn(() => undefined) },
      } as any;
      expect(isValidApiKey(c)).toBe(false);
    });

    it('returns false when API key does not match', () => {
      const c = {
        req: { header: vi.fn(() => 'wrong-key') },
      } as any;
      expect(isValidApiKey(c)).toBe(false);
    });

    it('returns false when PACKRAT_API_KEY env var is not set', () => {
      const { getEnv } = require('@packrat/api/utils/env-validation');
      getEnv.mockReturnValueOnce({ PACKRAT_API_KEY: undefined });

      const c = makeMockContext();
      expect(isValidApiKey(c)).toBe(false);
    });
  });
});
