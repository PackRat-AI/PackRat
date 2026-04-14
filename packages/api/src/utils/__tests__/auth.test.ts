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
// Mocks – bcrypt and the crypto random function are mocked so tests are
// deterministic. `jose` is used at runtime for real signing/verification.
// ---------------------------------------------------------------------------
vi.mock('node:crypto', () => ({
  randomBytes: vi.fn((length: number) => ({
    toString: (_encoding: string) => 'a'.repeat(length * 2),
  })),
}));

vi.mock('bcryptjs', () => ({
  hash: vi.fn((password: string) => Promise.resolve(`hashed_${password}`)),
  compare: vi.fn((password: string, hash: string) =>
    Promise.resolve(hash === `hashed_${password}`),
  ),
}));

vi.mock('../env-validation', () => ({
  getEnv: vi.fn(() => ({
    JWT_SECRET: 'test-secret-that-is-long-enough',
    PACKRAT_API_KEY: 'test-api-key',
  })),
}));

describe('auth utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateToken', () => {
    it('generates a hex token with default length', () => {
      expect(generateToken()).toBe('a'.repeat(64));
    });

    it('generates a hex token with custom length', () => {
      expect(generateToken(16)).toBe('a'.repeat(32));
    });
  });

  describe('generateRefreshToken', () => {
    it('generates an 80-character hex token', () => {
      expect(generateRefreshToken()).toBe('a'.repeat(80));
    });
  });

  describe('hashPassword', () => {
    it('hashes a password via bcrypt', async () => {
      const hash = await hashPassword('password123');
      expect(hash).toBe('hashed_password123');
    });
  });

  describe('verifyPassword', () => {
    it('returns true for matching password and hash', async () => {
      expect(await verifyPassword('password123', 'hashed_password123')).toBe(true);
    });

    it('returns false for non-matching password and hash', async () => {
      expect(await verifyPassword('password123', 'hashed_wrong')).toBe(false);
    });
  });

  describe('generateJWT / verifyJWT', () => {
    it('round-trips a payload through jose', async () => {
      const token = await generateJWT({ payload: { userId: 1, role: 'USER' } });
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);

      const payload = await verifyJWT({ token });
      expect(payload).not.toBeNull();
      expect(payload?.userId).toBe(1);
      expect(payload?.role).toBe('USER');
    });

    it('returns null for an invalid token', async () => {
      expect(await verifyJWT({ token: 'not.a.valid-token' })).toBeNull();
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
      vi.restoreAllMocks();
    });
  });

  describe('validatePassword', () => {
    it('accepts a valid password', () => {
      expect(validatePassword('StrongPass123')).toEqual({ valid: true });
    });

    it('rejects password shorter than 8 characters', () => {
      expect(validatePassword('Short1').valid).toBe(false);
    });

    it('rejects password without uppercase letter', () => {
      expect(validatePassword('lowercase123').valid).toBe(false);
    });

    it('rejects password without lowercase letter', () => {
      expect(validatePassword('UPPERCASE123').valid).toBe(false);
    });

    it('rejects password without number', () => {
      expect(validatePassword('NoNumbersHere').valid).toBe(false);
    });

    it('accepts password with special characters', () => {
      expect(validatePassword('Valid@Pass123')).toEqual({ valid: true });
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
    it('accepts a Headers instance with a matching key', () => {
      const headers = new Headers({ 'x-api-key': 'test-api-key' });
      expect(isValidApiKey(headers)).toBe(true);
    });

    it('accepts a plain header map with a matching key', () => {
      expect(isValidApiKey({ 'x-api-key': 'test-api-key' })).toBe(true);
    });

    it('rejects a non-matching key', () => {
      const headers = new Headers({ 'x-api-key': 'bogus' });
      expect(isValidApiKey(headers)).toBe(false);
    });

    it('rejects when the key header is missing', () => {
      expect(isValidApiKey(new Headers())).toBe(false);
    });

    it('rejects when PACKRAT_API_KEY is not configured', async () => {
      const { getEnv } = await import('../env-validation');
      vi.mocked(getEnv).mockReturnValueOnce({ PACKRAT_API_KEY: undefined } as never);
      expect(isValidApiKey(new Headers({ 'x-api-key': 'anything' }))).toBe(false);
    });
  });
});
