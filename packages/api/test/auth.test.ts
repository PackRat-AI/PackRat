/**
 * Better Auth integration tests.
 *
 * Creates a real Better Auth instance wired to the Docker Compose test database
 * and calls auth.handler(request) directly. This verifies the full credential
 * lifecycle, session token integrity, and the security properties that prevent
 * users from being locked out.
 *
 * Scope:
 *   - Sign-up / sign-in / sign-out HTTP flows
 *   - Session token round-trip (sign-in → token → get-session → validate)
 *   - JWKS endpoint availability
 *   - Forget-password non-enumeration (200 for unknown email)
 *   - Lock-out prevention (bad passwords don't block valid logins)
 *   - Session isolation (sign-out of one session doesn't affect others)
 *   - End-to-end: real session token from sign-in authenticates Elysia routes
 *
 * Middleware unit tests (isAuthenticated macro, isAdmin macro, apiKeyAuth) are
 * in test/middleware/ and are not duplicated here.
 */

import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { getAuth } from '@packrat/api/auth';
import { createDb } from '@packrat/api/db';
import { authPlugin } from '@packrat/api/middleware/auth';
import * as schema from '@packrat/db/schema';
import { betterAuth } from 'better-auth';
import { bearer, jwt } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// ─── Real Better Auth instance ────────────────────────────────────────────────

let realAuth: any;

const TEST_BASE_URL = 'http://localhost:8787';
const TEST_SECRET = 'test-better-auth-secret-32-chars-long!!';

beforeAll(async () => {
  const db = createDb(); // returns testDb (mocked WS drizzle) from setup.ts

  realAuth = betterAuth({
    baseURL: TEST_BASE_URL,
    secret: TEST_SECRET,

    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.users,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        jwks: schema.jwks,
      },
    }),

    user: {
      additionalFields: {
        role: { type: 'string', defaultValue: 'USER' },
        firstName: { type: 'string', fieldName: 'first_name' },
        lastName: { type: 'string', fieldName: 'last_name' },
        avatarUrl: { type: 'string', fieldName: 'avatar_url' },
        passwordHash: { type: 'string', fieldName: 'password_hash' },
      },
    },

    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 8,
      requireEmailVerification: false,
      // No-op: request-password-reset endpoint requires this to be configured;
      // we test only the HTTP status, not actual email delivery.
      sendResetPassword: async () => {},
    },

    trustedOrigins: [TEST_BASE_URL],

    // bearer() converts Authorization: Bearer <token> into a session lookup,
    // matching the production config that mobile clients depend on.
    // jwt() exposes the JWKS endpoint.
    plugins: [bearer(), jwt()],
  });
});

