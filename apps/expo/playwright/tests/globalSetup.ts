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
    let user: Record<string, unknown> | null = null;
    try {
      const meRes = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${process.env.TEST_ACCESS_TOKEN}` },
      });
      user = meRes.ok ? ((await meRes.json()) as { user: Record<string, unknown> }).user : null;
    } catch {
      // API unreachable — trust the provided token and continue without user info
      console.warn(
        `[globalSetup] Could not reach ${API_URL}/api/auth/me; proceeding with provided token`,
      );
    }
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

  // Priority 2: create a session directly in the DB (CI path — avoids HTTP auth issues
  // when EXPO_PUBLIC_API_URL is a same-origin URL that doesn't serve /api/auth locally)
  if (process.env.TEST_EMAIL && DB_URL && DB_URL !== '***REDACTED_DB_URL***') {
    const sql = neon(DB_URL);
    const rows = await sql`
      SELECT id, email, name, role, first_name AS "firstName", last_name AS "lastName"
      FROM users
      WHERE email = ${process.env.TEST_EMAIL.toLowerCase()}
      LIMIT 1
    `;
    const dbUser = rows[0] as
      | {
          id: string;
          email: string;
          name: string;
          role: string;
          firstName: string | null;
          lastName: string | null;
        }
      | undefined;
    if (dbUser) {
      const token = crypto.randomUUID();
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await sql`
        INSERT INTO session (id, expires_at, token, user_id, created_at, updated_at)
        VALUES (${sessionId}, ${expiresAt.toISOString()}, ${token}, ${dbUser.id}, NOW(), NOW())
        ON CONFLICT (token) DO NOTHING
      `;
      fs.writeFileSync(
        TOKENS_FILE,
        JSON.stringify({ accessToken: token, refreshToken: null, user: dbUser }),
      );
      console.log(`[globalSetup] Created DB session for ${process.env.TEST_EMAIL}`);
      return;
    }
  }

  // Priority 3: log in with the seeded E2E user via HTTP API
  if (process.env.TEST_EMAIL && process.env.TEST_PASSWORD) {
    let loginRes: Response;
    try {
      loginRes = await fetch(`${API_URL}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: API_URL },
        body: JSON.stringify({
          email: process.env.TEST_EMAIL,
          password: process.env.TEST_PASSWORD,
        }),
      });
    } catch (err) {
      throw new Error(
        `[globalSetup] Cannot reach API at ${API_URL}. ` +
          `Ensure the API server is running (bun api) or set TEST_ACCESS_TOKEN directly.\nCause: ${err}`,
      );
    }
    if (!loginRes.ok) {
      const body = await loginRes.text();
      throw new Error(`Login failed ${loginRes.status}: ${body}`);
    }
    const { token: accessToken, user } = (await loginRes.json()) as {
      token: string;
      user: Record<string, unknown>;
    };
    fs.writeFileSync(TOKENS_FILE, JSON.stringify({ accessToken, refreshToken: null, user }));
    console.log(`[globalSetup] Logged in as ${process.env.TEST_EMAIL}`);
    return;
  }

  // Priority 4: register a fresh ephemeral user (local dev fallback)
  // Better Auth endpoint is /sign-up/email; requireEmailVerification=false + autoSignIn=true
  // means the response already contains a session token — no OTP step needed.
  const email = `e2e-${Date.now()}@packrat.test`;
  const password = 'E2eTest1!';

  let registerRes: Response;
  try {
    registerRes = await fetch(`${API_URL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: API_URL },
      body: JSON.stringify({ email, password, name: 'E2E User' }),
    });
  } catch (err) {
    throw new Error(
      `[globalSetup] Cannot reach API at ${API_URL}. ` +
        `For local dev, start the API server with \`bun api\` or set TEST_ACCESS_TOKEN + TEST_REFRESH_TOKEN env vars.\nCause: ${err}`,
    );
  }
  if (!registerRes.ok) {
    const body = await registerRes.text();
    throw new Error(`Register failed ${registerRes.status}: ${body}`);
  }
  const { token: accessToken, user } = (await registerRes.json()) as {
    token: string;
    user: Record<string, unknown>;
  };
  if (!accessToken) throw new Error('No token in sign-up response');
  console.log(`[globalSetup] Registered and signed in as ${email}`);

  fs.writeFileSync(TOKENS_FILE, JSON.stringify({ accessToken, refreshToken: null, user }));
}

export default setup;
