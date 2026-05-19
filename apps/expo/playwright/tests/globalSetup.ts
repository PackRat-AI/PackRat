/**
 * Playwright global setup — runs once before all tests.
 *
 * Priority order for obtaining auth tokens:
 *   1. TEST_ACCESS_TOKEN + TEST_REFRESH_TOKEN — used directly (no API call)
 *   2. TEST_EMAIL + TEST_PASSWORD — logs in against the API (matches the
 *      iOS/Android Maestro pattern: seed the user, then log in with credentials)
 *   3. Fallback — registers a fresh ephemeral user, reads the OTP from the DB,
 *      and verifies email to obtain tokens (useful for local development)
 *
 * The resulting tokens are written to .auth-tokens.json so the authedPage
 * fixture can seed localStorage without hitting auth on every test.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { neon } from '@neondatabase/serverless';

const API_URL = process.env.API_URL ?? 'http://localhost:8787';
const DB_URL = process.env.NEON_DATABASE_URL ?? '***REDACTED_DB_URL***';

export const TOKENS_FILE = path.join(__dirname, '../.auth-tokens.json');

async function setup() {
  // Priority 1: pre-minted tokens provided directly
  if (process.env.TEST_ACCESS_TOKEN && process.env.TEST_REFRESH_TOKEN) {
    const meRes = await fetch(`${API_URL}/api/auth/get-session`, {
      headers: { Authorization: `Bearer ${process.env.TEST_ACCESS_TOKEN}` },
    });
    const body = meRes.ok ? ((await meRes.json()) as { user?: Record<string, unknown> }) : null;
    const user = body?.user ?? null;
    fs.writeFileSync(
      TOKENS_FILE,
      JSON.stringify({
        accessToken: process.env.TEST_ACCESS_TOKEN,
        refreshToken: process.env.TEST_REFRESH_TOKEN,
        user,
      }),
    );
    console.log('[globalSetup] Using tokens from TEST_ACCESS_TOKEN env var');
    return;
  }

  // Priority 2: log in with the seeded E2E user (CI path, matches iOS/Android pattern)
  if (process.env.TEST_EMAIL && process.env.TEST_PASSWORD) {
    const loginRes = await fetch(`${API_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD }),
    });
    if (!loginRes.ok) {
      const body = await loginRes.text();
      throw new Error(`Login failed ${loginRes.status}: ${body}`);
    }
    // Better Auth sign-in returns { user, session: { token } }.
    // The bearer() plugin also surfaces the token at the top-level { token } field.
    const body = (await loginRes.json()) as {
      token?: string;
      user: Record<string, unknown>;
      session?: { token?: string };
    };
    const token = body.token ?? body.session?.token;
    if (!token) throw new Error('No session token in sign-in response');
    fs.writeFileSync(TOKENS_FILE, JSON.stringify({ accessToken: token, refreshToken: token, user: body.user }));
    console.log(`[globalSetup] Logged in as ${process.env.TEST_EMAIL}`);
    return;
  }

  // Priority 3: register a fresh ephemeral user (local dev fallback)
  const email = `e2e-${Date.now()}@packrat.test`;
  const password = 'E2eTest1!';

  // 1. Register
  const registerRes = await fetch(`${API_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'E2E User' }),
  });
  if (!registerRes.ok) {
    const body = await registerRes.text();
    throw new Error(`Register failed ${registerRes.status}: ${body}`);
  }
  console.log(`[globalSetup] Registered ${email}`);

  // 2. Fetch OTP directly from the database
  const sql = neon(DB_URL);
  const rows = await sql`
    SELECT otp.code
    FROM one_time_passwords otp
    JOIN users u ON u.id = otp.user_id
    WHERE u.email = ${email}
    ORDER BY otp.expires_at DESC
    LIMIT 1
  `;

  const code = (rows[0] as { code: string } | undefined)?.code;
  if (!code) throw new Error(`No OTP found in DB for ${email}`);
  console.log(`[globalSetup] Got OTP from DB`);

  // 3. Verify email
  const verifyRes = await fetch(`${API_URL}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  if (!verifyRes.ok) {
    const body = await verifyRes.text();
    throw new Error(`Verify failed ${verifyRes.status}: ${body}`);
  }
  // After verification, sign in to obtain a session token
  const signInRes = await fetch(`${API_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!signInRes.ok) {
    const body = await signInRes.text();
    throw new Error(`Post-verify sign-in failed ${signInRes.status}: ${body}`);
  }
  const signInBody = (await signInRes.json()) as {
    token?: string;
    user: Record<string, unknown>;
    session?: { token?: string };
  };
  const token = signInBody.token ?? signInBody.session?.token;
  if (!token) throw new Error('No session token in post-verify sign-in response');
  console.log('[globalSetup] Email verified, tokens obtained');

  fs.writeFileSync(TOKENS_FILE, JSON.stringify({ accessToken: token, refreshToken: token, user: signInBody.user }));
}

export default setup;
