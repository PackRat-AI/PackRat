import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  admin: vi.fn(() => ({ id: 'admin' })),
  bearer: vi.fn(() => ({ id: 'bearer' })),
  betterAuth: vi.fn(() => ({ handler: vi.fn() })),
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
