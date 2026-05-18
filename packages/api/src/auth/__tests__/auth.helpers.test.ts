import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  bcryptCompare: vi.fn<[string, string], Promise<boolean>>(),
  verifyPassword: vi.fn<[string, string], Promise<boolean>>(),
  importPKCS8: vi.fn(),
  signJwt: vi.fn(),
}));

vi.mock('bcryptjs', () => ({ compare: mocks.bcryptCompare }));
vi.mock('@better-auth/utils/password', () => ({ verifyPassword: mocks.verifyPassword }));
vi.mock('jose', () => ({
  importPKCS8: mocks.importPKCS8,
  SignJWT: vi.fn(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setIssuer: vi.fn().mockReturnThis(),
    setSubject: vi.fn().mockReturnThis(),
    setAudience: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    sign: mocks.signJwt,
  })),
}));

import { generateAppleClientSecret, verifyPasswordCompat } from '../auth.helpers';

describe('verifyPasswordCompat()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses bcrypt for $2a$ hashes', async () => {
    mocks.bcryptCompare.mockResolvedValue(true);
    const result = await verifyPasswordCompat({ hash: '$2a$10$abc', password: 'pw' });
    expect(mocks.bcryptCompare).toHaveBeenCalledWith('pw', '$2a$10$abc');
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('uses bcrypt for $2b$ hashes', async () => {
    mocks.bcryptCompare.mockResolvedValue(false);
    const result = await verifyPasswordCompat({ hash: '$2b$12$xyz', password: 'wrong' });
    expect(mocks.bcryptCompare).toHaveBeenCalledWith('wrong', '$2b$12$xyz');
    expect(result).toBe(false);
  });

  it('uses bcrypt for $2y$ hashes', async () => {
    mocks.bcryptCompare.mockResolvedValue(true);
    await verifyPasswordCompat({ hash: '$2y$10$hash', password: 'pw' });
    expect(mocks.bcryptCompare).toHaveBeenCalled();
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
  });

  it('uses better-auth verifyPassword for non-bcrypt hashes', async () => {
    mocks.verifyPassword.mockResolvedValue(true);
    const result = await verifyPasswordCompat({ hash: 'argon2:somehash', password: 'pw' });
    expect(mocks.verifyPassword).toHaveBeenCalledWith('argon2:somehash', 'pw');
    expect(mocks.bcryptCompare).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('returns false from better-auth verifyPassword on mismatch', async () => {
    mocks.verifyPassword.mockResolvedValue(false);
    const result = await verifyPasswordCompat({ hash: 'scrypt:somehash', password: 'bad' });
    expect(result).toBe(false);
  });
});

describe('generateAppleClientSecret()', () => {
  const baseEnv = {
    APPLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----',
    APPLE_KEY_ID: 'KEYID123',
    APPLE_TEAM_ID: 'TEAMID456',
    APPLE_CLIENT_ID: 'com.example.app',
  };

  beforeEach(() => vi.clearAllMocks());

  it('returns null when APPLE_PRIVATE_KEY is not set', async () => {
    const result = await generateAppleClientSecret({ APPLE_PRIVATE_KEY: '' } as never);
    expect(result).toBeNull();
    expect(mocks.importPKCS8).not.toHaveBeenCalled();
  });

  it('returns a signed JWT string on success', async () => {
    const fakeKey = {};
    mocks.importPKCS8.mockResolvedValue(fakeKey);
    mocks.signJwt.mockResolvedValue('signed.jwt.token');

    const result = await generateAppleClientSecret(baseEnv as never);
    expect(result).toBe('signed.jwt.token');
    expect(mocks.importPKCS8).toHaveBeenCalledWith(baseEnv.APPLE_PRIVATE_KEY, 'ES256');
    expect(mocks.signJwt).toHaveBeenCalledWith(fakeKey);
  });

  it('returns null and warns when importPKCS8 throws', async () => {
    mocks.importPKCS8.mockRejectedValue(new Error('bad key'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await generateAppleClientSecret(baseEnv as never);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Apple client-secret generation failed'),
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });

  it('returns null and warns when sign throws', async () => {
    mocks.importPKCS8.mockResolvedValue({});
    mocks.signJwt.mockRejectedValue(new Error('sign failed'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await generateAppleClientSecret(baseEnv as never);
    expect(result).toBeNull();
    warnSpy.mockRestore();
  });
});
