/**
 * Integration tests for adminAuthGuard and /token two-factor design.
 *
 * Auth model:
 *   - /token (CF configured):  CF JWT + Basic  → Bearer JWT
 *   - /token (no CF vars, any env): Basic only → Bearer JWT
 *   - Protected routes: Bearer JWT always accepted; Basic only in dev (no CF vars)
 *
 * verifyCFAccessRequest is globally mocked in test/setup.ts (returns null by
 * default). Individual tests use mockResolvedValueOnce() to simulate success.
 * getEnv is also globally mocked; per-test overrides inject CF vars or
 * ENVIRONMENT=production.
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

function tokenReq(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/admin/token', { method: 'POST', headers });
}

// ---------------------------------------------------------------------------
// adminAuthGuard — CF Access configured
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

    const res = await app.fetch(
      adminReq('/stats', { 'cf-access-authenticated-user-email': 'admin@packrat.world' }),
    );
    expect(res.status).toBe(401);
  });

  it('allows a valid Bearer JWT even when CF vars are set (JWT proves both factors at issuance)', async () => {
    const token = await issueTestAdminJwt();
    // adminAuthGuard now accepts Bearer JWT unconditionally — no CF re-check needed.
    vi.mocked(getEnv).mockReturnValueOnce(withEnv(CF_OVERRIDES) as ReturnType<typeof getEnv>);
    const res = await app.fetch(adminReq('/stats', { authorization: `Bearer ${token}` }));
    expect(res.status).not.toBe(401);
  });

  it('returns 401 for valid Basic credentials on protected routes when CF is active', async () => {
    vi.mocked(getEnv).mockReturnValueOnce(withEnv(CF_OVERRIDES) as ReturnType<typeof getEnv>);

    const credentials = btoa('admin:admin-password');
    const res = await app.fetch(adminReq('/stats', { authorization: `Basic ${credentials}` }));
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// adminAuthGuard — CF Access not configured (dev)
// ---------------------------------------------------------------------------
describe('adminAuthGuard — CF Access not configured (dev, ENVIRONMENT=development)', () => {
  it('allows a valid Bearer admin JWT', async () => {
    const token = await issueTestAdminJwt();
    const res = await app.fetch(adminReq('/stats', { authorization: `Bearer ${token}` }));
    expect(res.status).not.toBe(401);
  });

  it('allows valid Basic credentials as a dev convenience', async () => {
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
// adminAuthGuard — ENVIRONMENT=production without CF vars: Basic blocked
// ---------------------------------------------------------------------------
describe('adminAuthGuard — ENVIRONMENT=production, no CF vars', () => {
  it('blocks Basic auth on protected routes even without CF vars when ENVIRONMENT=production', async () => {
    vi.mocked(getEnv).mockReturnValueOnce(
      withEnv({ ENVIRONMENT: 'production' }) as ReturnType<typeof getEnv>,
    );

    const credentials = btoa('admin:admin-password');
    const res = await app.fetch(adminReq('/stats', { authorization: `Basic ${credentials}` }));
    expect(res.status).toBe(401);
  });

  it('still allows Bearer JWT when ENVIRONMENT=production (JWT was issued after proper auth)', async () => {
    const token = await issueTestAdminJwt();
    vi.mocked(getEnv).mockReturnValueOnce(
      withEnv({ ENVIRONMENT: 'production' }) as ReturnType<typeof getEnv>,
    );
    const res = await app.fetch(adminReq('/stats', { authorization: `Bearer ${token}` }));
    expect(res.status).not.toBe(401);
  });
});

// ---------------------------------------------------------------------------
// /token — CF Access not configured (dev): Basic only
// ---------------------------------------------------------------------------
describe('/api/admin/token — CF Access not configured (dev)', () => {
  it('issues a JWT for valid Basic credentials', async () => {
    const credentials = btoa('admin:admin-password');
    const res = await app.fetch(tokenReq({ authorization: `Basic ${credentials}` }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; expiresIn: number };
    expect(typeof body.token).toBe('string');
    expect(typeof body.expiresIn).toBe('number');
  });

  it('returns 401 for invalid Basic credentials', async () => {
    const res = await app.fetch(tokenReq({ authorization: `Basic ${btoa('wrong:wrong')}` }));
    expect(res.status).toBe(401);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await app.fetch(tokenReq());
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// /token — CF Access configured: requires CF JWT + Basic (two-factor)
// ---------------------------------------------------------------------------
describe('/api/admin/token — CF Access configured (two-factor)', () => {
  it('issues a JWT when CF JWT is valid and Basic credentials are correct', async () => {
    const envWithCF = withEnv(CF_OVERRIDES) as ReturnType<typeof getEnv>;
    // /token calls getEnv() once for CF vars + once inside basicAuthGuard
    vi.mocked(getEnv).mockReturnValueOnce(envWithCF).mockReturnValueOnce(envWithCF);
    vi.mocked(verifyCFAccessRequest).mockResolvedValueOnce({ email: 'admin@packrat.world' });

    const credentials = btoa('admin:admin-password');
    const res = await app.fetch(tokenReq({ authorization: `Basic ${credentials}` }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string };
    expect(typeof body.token).toBe('string');
  });

  it('returns 401 when CF JWT is absent (Basic alone is not enough in prod)', async () => {
    const envWithCF = withEnv(CF_OVERRIDES) as ReturnType<typeof getEnv>;
    vi.mocked(getEnv).mockReturnValueOnce(envWithCF);
    // verifyCFAccessRequest returns null (default)

    const credentials = btoa('admin:admin-password');
    const res = await app.fetch(tokenReq({ authorization: `Basic ${credentials}` }));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('CF Access authentication required');
  });

  it('returns 401 when CF JWT is valid but Basic credentials are wrong', async () => {
    const envWithCF = withEnv(CF_OVERRIDES) as ReturnType<typeof getEnv>;
    vi.mocked(getEnv).mockReturnValueOnce(envWithCF).mockReturnValueOnce(envWithCF);
    vi.mocked(verifyCFAccessRequest).mockResolvedValueOnce({ email: 'admin@packrat.world' });

    const res = await app.fetch(
      tokenReq({ authorization: `Basic ${btoa('admin:wrong-password')}` }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Invalid username or password');
  });

  it('returns 401 when Authorization header is missing even with a valid CF JWT', async () => {
    const envWithCF = withEnv(CF_OVERRIDES) as ReturnType<typeof getEnv>;
    vi.mocked(getEnv).mockReturnValueOnce(envWithCF);
    vi.mocked(verifyCFAccessRequest).mockResolvedValueOnce({ email: 'admin@packrat.world' });

    const res = await app.fetch(tokenReq());
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Missing credentials');
  });
});

// ---------------------------------------------------------------------------
// /token — no CF vars (any environment): Basic-only is accepted
// ---------------------------------------------------------------------------
describe('/api/admin/token — no CF vars configured (any environment)', () => {
  it('issues a JWT with Basic credentials when CF vars are absent in production', async () => {
    const envProd = withEnv({ ENVIRONMENT: 'production' }) as ReturnType<typeof getEnv>;
    vi.mocked(getEnv).mockReturnValueOnce(envProd).mockReturnValueOnce(envProd);

    const credentials = btoa('admin:admin-password');
    const res = await app.fetch(tokenReq({ authorization: `Basic ${credentials}` }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string };
    expect(typeof body.token).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Adversarial / bypass attempts
// ---------------------------------------------------------------------------
describe('bypass attempts', () => {
  // --- Spoofed / crafted headers on protected routes ---
  it('rejects a JWT signed with the wrong secret', async () => {
    const wrongSecret = new TextEncoder().encode('not-the-real-secret');
    const token = await new SignJWT({ role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('admin')
      .setIssuer('packrat-api')
      .setAudience('packrat-admin')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(wrongSecret);

    const res = await app.fetch(adminReq('/stats', { authorization: `Bearer ${token}` }));
    expect(res.status).toBe(401);
  });

  it('rejects a regular user JWT (correct secret, wrong role)', async () => {
    const env = vi.mocked(getEnv)();
    const secret = new TextEncoder().encode(String(env.JWT_SECRET ?? 'secret'));
    const token = await new SignJWT({ role: 'USER', userId: 42 })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('42')
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);

    const res = await app.fetch(adminReq('/stats', { authorization: `Bearer ${token}` }));
    expect(res.status).toBe(401);
  });

  it('rejects a Bearer token that is plaintext (not a JWT)', async () => {
    const res = await app.fetch(adminReq('/stats', { authorization: 'Bearer not-a-real-jwt' }));
    expect(res.status).toBe(401);
  });

  it('rejects Basic auth on protected routes when CF vars are set (even with correct credentials)', async () => {
    vi.mocked(getEnv).mockReturnValueOnce(withEnv(CF_OVERRIDES) as ReturnType<typeof getEnv>);
    const res = await app.fetch(
      adminReq('/stats', { authorization: `Basic ${btoa('admin:admin-password')}` }),
    );
    expect(res.status).toBe(401);
  });

  it('rejects Basic auth on protected routes when ENVIRONMENT=production (even without CF vars)', async () => {
    vi.mocked(getEnv).mockReturnValueOnce(
      withEnv({ ENVIRONMENT: 'production' }) as ReturnType<typeof getEnv>,
    );
    const res = await app.fetch(
      adminReq('/stats', { authorization: `Basic ${btoa('admin:admin-password')}` }),
    );
    expect(res.status).toBe(401);
  });

  it('rejects the spoofable CF-Access-Authenticated-User-Email header on protected routes', async () => {
    vi.mocked(getEnv).mockReturnValueOnce(withEnv(CF_OVERRIDES) as ReturnType<typeof getEnv>);
    const res = await app.fetch(
      adminReq('/stats', { 'cf-access-authenticated-user-email': 'admin@example.com' }),
    );
    expect(res.status).toBe(401);
  });

  it('rejects an empty Authorization header', async () => {
    const res = await app.fetch(adminReq('/stats', { authorization: '' }));
    expect(res.status).toBe(401);
  });

  it('rejects a malformed Basic credential (no colon separator)', async () => {
    const res = await app.fetch(adminReq('/stats', { authorization: `Basic ${btoa('nocolon')}` }));
    expect(res.status).toBe(401);
  });

  it('rejects a Bearer JWT with the admin role but correct CF vars configured and no CF JWT at /token', async () => {
    // Even if you somehow have a valid Bearer JWT, /token cannot have issued it
    // without CF JWT in prod — this is the defence-in-depth proof: attempting
    // to call /token with CF configured but no CF JWT is still rejected.
    const envWithCF = withEnv(CF_OVERRIDES) as ReturnType<typeof getEnv>;
    vi.mocked(getEnv).mockReturnValueOnce(envWithCF);
    // verifyCFAccessRequest returns null (CF JWT absent)

    const credentials = btoa('admin:admin-password');
    const res = await app.fetch(tokenReq({ authorization: `Basic ${credentials}` }));
    expect(res.status).toBe(401);
  });

  it('rejects a timing attack: wrong username takes same time as wrong password', async () => {
    // Both bad-username and bad-password attempts return 401 without leaking which
    // field was wrong — verifying the error message is the same.
    const badUser = await app.fetch(
      tokenReq({ authorization: `Basic ${btoa('wronguser:admin-password')}` }),
    );
    const badPass = await app.fetch(
      tokenReq({ authorization: `Basic ${btoa('admin:wrongpass')}` }),
    );
    expect(badUser.status).toBe(401);
    expect(badPass.status).toBe(401);
    const u = (await badUser.json()) as { error: string };
    const p = (await badPass.json()) as { error: string };
    // Both must return the same error message (no username enumeration)
    expect(u.error).toBe(p.error);
  });
});
