import * as fs from 'node:fs';
import * as path from 'node:path';
import { type Browser, type BrowserContext, test as base, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8081';
export const API_URL = process.env.API_URL ?? 'http://localhost:8787';

const TOKENS_FILE = path.join(__dirname, '../.auth-tokens.json');

interface CachedAuth {
  accessToken: string;
  authMode?: 'credentials' | 'token';
  refreshToken: string;
  email: string;
  password: string;
  user: Record<string, unknown> | null;
}

export function loadCachedAuth(): CachedAuth {
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
  const { accessToken, authMode, email, password, refreshToken, user } = loadCachedAuth();

  const localStorage = [
    { name: 'access_token', value: accessToken },
    { name: 'refresh_token', value: refreshToken },
    {
      name: 'packrat_cookie',
      value: JSON.stringify({ 'better-auth.session_token': { value: accessToken } }),
    },
  ];

  if (user) {
    localStorage.push({ name: 'user', value: JSON.stringify(user) });
  }

  const context = await browser.newContext();
  if (authMode !== 'token') {
    const loginResponse = await context.request.post(`${API_URL}/api/auth/sign-in/email`, {
      data: { email, password },
      headers: { Origin: process.env.AUTH_ORIGIN ?? API_URL },
    });
    if (!loginResponse.ok()) {
      throw new Error(
        `Context login failed ${loginResponse.status()}: ${await loginResponse.text()}`,
      );
    }
  }

  await context.addInitScript(
    ({ seededLocalStorage }) => {
      for (const { name, value } of seededLocalStorage) {
        window.localStorage.setItem(name, value);
      }
    },
    { seededLocalStorage: localStorage },
  );

  return context;
}

export type AuthFixtures = {
  authedPage: Page;
  authCredentials: Pick<CachedAuth, 'email' | 'password'>;
};

export async function fillInputByTestId({
  page,
  testID,
  value,
}: {
  page: Page;
  testID: string;
  value: string;
}) {
  const input = page.getByTestId(testID);
  await input.waitFor({ state: 'attached' });
  await input.evaluate((node, nextValue) => {
    const element = node as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(element, nextValue);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

export const test = base.extend<AuthFixtures>({
  authedPage: async ({ browser }, use) => {
    const context = await createAuthedContext(browser);
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  authCredentials: async ({ browser: _browser }, use) => {
    const { email, password } = loadCachedAuth();
    await use({ email, password });
  },
});

export { expect } from '@playwright/test';
export { BASE_URL };
