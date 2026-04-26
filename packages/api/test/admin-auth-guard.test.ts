/**
 * Integration tests for adminAuthGuard branching logic.
 *
 * Two distinct code paths are exercised:
 *   1. CF_ACCESS_TEAM_DOMAIN + CF_ACCESS_AUD set  →  CF JWT-only, no fallthrough
 *   2. CF vars absent                              →  Bearer JWT / Basic auth
 *
 * verifyCFAccessRequest is globally mocked in test/setup.ts (returns null by
 * default). Individual tests use mockResolvedValueOnce() to simulate success.
 * getEnv is also globally mocked; per-test overrides inject CF vars.
 */
import { verifyCFAccessRequest } from '@packrat/api/middleware/cfAccess';
import { getEnv } from '@packrat/api/utils/env-validation';
import { SignJWT } from 'jose';
import { describe, expect, it, vi } from 'vitest';
import { app } from '../src/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CF_OVERRIDES = {
  CF_ACCESS_TEAM_DOMAIN: 'https://packrat.cloudflareaccess.com',
  CF_ACCESS_AUD: 'test-aud-tag',
};

/** Extend the global getEnv mock return value with optional overrides. */
function withEnv(overrides: Record<string, unknown> = {}) {
  const base = vi.mocked(getEnv)();
  return { ...base, ...overrides };
}

/**
 * Build an admin Bearer JWT that verifyAdminJwt will accept.
 * Uses the same JWT_SECRET / issuer / audience as admin/index.ts.
 */
async function issueTestAdminJwt(): Promise<string> {
  const env = vi.mocked(getEnv)();
  const secret = new TextEncoder().encode(String(env.JWT_SECRET ?? 'secret'));
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('admin')
    .setIssuer('packrat-api')
    .setAudience('packrat-admin')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

function adminReq(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost/api/admin${path}`, { headers });
}

// ---------------------------------------------------------------------------
// CF_ACCESS_TEAM_DOMAIN + CF_ACCESS_AUD configured
// ---------------------------------------------------------------------------
describe('adminAuthGuard — CF Access configured', () => {
  it('allows request when verifyCFAccessRequest resolves an identity', async () => {
    vi.mocked(getEnv).mockReturnValueOnce(withEnv(CF_OVERRIDES) as ReturnType<typeof getEnv>);
    vi.mocked(verifyCFAccessRequest).mockResolvedValueOnce({ email: 'admin@packrat.world' });

    const res = await app.fetch(adminReq('/stats'));
    expect(res.status).not.toBe(401);
  });

  it('returns 401 when cf-access-jwt-assertion header is absent', async () => {
    vi.mocked(getEnv).mockReturnValueOnce(withEnv(CF_OVERRIDES) as ReturnType<typeof getEnv>);
    // verifyCFAccessRequest returns null (default global mock behaviour)

    const res = await app.fetch(adminReq('/stats'));
    expect(res.status).toBe(401);
  });

  it('returns 401 for the old spoofable CF-Access-Authenticated-User-Email header alone', async () => {
    vi.mocked(getEnv).mockReturnValueOnce(withEnv(CF_OVERRIDES) as ReturnType<typeof getEnv>);
    // verifyCFAccessRequest returns null — the header is not read by the new code

    const res = await app.fetch(
      adminReq('/stats', { 'cf-access-authenticated-user-email': 'admin@packrat.world' }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 for a valid Bearer JWT when CF is active (no fallthrough)', async () => {
    // Issue the JWT first (issueTestAdminJwt calls getEnv() internally, which
    // would consume mockReturnValueOnce if set before the call).
    const token = await issueTestAdminJwt();
    // Now arm the mock so adminAuthGuard sees CF vars on its getEnv() call.
    vi.mocked(getEnv).mockReturnValueOnce(withEnv(CF_OVERRIDES) as ReturnType<typeof getEnv>);
    // verifyCFAccessRequest returns null — Bearer path is not attempted
    const res = await app.fetch(adminReq('/stats', { authorization: `Bearer ${token}` }));
    expect(res.status).toBe(401);
  });

  it('returns 401 for valid Basic credentials when CF is active (no fallthrough)', async () => {
    vi.mocked(getEnv).mockReturnValueOnce(withEnv(CF_OVERRIDES) as ReturnType<typeof getEnv>);
    // verifyCFAccessRequest returns null — Basic path is not attempted

    const credentials = btoa('admin:admin-password');
    const res = await app.fetch(adminReq('/stats', { authorization: `Basic ${credentials}` }));
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// CF_ACCESS_TEAM_DOMAIN not set — local dev fallbacks
// ---------------------------------------------------------------------------
describe('adminAuthGuard — CF Access not configured', () => {
  it('allows a valid Bearer admin JWT', async () => {
    const token = await issueTestAdminJwt();
    const res = await app.fetch(adminReq('/stats', { authorization: `Bearer ${token}` }));
    expect(res.status).not.toBe(401);
  });

  it('allows valid Basic credentials', async () => {
    const credentials = btoa('admin:admin-password');
    const res = await app.fetch(adminReq('/stats', { authorization: `Basic ${credentials}` }));
    expect(res.status).not.toBe(401);
  });

  it('returns 401 with no auth header', async () => {
    const res = await app.fetch(adminReq('/stats'));
    expect(res.status).toBe(401);
  });

  it('returns 401 when only CF-Access-Authenticated-User-Email is set (header is irrelevant)', async () => {
    const res = await app.fetch(
      adminReq('/stats', { 'cf-access-authenticated-user-email': 'admin@packrat.world' }),
    );
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Token endpoint — exempt from auth guard
// ---------------------------------------------------------------------------
describe('/api/admin/token', () => {
  it('issues a JWT for valid Basic credentials (guard does not apply)', async () => {
    const credentials = btoa('admin:admin-password');
    const res = await app.fetch(
      new Request('http://localhost/api/admin/token', {
        method: 'POST',
        headers: { authorization: `Basic ${credentials}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; expiresIn: number };
    expect(typeof body.token).toBe('string');
    expect(typeof body.expiresIn).toBe('number');
  });

  it('returns 401 for invalid Basic credentials on token endpoint', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/admin/token', {
        method: 'POST',
        headers: { authorization: `Basic ${btoa('wrong:wrong')}` },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 when Authorization header is missing on token endpoint', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/admin/token', { method: 'POST' }),
    );
    expect(res.status).toBe(401);
  });
});
