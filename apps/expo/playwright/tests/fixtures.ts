import * as fs from 'node:fs';
import * as path from 'node:path';
import { type Browser, type BrowserContext, test as base, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8081';
export const API_URL = process.env.API_URL ?? 'http://localhost:8787';

const TOKENS_FILE = path.join(__dirname, '../.auth-tokens.json');

interface CachedAuth {
  accessToken: string;
  refreshToken: string;
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
 *   - access_token / refresh_token  → read by expo-sqlite kv-store stub + tokenAtom
 *   - user                         → read by ObservablePersistLocalStorage to hydrate userStore
 *                                     (isAuthed is computed from userStore !== null)
 *
 * Using storageState guarantees the values are present before ANY page JS runs.
 */
async function createAuthedContext(browser: Browser): Promise<BrowserContext> {
  const { accessToken, refreshToken, user } = loadCachedAuth();

  // On web, expo-secure-store falls back to localStorage. The api client reads the
  // Better Auth session token from localStorage['packrat_cookie'] via SecureStore.
  // Seed both the legacy access_token key (for any direct reads) and the
  // packrat_cookie key (for apiClient.getAccessToken via parseSessionToken).
  const cookiePayload = JSON.stringify({
    'better-auth.session_token': { value: accessToken },
    '__Secure-better-auth.session_token': { value: accessToken },
  });

  const localStorage = [
    { name: 'access_token', value: accessToken },
    { name: 'refresh_token', value: refreshToken },
    // Seed the SecureStore key used by apiClient (expo-secure-store → localStorage on web)
    { name: 'packrat_cookie', value: cookiePayload },
    // Prevent useAuthInit's version-gate migration from clearing the tokens above.
    // On web AsyncStorage is shimmed to raw localStorage (mocks/async-storage.ts).
    { name: 'auth_version', value: 'v2' },
  ];

  if (user) {
    localStorage.push({ name: 'user', value: JSON.stringify(user) });
  }

  return browser.newContext({
    storageState: {
      cookies: [],
      origins: [{ origin: BASE_URL, localStorage }],
    },
  });
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
