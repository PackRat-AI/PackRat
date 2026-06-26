import { getAuth } from '@packrat/api/auth';
import { resolveMcpBearerUser } from '@packrat/api/auth/mcp-token';
import { authPlugin } from '@packrat/api/middleware/auth';
import { Elysia } from 'elysia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// getAuth is mocked globally by test/setup.ts. Override it here to control
// what session is returned per-test.
const mockGetSession = vi.fn();
const mockResolveMcpBearerUser = vi.mocked(resolveMcpBearerUser);

vi.mock('@packrat/api/auth/mcp-token', () => ({
  resolveMcpBearerUser: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveMcpBearerUser.mockResolvedValue(null);

  vi.mocked(getAuth).mockResolvedValue({
    api: { getSession: mockGetSession },
  } as never);
});

function buildTestApp() {
  return new Elysia()
    .use(authPlugin)
    .get('/protected', ({ user }) => user, { isAuthenticated: true });
}

describe('authPlugin', () => {
  it('returns 401 when Authorization header is missing', async () => {
    mockGetSession.mockResolvedValue(null);
    const app = buildTestApp();
    const res = await app.handle(new Request('http://localhost/protected'));
    expect(res.status).toBe(401);
  });

  it('returns 401 when bearer token is empty', async () => {
    mockGetSession.mockResolvedValue(null);
    const app = buildTestApp();
    const res = await app.handle(
      new Request('http://localhost/protected', { headers: { authorization: 'Bearer ' } }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 when getSession returns null (invalid/expired token)', async () => {
    mockGetSession.mockResolvedValue(null);
    const app = buildTestApp();
    const res = await app.handle(
      new Request('http://localhost/protected', {
        headers: { authorization: 'Bearer invalid-token' },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('does NOT accept X-API-Key on user-scoped routes', async () => {
    mockGetSession.mockResolvedValue(null);
    const app = buildTestApp();
    const res = await app.handle(
      new Request('http://localhost/protected', { headers: { 'x-api-key': 'test-api-key' } }),
    );
    expect(res.status).toBe(401);
  });

  it('accepts a valid session and injects user context', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'user-42', email: 'test@example.com', name: 'Test User', role: 'USER' },
    });
    const app = buildTestApp();
    const res = await app.handle(
      new Request('http://localhost/protected', {
        headers: { authorization: 'Bearer valid-session-token' },
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.userId).toBe('user-42');
    expect(body.role).toBe('USER');
    expect(body.email).toBe('test@example.com');
  });

  it('preserves role from session, not from caller-supplied claim', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'user-7', email: 'test@example.com', name: 'Test User', role: 'USER' },
    });
    const app = new Elysia()
      .use(authPlugin)
      .get('/role', ({ user }) => ({ role: user.role }), { isAuthenticated: true });
    const res = await app.handle(
      new Request('http://localhost/role', { headers: { authorization: 'Bearer token' } }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.role).toBe('USER');
  });

  it('accepts a valid MCP OAuth bearer when Better Auth session lookup returns null', async () => {
    mockGetSession.mockResolvedValue(null);
    mockResolveMcpBearerUser.mockResolvedValue({
      userId: 'mcp-user-1',
      role: 'USER',
      email: 'mcp@test.com',
      name: 'MCP User',
    });
    const app = buildTestApp();
    const res = await app.handle(
      new Request('http://localhost/protected', {
        headers: { authorization: 'Bearer mcp-oauth-jwt' },
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.userId).toBe('mcp-user-1');
    expect(mockResolveMcpBearerUser).toHaveBeenCalledWith(
      expect.objectContaining({ requireAdminScope: undefined }),
    );
  });
});
