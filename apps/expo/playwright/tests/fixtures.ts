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
 *   - access_token / refresh_token  → read by expo-sqlite kv-store stub + tokenAtom
 *   - user                         → read by ObservablePersistLocalStorage to hydrate userStore
 *                                     (isAuthed is computed from userStore !== null)
 *
 * Using storageState guarantees the values are present before ANY page JS runs.
 */
async function createAuthedContext(browser: Browser): Promise<BrowserContext> {
  const { accessToken, refreshToken, user } = loadCachedAuth();

  const localStorage: { name: string; value: string }[] = [
    { name: 'access_token', value: accessToken },
  ];

  if (refreshToken) {
    localStorage.push({ name: 'refresh_token', value: refreshToken });
  }

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
