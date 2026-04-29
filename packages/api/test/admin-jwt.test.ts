/**
 * Round-trip tests for issueAdminJwt / verifyAdminJwt.
 *
 * Both functions are private to packages/api/src/routes/admin/index.ts, so
 * they are exercised via the HTTP layer:
 *   - POST /api/admin/token (Basic auth)  →  issues a JWT
 *   - GET  /api/admin/stats (Bearer JWT)  →  verifies the JWT
 *
 * Negative cases craft JWT variants directly with jose, then probe the Bearer
 * path to confirm verifyAdminJwt enforces issuer, audience, role, and expiry.
 *
 * JWT_SECRET is 'secret' (from test/setup.ts testEnv).
 * ADMIN_JWT_ISSUER / ADMIN_JWT_AUDIENCE mirror the constants in admin/index.ts.
 */
import { getEnv } from '@packrat/api/utils/env-validation';
import { SignJWT } from 'jose';
import { describe, expect, it, vi } from 'vitest';
import { app } from '../src/index';

const ADMIN_JWT_ISSUER = 'packrat-api';
const ADMIN_JWT_AUDIENCE = 'packrat-admin';

function secretKey(): Uint8Array {
  // Reads the JWT_SECRET from the already-mocked getEnv in setup.ts.
  const env = vi.mocked(getEnv)();
  return new TextEncoder().encode(env.JWT_SECRET ?? 'secret');
}

/** Issue a JWT via the /token endpoint using Basic auth. */
async function issueViaRoute(): Promise<string> {
  const credentials = btoa('admin:admin-password');
  const res = await app.fetch(
    new Request('http://localhost/api/admin/token', {
      method: 'POST',
      headers: { authorization: `Basic ${credentials}` },
    }),
  );
  expect(res.status).toBe(200);
  const body = (await res.json()) as { token: string };
  return body.token;
}

/** Call GET /api/admin/stats with a Bearer token; return the HTTP status. */
async function probeBearer(token: string): Promise<number> {
  const res = await app.fetch(
    new Request('http://localhost/api/admin/stats', {
      headers: { authorization: `Bearer ${token}` },
    }),
  );
  return res.status;
}

describe('issueAdminJwt / verifyAdminJwt round-trip', () => {
  it('token issued by /api/admin/token passes verifyAdminJwt', async () => {
    const token = await issueViaRoute();
    expect(await probeBearer(token)).not.toBe(401);
  });

  it('token with wrong issuer is rejected', async () => {
    const token = await new SignJWT({ role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('admin')
      .setIssuer('packrat-api-wrong')
      .setAudience(ADMIN_JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secretKey());

    expect(await probeBearer(token)).toBe(401);
  });

  it('token with wrong audience is rejected', async () => {
    const token = await new SignJWT({ role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('admin')
      .setIssuer(ADMIN_JWT_ISSUER)
      .setAudience('packrat-admin-wrong')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secretKey());

    expect(await probeBearer(token)).toBe(401);
  });

  it('token without issuer or audience claims is rejected (old format)', async () => {
    const token = await new SignJWT({ role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('admin')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secretKey());

    expect(await probeBearer(token)).toBe(401);
  });

  it('token with correct iss+aud but role = USER is rejected', async () => {
    const token = await new SignJWT({ role: 'USER' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('admin')
      .setIssuer(ADMIN_JWT_ISSUER)
      .setAudience(ADMIN_JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secretKey());

    expect(await probeBearer(token)).toBe(401);
  });

  it('expired token is rejected', async () => {
    const exp = Math.floor(Date.now() / 1000) - 10; // 10 seconds in the past
    const token = await new SignJWT({ role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('admin')
      .setIssuer(ADMIN_JWT_ISSUER)
      .setAudience(ADMIN_JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(exp)
      .sign(secretKey());

    expect(await probeBearer(token)).toBe(401);
  });

  it('valid token round-trips on repeated requests within the TTL', async () => {
    const token = await issueViaRoute();
    expect(await probeBearer(token)).not.toBe(401);
    expect(await probeBearer(token)).not.toBe(401);
  });
});
