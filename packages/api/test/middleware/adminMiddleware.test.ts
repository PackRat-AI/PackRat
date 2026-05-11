import { getAuth } from '@packrat/api/auth';
import { adminAuthPlugin } from '@packrat/api/middleware/auth';
import { Elysia } from 'elysia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// getAuth is mocked globally by test/setup.ts. Override here to control sessions.
const mockGetSession = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(getAuth).mockResolvedValue({
    api: { getSession: mockGetSession },
  } as never);
});

function buildAdminApp() {
  return new Elysia()
    .use(adminAuthPlugin)
    .get('/admin-only', ({ user }) => user, { isAdmin: true });
}

describe('adminAuthPlugin / isAdmin', () => {
  it('returns 401 when no Authorization header is present', async () => {
    mockGetSession.mockResolvedValue(null);
    const app = buildAdminApp();
    const res = await app.handle(new Request('http://localhost/admin-only'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for a USER-role session', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'user-1', email: 'user@test.com', name: 'User', role: 'USER' },
    });
    const app = buildAdminApp();
    const res = await app.handle(
      new Request('http://localhost/admin-only', {
        headers: { authorization: 'Bearer user-token' },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('returns 403 when session user has no role', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'user-1', email: 'user@test.com', name: 'User' },
    });
    const app = buildAdminApp();
    const res = await app.handle(
      new Request('http://localhost/admin-only', { headers: { authorization: 'Bearer token' } }),
    );
    expect(res.status).toBe(403);
  });

  it('accepts a valid ADMIN-role session', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'admin-99', email: 'admin@test.com', name: 'Admin', role: 'ADMIN' },
    });
    const app = buildAdminApp();
    const res = await app.handle(
      new Request('http://localhost/admin-only', {
        headers: { authorization: 'Bearer admin-token' },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe('ADMIN');
    expect(body.userId).toBe('admin-99');
  });

  it('rejects X-API-Key on admin routes', async () => {
    mockGetSession.mockResolvedValue(null);
    const app = buildAdminApp();
    const res = await app.handle(
      new Request('http://localhost/admin-only', { headers: { 'x-api-key': 'test-api-key' } }),
    );
    expect(res.status).toBe(401);
  });
});
