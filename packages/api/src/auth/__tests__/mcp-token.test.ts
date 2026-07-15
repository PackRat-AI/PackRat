import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createDb: vi.fn(),
  createRemoteJWKSet: vi.fn(),
  eq: vi.fn(),
  jwtVerify: vi.fn(),
  limit: vi.fn(),
  select: vi.fn(),
}));

vi.mock('@packrat/api/db', () => ({
  createDb: mocks.createDb,
}));

vi.mock('@packrat/db', () => ({
  users: {
    id: 'users.id',
    role: 'users.role',
    email: 'users.email',
    name: 'users.name',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: mocks.eq,
}));

vi.mock('jose', () => ({
  createRemoteJWKSet: mocks.createRemoteJWKSet,
  jwtVerify: mocks.jwtVerify,
}));

const { __resetMcpJwksCacheForTests, resolveMcpBearerUser } = await import('../mcp-token');

const env = {
  PACKRAT_API_URL: 'https://api.packrat.world/',
} as ValidatedEnv;

const bearerRequest = (token = 'token') =>
  new Request('https://api.packrat.world/user/profile', {
    headers: { authorization: `Bearer ${token}` },
  });

function mockUserRows(rows: unknown[]) {
  mocks.limit.mockResolvedValueOnce(rows);
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetMcpJwksCacheForTests();
  mocks.createRemoteJWKSet.mockReturnValue({ jwks: true });
  mocks.eq.mockReturnValue({ eq: true });
  mocks.createDb.mockReturnValue({
    select: mocks.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: mocks.limit,
        }),
      }),
    }),
  });
});

describe('resolveMcpBearerUser', () => {
  it('returns null without a Bearer authorization header', async () => {
    const result = await resolveMcpBearerUser({
      env,
      request: new Request('https://api.packrat.world/user/profile'),
    });

    expect(result).toBeNull();
    expect(mocks.jwtVerify).not.toHaveBeenCalled();
  });

  it('returns null when JWT verification fails', async () => {
    mocks.jwtVerify.mockRejectedValueOnce(new Error('bad token'));

    const result = await resolveMcpBearerUser({ env, request: bearerRequest() });

    expect(result).toBeNull();
  });

  it('requires a subject and MCP scope before querying the DB', async () => {
    mocks.jwtVerify.mockResolvedValueOnce({ payload: { sub: '', scope: 'mcp:read' } });
    expect(await resolveMcpBearerUser({ env, request: bearerRequest() })).toBeNull();

    mocks.jwtVerify.mockResolvedValueOnce({ payload: { sub: 'user-1', scope: 'profile' } });
    expect(await resolveMcpBearerUser({ env, request: bearerRequest() })).toBeNull();

    expect(mocks.createDb).not.toHaveBeenCalled();
  });

  it('resolves a normal MCP-scoped token to an auth user', async () => {
    mocks.jwtVerify.mockResolvedValueOnce({
      payload: { sub: 'user-1', scope: 'mcp:read mcp:write' },
    });
    mockUserRows([{ id: 'user-1', role: 'USER', email: 'u@example.com', name: 'User One' }]);

    const result = await resolveMcpBearerUser({ env, request: bearerRequest('abc') });

    expect(result).toEqual({
      userId: 'user-1',
      role: 'USER',
      email: 'u@example.com',
      name: 'User One',
    });
    expect(mocks.createRemoteJWKSet).toHaveBeenCalledWith(
      new URL('https://api.packrat.world/api/auth/jwks'),
      { cacheMaxAge: 60_000 },
    );
    expect(mocks.jwtVerify).toHaveBeenCalledWith(
      'abc',
      { jwks: true },
      {
        issuer: 'https://api.packrat.world/api/auth',
        audience: 'https://mcp.packratai.com/mcp',
        algorithms: ['EdDSA', 'ES256', 'RS256'],
      },
    );
  });

  it('returns null when the token user cannot be found', async () => {
    mocks.jwtVerify.mockResolvedValueOnce({ payload: { sub: 'missing', scope: 'mcp:read' } });
    mockUserRows([]);

    const result = await resolveMcpBearerUser({ env, request: bearerRequest() });

    expect(result).toBeNull();
  });

  it('requires mcp:admin scope and ADMIN role for admin resolution', async () => {
    mocks.jwtVerify.mockResolvedValueOnce({ payload: { sub: 'admin-1', scope: 'mcp:read' } });
    expect(
      await resolveMcpBearerUser({ env, request: bearerRequest(), requireAdminScope: true }),
    ).toBeNull();

    mocks.jwtVerify.mockResolvedValueOnce({ payload: { sub: 'user-1', scope: 'mcp:admin' } });
    mockUserRows([{ id: 'user-1', role: 'USER', email: 'u@example.com', name: 'User One' }]);
    expect(
      await resolveMcpBearerUser({ env, request: bearerRequest(), requireAdminScope: true }),
    ).toBeNull();

    mocks.jwtVerify.mockResolvedValueOnce({ payload: { sub: 'admin-1', scope: 'mcp:admin' } });
    mockUserRows([{ id: 'admin-1', role: 'ADMIN', email: 'a@example.com', name: 'Admin One' }]);
    expect(
      await resolveMcpBearerUser({ env, request: bearerRequest(), requireAdminScope: true }),
    ).toEqual({
      userId: 'admin-1',
      role: 'ADMIN',
      email: 'a@example.com',
      name: 'Admin One',
    });
  });

  it('reuses the JWKS cache per issuer until reset', async () => {
    mocks.jwtVerify.mockResolvedValue({ payload: { sub: 'user-1', scope: 'mcp:read' } });
    mockUserRows([{ id: 'user-1', role: 'USER', email: 'u@example.com', name: 'User One' }]);
    mockUserRows([{ id: 'user-1', role: 'USER', email: 'u@example.com', name: 'User One' }]);

    await resolveMcpBearerUser({ env, request: bearerRequest('one') });
    await resolveMcpBearerUser({ env, request: bearerRequest('two') });

    expect(mocks.createRemoteJWKSet).toHaveBeenCalledTimes(1);

    __resetMcpJwksCacheForTests();
    mockUserRows([{ id: 'user-1', role: 'USER', email: 'u@example.com', name: 'User One' }]);
    await resolveMcpBearerUser({ env, request: bearerRequest('three') });

    expect(mocks.createRemoteJWKSet).toHaveBeenCalledTimes(2);
  });
});
