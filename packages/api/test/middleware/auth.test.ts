import { authPlugin } from '@packrat/api/middleware/auth';
import { generateJWT } from '@packrat/api/utils/auth';
import { Elysia } from 'elysia';
import { beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Unit tests for the authPlugin macro. Uses in-process `app.handle` to
 * exercise the full Elysia macro chain without spinning up a Worker.
 */

// JWT_SECRET is read at generate + verify time from getEnv(); set it once
// before any token work happens.
beforeAll(() => {
  vi.stubEnv('JWT_SECRET', 'test-secret-at-least-32-chars-long-xx');
  vi.stubEnv('PACKRAT_API_KEY', 'test-api-key');
});

function buildTestApp() {
  return new Elysia()
    .use(authPlugin)
    .get('/protected', ({ user }) => user, { isAuthenticated: true });
}

describe('authPlugin', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const app = buildTestApp();
    const res = await app.handle(new Request('http://x/protected'));
    expect(res.status).toBe(401);
  });

  it('returns 401 when bearer token is empty', async () => {
    const app = buildTestApp();
    const res = await app.handle(
      new Request('http://x/protected', { headers: { authorization: 'Bearer ' } }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 on tampered JWT signature', async () => {
    const valid = await generateJWT({ payload: { userId: 1, role: 'USER' } });
    const parts = valid.split('.');
    // Flip a character in the signature segment so HMAC verification fails.
    const tamperedSig = parts[2]?.slice(0, -1) + (parts[2]?.endsWith('A') ? 'B' : 'A');
    const tampered = `${parts[0]}.${parts[1]}.${tamperedSig}`;
    const app = buildTestApp();
    const res = await app.handle(
      new Request('http://x/protected', { headers: { authorization: `Bearer ${tampered}` } }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 on an expired JWT', async () => {
    const expired = await generateJWT({
      payload: { userId: 1, role: 'USER', exp: Math.floor(Date.now() / 1000) - 60 },
    });
    const app = buildTestApp();
    const res = await app.handle(
      new Request('http://x/protected', { headers: { authorization: `Bearer ${expired}` } }),
    );
    expect(res.status).toBe(401);
  });

  it('rejects alg:none JWTs', async () => {
    // Hand-crafted alg:none token — header says none, signature is empty
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ userId: 1, role: 'ADMIN' })).toString('base64url');
    const noneJwt = `${header}.${payload}.`;
    const app = buildTestApp();
    const res = await app.handle(
      new Request('http://x/protected', { headers: { authorization: `Bearer ${noneJwt}` } }),
    );
    expect(res.status).toBe(401);
  });

  it('does NOT accept X-API-Key on user-scoped routes (regression test for #2162)', async () => {
    // The legacy behavior synthesized { userId: 0, role: 'ADMIN' } from
    // X-API-Key and injected it into any `isAuthenticated` route. The
    // removed fallback means API-key-only requests now fail 401 against
    // user-scoped routes and must use `apiKeyAuthPlugin` instead.
    const app = buildTestApp();
    const res = await app.handle(
      new Request('http://x/protected', { headers: { 'x-api-key': 'test-api-key' } }),
    );
    expect(res.status).toBe(401);
  });

  it('role claim cannot be forged via JWT payload spread', async () => {
    // The resolver picks `role` from `payload.role` explicitly AFTER
    // spreading `...rest`, so an adversary cannot shove a `role` field into
    // rest. This guards that ordering.
    const userToken = await generateJWT({
      payload: { userId: 7, role: 'USER', scope: 'read' },
    });
    const app = new Elysia()
      .use(authPlugin)
      .get('/role', ({ user }) => ({ role: user.role }), { isAuthenticated: true });
    const res = await app.handle(
      new Request('http://x/role', { headers: { authorization: `Bearer ${userToken}` } }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.role).toBe('USER');
  });

  it('accepts a valid user JWT and injects user context', async () => {
    const token = await generateJWT({ payload: { userId: 42, role: 'USER' } });
    const app = buildTestApp();
    const res = await app.handle(
      new Request('http://x/protected', { headers: { authorization: `Bearer ${token}` } }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.userId).toBe(42);
    expect(body.role).toBe('USER');
  });
});
