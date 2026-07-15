import { getAuth } from '@packrat/api/auth';
import { resolveMcpBearerUser } from '@packrat/api/auth/mcp-token';
import { adminAuthPlugin, authPlugin } from '@packrat/api/middleware/auth';
import { Elysia } from 'elysia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@packrat/api/auth', () => ({
  getAuth: vi.fn(),
}));

vi.mock('@packrat/api/auth/mcp-token', () => ({
  resolveMcpBearerUser: vi.fn(),
}));

const mockGetSession = vi.fn();
const mockResolveMcpBearerUser = vi.mocked(resolveMcpBearerUser);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuth).mockResolvedValue({ api: { getSession: mockGetSession } } as never);
  mockGetSession.mockResolvedValue(null);
  mockResolveMcpBearerUser.mockResolvedValue(null);
});

describe('authPlugin MCP OAuth bearer fallback', () => {
  it('injects the MCP-resolved user when Better Auth has no session', async () => {
    mockResolveMcpBearerUser.mockResolvedValue({
      userId: 'mcp-user-1',
      role: 'USER',
      email: 'mcp@test.com',
      name: 'MCP User',
    });
    const app = new Elysia()
      .use(authPlugin)
      .get('/protected', ({ user }) => user, { isAuthenticated: true });

    const res = await app.handle(
      new Request('http://localhost/protected', {
        headers: { authorization: 'Bearer mcp-oauth-jwt' },
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ userId: 'mcp-user-1', role: 'USER' });
    expect(mockResolveMcpBearerUser).toHaveBeenCalledWith(
      expect.not.objectContaining({ requireAdminScope: expect.anything() }),
    );
  });
});

describe('adminAuthPlugin MCP OAuth bearer fallback', () => {
  it('requires the MCP admin scope path for admin routes', async () => {
    mockResolveMcpBearerUser.mockResolvedValue({
      userId: 'mcp-admin-1',
      role: 'ADMIN',
      email: 'admin@test.com',
      name: 'MCP Admin',
    });
    const app = new Elysia()
      .use(adminAuthPlugin)
      .get('/admin-only', ({ user }) => user, { isAdmin: true });

    const res = await app.handle(
      new Request('http://localhost/admin-only', {
        headers: { authorization: 'Bearer mcp-oauth-jwt' },
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ userId: 'mcp-admin-1', role: 'ADMIN' });
    expect(mockResolveMcpBearerUser).toHaveBeenCalledWith(
      expect.objectContaining({ requireAdminScope: true }),
    );
  });
});
