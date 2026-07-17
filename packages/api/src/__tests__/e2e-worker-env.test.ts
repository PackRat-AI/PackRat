import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  addCorsHeaders: vi.fn(({ response }) => response),
  appFetch: vi.fn(async () => new Response('app')),
  authHandler: vi.fn(async () => new Response('auth')),
  corsPreflightResponse: vi.fn(() => null),
  getAuth: vi.fn(),
  getEnv: vi.fn(),
  setWorkerEnv: vi.fn(),
}));

vi.mock('@packrat/api/app', () => ({
  addCorsHeaders: mocks.addCorsHeaders,
  appBase: { fetch: mocks.appFetch },
  corsPreflightResponse: mocks.corsPreflightResponse,
}));

vi.mock('@packrat/api/auth', () => ({
  getAuth: mocks.getAuth,
}));

vi.mock('@packrat/api/utils/env-validation', () => ({
  getEnv: mocks.getEnv,
  setWorkerEnv: mocks.setWorkerEnv,
}));

vi.mock('@better-auth/oauth-provider', () => ({
  oauthProviderAuthServerMetadata: vi.fn(() => mocks.authHandler),
  oauthProviderOpenIdConfigMetadata: vi.fn(() => mocks.authHandler),
}));

const worker = (await import('../e2e-worker')).default;

const rawEnv = {
  BETTER_AUTH_SECRET: 'e2e-better-auth-secret-at-least-32-chars',
  BETTER_AUTH_URL: 'http://localhost:8787',
  NODE_ENV: 'test',
  OSM_HYPERDRIVE: { connectionString: 'postgres://user:pass@localhost/osm' },
};

const validatedEnv = {
  ...rawEnv,
  OSM_DATABASE_URL: 'postgres://user:pass@localhost/osm',
  PACKRAT_API_URL: 'http://localhost:8787',
  PACKRAT_AUTH_SECRET: 'e2e-better-auth-secret-at-least-32-chars',
};

const ctx = {
  passThroughOnException: vi.fn(),
  waitUntil: vi.fn(),
} as unknown as ExecutionContext;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getEnv.mockReturnValue(validatedEnv);
  mocks.getAuth.mockResolvedValue({ handler: mocks.authHandler });
});

describe('e2e worker env normalization', () => {
  it('normalizes env before Better Auth handles auth requests', async () => {
    const request = new Request('http://localhost:8787/api/auth/sign-in/email', {
      method: 'POST',
    });

    const response = await worker.fetch(request, rawEnv as never, ctx);

    expect(await response.text()).toBe('auth');
    expect(mocks.getEnv).toHaveBeenCalledWith({
      ...rawEnv,
      OSM_DATABASE_URL: 'postgres://user:pass@localhost/osm',
    });
    expect(mocks.setWorkerEnv).toHaveBeenCalledWith(validatedEnv);
    expect(mocks.getAuth).toHaveBeenCalledWith(validatedEnv);
    expect(mocks.authHandler).toHaveBeenCalledWith(request);
    expect(mocks.addCorsHeaders).toHaveBeenCalledWith({ request, response });
  });

  it('passes the normalized env to app routes', async () => {
    const request = new Request('http://localhost:8787/api/packs');

    const response = await worker.fetch(request, rawEnv as never, ctx);

    expect(await response.text()).toBe('app');
    expect(mocks.appFetch).toHaveBeenCalledWith(request, validatedEnv, ctx);
  });

  it('serves auth-mounted OAuth metadata with normalized env', async () => {
    mocks.authHandler.mockResolvedValueOnce(
      Response.json({ issuer: 'http://localhost:8787/api/auth' }),
    );
    const request = new Request(
      'http://localhost:8787/.well-known/oauth-authorization-server/api/auth',
    );

    const response = await worker.fetch(request, rawEnv as never, ctx);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      issuer: 'http://localhost:8787/api/auth',
    });
    expect(mocks.getAuth).toHaveBeenCalledWith(validatedEnv);
    expect(mocks.authHandler).toHaveBeenCalledWith(request);
    expect(mocks.appFetch).not.toHaveBeenCalled();
  });
});
