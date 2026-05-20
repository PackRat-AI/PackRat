import * as fs from 'node:fs';
import * as path from 'node:path';
import { type Browser, type BrowserContext, test as base, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8081';
export const API_URL = process.env.API_URL ?? 'http://localhost:8787';

const TOKENS_FILE = path.join(__dirname, '../.auth-tokens.json');

interface CachedAuth {
  accessToken: string;
  refreshToken: string | null;
  user: Record<string, unknown> | null;
}

function loadCachedAuth(): CachedAuth {
  if (!fs.existsSync(TOKENS_FILE)) {
    throw new Error(`Auth tokens file not found at ${TOKENS_FILE}. Did globalSetup run?`);
  }
  // safe-cast: JSON.parse result is validated implicitly by the known file format written by globalSetup
  return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf-8')) as CachedAuth;
}

/**
 * Creates a browser context with auth pre-seeded in localStorage:
 *   - access_token / refresh_token  → read by expo-sqlite kv-store stub
 *   - user                         → read by observablePersistAsyncStorage to hydrate userStore
 *                                     (isAuthed is computed from userStore !== null)
 *   - auth_version = 'v2'          → skips the runVersionGateMigration that would otherwise
 *                                     delete access_token / refresh_token on first app boot
 *
 * Using storageState guarantees the values are present before ANY page JS runs.
 *
 * A context-level route intercept mocks /api/auth/get-session so the background
 * session check in useAuthInit does not redirect to /auth.  On web the expoClient
 * plugin uses browser cookies (not SecureStore) for getSession, and the test
 * browser has no valid session cookie, so without the intercept every test fails.
 */
async function createAuthedContext(browser: Browser): Promise<BrowserContext> {
  const { accessToken, refreshToken, user } = loadCachedAuth();

  const localStorage: { name: string; value: string }[] = [
    { name: 'access_token', value: accessToken },
    // Skip the auth version migration that clears access_token / refresh_token.
    { name: 'auth_version', value: 'v2' },
  ];

  if (refreshToken) {
    localStorage.push({ name: 'refresh_token', value: refreshToken });
  }

  if (user) {
    localStorage.push({ name: 'user', value: JSON.stringify(user) });
  }

  const context = await browser.newContext({
    storageState: {
      cookies: [],
      origins: [{ origin: BASE_URL, localStorage }],
    },
  });

  // Mock the Better Auth session endpoint so useAuthInit stays authenticated.
  // On web, @better-auth/expo skips its SecureStore cookie handling (isWeb guard)
  // and relies on browser cookies instead.  The test browser has no valid
  // session cookie, so without this intercept getSession() returns null and the
  // auth init redirects every page to /auth.
  if (user) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();
    await context.route('**/api/auth/get-session', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session: {
            id: 'e2e-session',
            userId: String(user.id),
            token: accessToken,
            expiresAt,
            createdAt: now,
            updatedAt: now,
            ipAddress: null,
            userAgent: null,
          },
          user,
        }),
      }),
    );
  }

  return context;
}

export type AuthFixtures = { authedPage: Page };

export const test = base.extend<AuthFixtures>({
  authedPage: async ({ browser }, use) => {
    const context = await createAuthedContext(browser);
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
export { BASE_URL };