afterAll(() => {
  // Restore getAuth mock to the default setup.ts behaviour (HS256 JWT validator).
  // Without this, tests that run after this file (in the same singleWorker
  // process) would continue to use realAuth for session validation.
  vi.mocked(getAuth).mockReset();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function authReq(path: string, init?: RequestInit): Promise<Response> {
  return realAuth.handler(
    new Request(`${TEST_BASE_URL}/api/auth/${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    }),
  );
}

function signUp(email: string, password: string) {
  return authReq('sign-up/email', {
    method: 'POST',
    body: JSON.stringify({ email, password, name: 'Test User' }),
  });
}

async function signIn(email: string, password: string): Promise<Response> {
  return authReq('sign-in/email', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

async function getToken(email: string, password: string): Promise<string> {
  const res = await signIn(email, password);
  const body = await res.json<{ token?: string }>();
  if (!body.token) throw new Error(`sign-in failed: ${JSON.stringify(body)}`);
  return body.token;
}

function getSession(token: string): Promise<Response> {
  return authReq('get-session', {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
}

function signOut(token: string): Promise<Response> {
  return authReq('sign-out', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
}

let emailSeq = 0;
function uniq(prefix = 'user') {
  return `${prefix}-${Date.now()}-${emailSeq++}@test.example.com`;
}

// ─── Sign-up ──────────────────────────────────────────────────────────────────

describe('POST /api/auth/sign-up/email', () => {
  it('creates a user and returns a session token', async () => {
    const email = uniq();
    const res = await signUp(email, 'Password123!');
    expect(res.status).toBe(200);
    const body = await res.json<{ token?: string; user?: { email: string } }>();
    expect(body.token).toBeTruthy();
    expect(body.user?.email).toBe(email);
  });

  it('returns a non-null, non-empty token string', async () => {
    const res = await signUp(uniq(), 'Password123!');
    const { token } = await res.json<{ token: string }>();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);
  });

  it('rejects a duplicate email with 4xx', async () => {
    const email = uniq();
    await signUp(email, 'Password123!');
    const res = await signUp(email, 'DifferentPass1!');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const res = await signUp(uniq(), 'abc');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('rejects when the email field is missing', async () => {
    const res = await authReq('sign-up/email', {
      method: 'POST',
      body: JSON.stringify({ password: 'Password123!' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('rejects when the password field is missing', async () => {
    const res = await authReq('sign-up/email', {
      method: 'POST',
      body: JSON.stringify({ email: uniq() }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('rejects an invalid email format', async () => {
    const res = await signUp('not-an-email', 'Password123!');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('stores the password as a hash — not plaintext', async () => {
    const password = 'SecrEtPass1!';
    const email = uniq();
    await signUp(email, password);

    // Better Auth stores credentials in the `account` table (providerId = 'credential'),
    // not directly in users.password_hash. Verify the hash is not the plaintext password.
    const db = createDb();
    const [cred] = await db
      .select({ password: schema.account.password })
      .from(schema.account)
      .where(eq(schema.account.providerId, 'credential'));
    expect(cred?.password).not.toBe(password);
    expect(cred?.password).toBeTruthy();
  });
});

// ─── Sign-in ──────────────────────────────────────────────────────────────────

describe('POST /api/auth/sign-in/email', () => {
  it('returns a session token on valid credentials', async () => {
    const email = uniq();
    await signUp(email, 'Password123!');
    const res = await signIn(email, 'Password123!');
    expect(res.status).toBe(200);
    const body = await res.json<{ token?: string }>();
    expect(body.token).toBeTruthy();
  });

  it('returns 401 on wrong password', async () => {
    const email = uniq();
    await signUp(email, 'Password123!');
    const res = await signIn(email, 'WrongPass999!');
    expect(res.status).toBe(401);
  });

  it('returns 4xx for a non-existent user without leaking existence', async () => {
    const res = await signIn('nobody@nowhere.test', 'SomePass123!');
    // Must fail (not 200), but the response must not reveal whether the account
    // exists vs the password was wrong — both should produce the same status code.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('wrong-password response body does not reveal whether user exists', async () => {
    const email = uniq();
    await signUp(email, 'Password123!');

    const badPassRes = await signIn(email, 'WrongPass999!');
    const noUserRes = await signIn('ghost@nowhere.test', 'WrongPass999!');

    // Status codes must be identical so callers cannot enumerate accounts.
    expect(badPassRes.status).toBe(noUserRes.status);
  });

  it('rejects when email is missing', async () => {
    const res = await authReq('sign-in/email', {
      method: 'POST',
      body: JSON.stringify({ password: 'Password123!' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('rejects when password is missing', async () => {
    const email = uniq();
    await signUp(email, 'Password123!');
    const res = await authReq('sign-in/email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

// ─── Session validation ───────────────────────────────────────────────────────

describe('GET /api/auth/get-session', () => {
  it('returns user data for a valid session token', async () => {
    const email = uniq();
    await signUp(email, 'Password123!');
    const token = await getToken(email, 'Password123!');

    const res = await getSession(token);
    expect(res.status).toBe(200);
    const body = await res.json<{ user?: { email: string }; session?: object }>();
    expect(body.user?.email).toBe(email);
    expect(body.session).toBeTruthy();
  });

  it('returns null/empty for an invalid token', async () => {
    const res = await getSession('completely-invalid-token-xyz');
    // Better Auth returns 200 with null session, not 401
    expect(res.status).toBe(200);
    const body = await res.json<{ session: null; user: null } | null>();
    // Either the body is null or the session field is null
    const session = body && typeof body === 'object' && 'session' in body ? body.session : body;
    expect(session).toBeNull();
  });

  it('returns null/empty when Authorization header is absent', async () => {
    const res = await authReq('get-session', {
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ session: null } | null>();
    const session = body && typeof body === 'object' && 'session' in body ? body.session : body;
    expect(session).toBeNull();
  });

  it('session from sign-up is immediately usable', async () => {
    const email = uniq();
    const signUpRes = await signUp(email, 'Password123!');
    const { token } = await signUpRes.json<{ token: string }>();

    const sessionRes = await getSession(token);
    expect(sessionRes.status).toBe(200);
    const { user } = await sessionRes.json<{ user: { email: string } }>();
    expect(user.email).toBe(email);
  });

  it('sign-in issues a different token from sign-up', async () => {
    const email = uniq();
    const { token: tokenA } = await signUp(email, 'Password123!').then((r) =>
      r.json<{ token: string }>(),
    );
    const { token: tokenB } = await signIn(email, 'Password123!').then((r) =>
      r.json<{ token: string }>(),
    );
    // Two independent sessions — tokens must differ.
    expect(tokenA).not.toBe(tokenB);
    // Both tokens must be valid.
    const s1 = await getSession(tokenA).then((r) => r.json<{ session: object }>());
    const s2 = await getSession(tokenB).then((r) => r.json<{ session: object }>());
    expect(s1.session).toBeTruthy();
    expect(s2.session).toBeTruthy();
  });
});

// ─── Sign-out ─────────────────────────────────────────────────────────────────

describe('POST /api/auth/sign-out', () => {
  it('invalidates the session — getSession returns null afterwards', async () => {
    const email = uniq();
    await signUp(email, 'Password123!');
    const token = await getToken(email, 'Password123!');

    const signOutRes = await signOut(token);
    expect(signOutRes.status).toBe(200);

    const sessionRes = await getSession(token);
    const body = await sessionRes.json<{ session: null } | null>();
    const session = body && typeof body === 'object' && 'session' in body ? body.session : body;
    expect(session).toBeNull();
  });

  it('does not invalidate a different session for the same user', async () => {
    const email = uniq();
    await signUp(email, 'Password123!');
    const token1 = await getToken(email, 'Password123!');
    const token2 = await getToken(email, 'Password123!');

    await signOut(token1);

    // token1 is gone but token2 must still work.
    const res = await getSession(token2);
    const { session } = await res.json<{ session: object }>();
    expect(session).toBeTruthy();
  });

  it('user can sign back in after sign-out', async () => {
    const email = uniq();
    await signUp(email, 'Password123!');
    const token = await getToken(email, 'Password123!');
    await signOut(token);

    const res = await signIn(email, 'Password123!');
    expect(res.status).toBe(200);
    const { token: newToken } = await res.json<{ token: string }>();
    expect(newToken).toBeTruthy();
    expect(newToken).not.toBe(token);
  });
});

// ─── JWKS endpoint ────────────────────────────────────────────────────────────

describe('GET /api/auth/jwks', () => {
  it('returns a JWKS object with at least one key', async () => {
    const res = await authReq('jwks');
    expect(res.status).toBe(200);
    const body = await res.json<{ keys?: unknown[] }>();
    expect(Array.isArray(body.keys)).toBe(true);
    expect((body.keys ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it('returned keys contain required JWK fields', async () => {
    const res = await authReq('jwks');
    const { keys } = await res.json<{ keys: Array<Record<string, unknown>> }>();
    const key = keys[0];
    // RSA public key fields
    expect(key).toHaveProperty('kty');
    expect(key).toHaveProperty('kid');
    // The public key must not leak the private key exponent
    expect(key).not.toHaveProperty('d');
  });
});

// ─── Forget-password (no user enumeration) ───────────────────────────────────

describe('POST /api/auth/request-password-reset', () => {
  it('returns 200 for a known email', async () => {
    const email = uniq();
    await signUp(email, 'Password123!');
    const res = await authReq('request-password-reset', {
      method: 'POST',
      body: JSON.stringify({ email, redirectTo: `${TEST_BASE_URL}/reset` }),
    });
    expect(res.status).toBe(200);
  });

  it('returns 200 for an unknown email — no user enumeration', async () => {
    const res = await authReq('request-password-reset', {
      method: 'POST',
      body: JSON.stringify({
        email: 'nobody-exists@nowhere.test',
        redirectTo: `${TEST_BASE_URL}/reset`,
      }),
    });
    // MUST be the same status as for a known email so callers cannot tell whether
    // the account exists.
    expect(res.status).toBe(200);
  });
});

// ─── Lock-out prevention (critical) ──────────────────────────────────────────

describe('lock-out prevention', () => {
  it('repeated wrong passwords do not block a subsequent valid login', async () => {
    const email = uniq();
    await signUp(email, 'Password123!');

    // Five consecutive bad passwords — simulates an attacker or a user who
    // keeps mistyping before they remember.
    for (let i = 0; i < 5; i++) {
      await signIn(email, `WrongPass${i}!`);
    }

    // Valid credentials must still work.
    const res = await signIn(email, 'Password123!');
    expect(res.status).toBe(200);
    const { token } = await res.json<{ token: string }>();
    expect(token).toBeTruthy();
  });

  it('a sign-out does not delete the user account', async () => {
    const email = uniq();
    await signUp(email, 'Password123!');
    const token = await getToken(email, 'Password123!');
    await signOut(token);

    // User still exists in the DB.
    const db = createDb();
    const [user] = await db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.email, email));
    expect(user?.email).toBe(email);
  });

  it('multiple concurrent sessions survive individual sign-outs', async () => {
    const email = uniq();
    await signUp(email, 'Password123!');

    // Create three sessions.
    const [token0, token1, token2]: [string, string, string] = await Promise.all([
      getToken(email, 'Password123!'),
      getToken(email, 'Password123!'),
      getToken(email, 'Password123!'),
    ]);

    // Sign out of the first session.
    await signOut(token0);

    // The other two sessions must remain valid.
    const results = await Promise.all([
      getSession(token1).then((r) => r.json<{ session: object | null }>()),
      getSession(token2).then((r) => r.json<{ session: object | null }>()),
    ]);
    for (const { session } of results) {
      expect(session).toBeTruthy();
    }
  });

  it('changing password does not happen silently — a wrong token cannot reset', async () => {
    const email = uniq();
    await signUp(email, 'Password123!');
    const goodToken = await getToken(email, 'Password123!');

    // Attempt reset with a bogus token — must fail, not silently succeed.
    const resetRes = await authReq('reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'bogus-reset-token', newPassword: 'Hacked1234!', email }),
    });
    expect(resetRes.status).toBeGreaterThanOrEqual(400);

    // Original credentials must still work after the failed reset attempt.
    const loginRes = await signIn(email, 'Password123!');
    expect(loginRes.status).toBe(200);
    expect(goodToken).toBeTruthy();
  });
});

// ─── End-to-end: real session → Elysia route ─────────────────────────────────

describe('end-to-end session token flow', () => {
  it('session token from sign-in authenticates an Elysia-protected route', async () => {
    // Register a user through the real Better Auth flow.
    const email = uniq();
    await signUp(email, 'Password123!');
    const token = await getToken(email, 'Password123!');
    expect(token).toBeTruthy();

    // Override getAuth for this specific request so the Elysia authPlugin
    // validates real Better Auth sessions instead of HS256 test JWTs.
    vi.mocked(getAuth).mockResolvedValueOnce(realAuth);

    // Build a minimal Elysia app that uses the real auth middleware.
    const testApp = new Elysia()
      .use(authPlugin)
      .get('/me', ({ user }) => ({ userId: user.userId, email: user.email }), {
        isAuthenticated: true,
      });

    const res = await testApp.handle(
      new Request('http://localhost/me', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ email: string }>();
    expect(body.email).toBe(email);
  });

  it('an invalid token returns 401 from an Elysia-protected route', async () => {
    vi.mocked(getAuth).mockResolvedValueOnce(realAuth);

    const testApp = new Elysia()
      .use(authPlugin)
      .get('/me', ({ user }) => ({ userId: user.userId }), { isAuthenticated: true });

    const res = await testApp.handle(
      new Request('http://localhost/me', {
        headers: { Authorization: 'Bearer totally-fake-token' },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('a signed-out token returns 401 from an Elysia-protected route', async () => {
    const email = uniq();
    await signUp(email, 'Password123!');
    const token = await getToken(email, 'Password123!');
    await signOut(token);

    vi.mocked(getAuth).mockResolvedValueOnce(realAuth);

    const testApp = new Elysia()
      .use(authPlugin)
      .get('/me', ({ user }) => ({ userId: user.userId }), { isAuthenticated: true });

    const res = await testApp.handle(
      new Request('http://localhost/me', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('sign-out of one session leaves Elysia access intact for another', async () => {
    const email = uniq();
    await signUp(email, 'Password123!');
    const tokenA = await getToken(email, 'Password123!');
    const tokenB = await getToken(email, 'Password123!');

    await signOut(tokenA);

    // tokenB must still work for Elysia route access.
    vi.mocked(getAuth).mockResolvedValueOnce(realAuth);

    const testApp = new Elysia()
      .use(authPlugin)
      .get('/me', ({ user }) => ({ userId: user.userId }), { isAuthenticated: true });

    const res = await testApp.handle(
      new Request('http://localhost/me', {
        headers: { Authorization: `Bearer ${tokenB}` },
      }),
    );
    expect(res.status).toBe(200);
  });
});
