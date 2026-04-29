import { adminAuthPlugin } from '@packrat/api/middleware/auth';
import { generateJWT } from '@packrat/api/utils/auth';
import { Elysia } from 'elysia';
import { beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  vi.stubEnv('JWT_SECRET', 'test-secret-at-least-32-chars-long-xx');
  vi.stubEnv('PACKRAT_API_KEY', 'test-api-key');
});

function buildAdminApp() {
  return new Elysia()
    .use(adminAuthPlugin)
    .get('/admin-only', ({ user }) => user, { isAdmin: true });
}

describe('adminAuthPlugin / isAdmin', () => {
  it('returns 401 when no Authorization header is present', async () => {
    const app = buildAdminApp();
    const res = await app.handle(new Request('http://x/admin-only'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for a USER-role JWT', async () => {
    const userJwt = await generateJWT({ payload: { userId: 1, role: 'USER' } });
    const app = buildAdminApp();
    const res = await app.handle(
      new Request('http://x/admin-only', { headers: { authorization: `Bearer ${userJwt}` } }),
    );
    expect(res.status).toBe(403);
  });

  it('returns 403 for a JWT with missing role (defaults to non-admin)', async () => {
    const jwt = await generateJWT({ payload: { userId: 1 } as { userId: number } });
    const app = buildAdminApp();
    const res = await app.handle(
      new Request('http://x/admin-only', { headers: { authorization: `Bearer ${jwt}` } }),
    );
    expect(res.status).toBe(403);
  });

  it('accepts a valid ADMIN-role JWT', async () => {
    const adminJwt = await generateJWT({ payload: { userId: 99, role: 'ADMIN' } });
    const app = buildAdminApp();
    const res = await app.handle(
      new Request('http://x/admin-only', { headers: { authorization: `Bearer ${adminJwt}` } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe('ADMIN');
    expect(body.userId).toBe(99);
  });

  it('rejects X-API-Key on admin routes (no API-key → ADMIN escalation)', async () => {
    const app = buildAdminApp();
    const res = await app.handle(
      new Request('http://x/admin-only', { headers: { 'x-api-key': 'test-api-key' } }),
    );
    expect(res.status).toBe(401);
  });
});
