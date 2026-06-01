import { describe, expect, it, vi } from 'vitest';
import { hashPassword, isValidApiKey, verifyPassword } from '../auth';

vi.mock('bcryptjs', () => ({
  hash: vi.fn((password: string) => Promise.resolve(`hashed_${password}`)),
  compare: vi.fn((password: string, hash: string) =>
    Promise.resolve(hash === `hashed_${password}`),
  ),
}));

vi.mock('../env-validation', () => ({
  getEnv: vi.fn(() => ({
    PACKRAT_API_KEY: 'test-api-key',
  })),
}));

describe('auth utilities', () => {
  describe('hashPassword / verifyPassword', () => {
    it('hashes a password via bcrypt', async () => {
      const hash = await hashPassword('password123');
      expect(hash).toBe('hashed_password123');
    });

    it('verifies a matching password', async () => {
      expect(await verifyPassword({ password: 'password123', hash: 'hashed_password123' })).toBe(
        true,
      );
    });

    it('rejects a non-matching password', async () => {
      expect(await verifyPassword({ password: 'password123', hash: 'hashed_wrong' })).toBe(false);
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
      (getEnv as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        PACKRAT_API_KEY: undefined,
      } as never);
      expect(isValidApiKey(new Headers({ 'x-api-key': 'anything' }))).toBe(false);
    });

    it('accepts a plain header map with uppercase X-API-Key', () => {
      expect(isValidApiKey({ 'X-API-Key': 'test-api-key' })).toBe(true);
    });
  });
});
