/**
 * Playwright global setup — runs once before all tests.
 *
 * Priority order for obtaining throwaway auth credentials:
 *   1. TEST_ACCESS_TOKEN — legacy token path, retained for CI compatibility.
 *   2. TEST_EMAIL + TEST_PASSWORD — verifies the seeded E2E user can log in.
 *   3. Fallback — signs up a fresh ephemeral Better Auth user for local dev.
 *
 * The resulting credentials are written to .auth-tokens.json so normal-user
 * specs can sign in through the UI.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const API_URL = process.env.API_URL ?? 'http://localhost:8787';
const AUTH_ORIGIN = process.env.AUTH_ORIGIN ?? API_URL;

export const TOKENS_FILE = path.join(__dirname, '../.auth-tokens.json');

const DEFAULT_TEST_USER = {
  id: 'e2e-user',
  email: 'e2e@packrat.test',
  firstName: 'E2E',
  lastName: 'User',
  role: 'USER',
  emailVerified: true,
  avatarUrl: null,
  createdAt: null,
  updatedAt: null,
  preferredWeightUnit: 'g',
};
const DEFAULT_TEST_PASSWORD = 'E2eTest1!';

function getProvidedUser(): Record<string, unknown> | null {
  if (!process.env.TEST_USER_JSON) return null;
  return JSON.parse(process.env.TEST_USER_JSON) as Record<string, unknown>;
}

async function setup() {
  // Priority 1: pre-minted tokens provided directly
  if (process.env.TEST_ACCESS_TOKEN) {
    let user = getProvidedUser();
    if (!user) {
      try {
        const meRes = await fetch(`${API_URL}/api/auth/get-session`, {
          headers: { Authorization: `Bearer ${process.env.TEST_ACCESS_TOKEN}` },
        });
        user = meRes.ok
          ? (((await meRes.json()) as { user?: Record<string, unknown> }).user ?? null)
          : null;
      } catch {
        user = DEFAULT_TEST_USER;
      }
    }
    fs.writeFileSync(
      TOKENS_FILE,
      JSON.stringify({
        accessToken: process.env.TEST_ACCESS_TOKEN,
        refreshToken: process.env.TEST_REFRESH_TOKEN ?? '',
        email: (user?.email as string | undefined) ?? DEFAULT_TEST_USER.email,
        password: process.env.TEST_PASSWORD ?? DEFAULT_TEST_PASSWORD,
        authMode: 'token',
        user: user ?? DEFAULT_TEST_USER,
      }),
    );
    console.log('[globalSetup] Using tokens from TEST_ACCESS_TOKEN env var');
    return;
  }

  // Priority 2: log in with the seeded E2E user (CI path, matches iOS/Android pattern)
  if (process.env.TEST_EMAIL && process.env.TEST_PASSWORD) {
    const loginRes = await fetch(`${API_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: AUTH_ORIGIN },
      body: JSON.stringify({ email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD }),
    });
    if (!loginRes.ok) {
      const body = await loginRes.text();
      throw new Error(`Login failed ${loginRes.status}: ${body}`);
    }
    const { token, user } = (await loginRes.json()) as {
      token: string;
      user: Record<string, unknown>;
    };
    fs.writeFileSync(
      TOKENS_FILE,
      JSON.stringify({
        accessToken: token,
        refreshToken: '',
        email: process.env.TEST_EMAIL,
        password: process.env.TEST_PASSWORD,
        authMode: 'credentials',
        user,
      }),
    );
    console.log(`[globalSetup] Logged in as ${process.env.TEST_EMAIL}`);
    return;
  }

  // Priority 3: sign up a fresh ephemeral Better Auth user (local dev fallback)
  const email = `e2e-${Date.now()}@packrat.test`;
  const password = DEFAULT_TEST_PASSWORD;

  const registerRes = await fetch(`${API_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: AUTH_ORIGIN },
    body: JSON.stringify({ email, password, name: 'E2E User' }),
  });
  if (!registerRes.ok) {
    const body = await registerRes.text();
    throw new Error(`Register failed ${registerRes.status}: ${body}`);
  }
  console.log(`[globalSetup] Registered ${email}`);

  const { token, user } = (await registerRes.json()) as {
    token: string;
    user: Record<string, unknown>;
  };

  fs.writeFileSync(
    TOKENS_FILE,
    JSON.stringify({
      accessToken: token,
      refreshToken: '',
      email,
      password,
      authMode: 'credentials',
      user,
    }),
  );
}

export default setup;
