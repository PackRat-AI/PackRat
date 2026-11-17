import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  admin: vi.fn(() => ({ id: 'admin' })),
  bearer: vi.fn(() => ({ id: 'bearer' })),
  betterAuth: vi.fn((_options: { secondaryStorage?: SecondaryStorage }) => ({ handler: vi.fn() })),
  createConnection: vi.fn(() => ({ db: true })),
  drizzleAdapter: vi.fn(() => ({ adapter: true })),
  expo: vi.fn(() => ({ id: 'expo' })),
  generateAppleClientSecret: vi.fn(async () => null),
  jwt: vi.fn(() => ({ id: 'jwt' })),
  oauthProvider: vi.fn(() => ({ id: 'oauth-provider' })),
}));

vi.mock('@better-auth/drizzle-adapter', () => ({
  drizzleAdapter: mocks.drizzleAdapter,
}));

vi.mock('@better-auth/expo', () => ({
  expo: mocks.expo,
}));

vi.mock('@better-auth/oauth-provider', () => ({
  oauthProvider: mocks.oauthProvider,
}));

vi.mock('@packrat/api/auth/auth.helpers', () => ({
  generateAppleClientSecret: mocks.generateAppleClientSecret,
  verifyPasswordCompat: vi.fn(),
}));

vi.mock('@packrat/api/db', () => ({
  createConnection: mocks.createConnection,
}));

vi.mock('@packrat/db', () => ({
  account: { name: 'account' },
  jwks: { name: 'jwks' },
  oauthAccessToken: { name: 'oauthAccessToken' },
  oauthClient: { name: 'oauthClient' },
  oauthConsent: { name: 'oauthConsent' },
  oauthRefreshToken: { name: 'oauthRefreshToken' },
  session: { name: 'session' },
  users: { name: 'users' },
  verification: { name: 'verification' },
}));

vi.mock('better-auth', () => ({
  betterAuth: mocks.betterAuth,
}));

vi.mock('better-auth/plugins', () => ({
  admin: mocks.admin,
  bearer: mocks.bearer,
  jwt: mocks.jwt,
}));

const { getAuth } = await import('../index');

const authKv = {
  delete: vi.fn(async () => {}),
  get: vi.fn(async () => null),
  getWithMetadata: vi.fn(
    async (): Promise<{ value: string | null; metadata: { expiresAt?: number } | null }> => ({
      value: null,
      metadata: null,
    }),
  ),
  put: vi.fn(async () => {}),
};

function makeEnv(): ValidatedEnv {
  return {
    AUTH_KV: authKv,
    BETTER_AUTH_TRUSTED_ORIGINS: 'http://localhost:8081',
    ENVIRONMENT: 'test',
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
    NEON_DATABASE_URL: `postgres://test-${crypto.randomUUID()}`,
    PACKRAT_API_URL: 'http://localhost:8787',
    PACKRAT_AUTH_SECRET: 'test-better-auth-secret-at-least-32-chars',
  } as unknown as ValidatedEnv;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAuth session storage config', () => {
  it('keeps sessions in the database when secondaryStorage is enabled', async () => {
    await getAuth(makeEnv());

    expect(mocks.betterAuth).toHaveBeenCalledTimes(1);
    expect(mocks.betterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        secondaryStorage: expect.objectContaining({
          delete: expect.any(Function),
          get: expect.any(Function),
          set: expect.any(Function),
        }),
        session: { storeSessionInDatabase: true },
      }),
    );
    expect(mocks.oauthProvider).toHaveBeenCalled();
  });
});

type SecondaryStorage = { increment: (key: string, ttl: number) => Promise<number> };

async function secondaryStorage(): Promise<SecondaryStorage> {
  await getAuth(makeEnv());
  const storage = mocks.betterAuth.mock.lastCall?.[0].secondaryStorage;
  if (!storage) throw new Error('secondaryStorage was not configured');
  return storage;
}

describe('secondaryStorage.increment', () => {
  const now = 1_800_000_000;

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(now * 1000);
  });

  it('starts a window that ends ttl seconds from now', async () => {
    const storage = await secondaryStorage();

    await expect(storage.increment('ip|/sign-in/email', 60)).resolves.toBe(1);

    expect(authKv.put).toHaveBeenCalledWith('ip|/sign-in/email', '1', {
      expiration: now + 60,
      metadata: { expiresAt: now + 60 },
    });
  });

  it('keeps the original window end on later increments', async () => {
    const storage = await secondaryStorage();
    authKv.getWithMetadata.mockResolvedValueOnce({
      value: '3',
      metadata: { expiresAt: now + 90 },
    });

    await expect(storage.increment('ip|/sign-in/email', 300)).resolves.toBe(4);

    expect(authKv.put).toHaveBeenCalledWith('ip|/sign-in/email', '4', {
      expiration: now + 90,
      metadata: { expiresAt: now + 90 },
    });
  });

  it('holds the expiration at the 60-second KV minimum near the window end', async () => {
    const storage = await secondaryStorage();
    authKv.getWithMetadata.mockResolvedValueOnce({
      value: '2',
      metadata: { expiresAt: now + 10 },
    });

    await storage.increment('ip|/sign-in/email', 60);

    expect(authKv.put).toHaveBeenCalledWith('ip|/sign-in/email', '3', {
      expiration: now + 60,
      metadata: { expiresAt: now + 10 },
    });
  });

  it('resets a counter left without an expiry by the old code', async () => {
    const storage = await secondaryStorage();
    authKv.getWithMetadata.mockResolvedValueOnce({ value: '500', metadata: null });

    await expect(storage.increment('ip|/sign-in/email', 60)).resolves.toBe(1);

    expect(authKv.put).toHaveBeenCalledWith('ip|/sign-in/email', '1', {
      expiration: now + 60,
      metadata: { expiresAt: now + 60 },
    });
  });
});
