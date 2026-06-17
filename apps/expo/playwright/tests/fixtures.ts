import { type Browser, type BrowserContext, test as base, type Page } from '@playwright/test';
import { STORAGE_STATE } from './globalSetup';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8098';
export const API_URL = process.env.API_URL ?? 'http://localhost:8787';

/**
 * Creates a browser context pre-authenticated from the storage state saved by
 * globalSetup (the Better Auth session cookie + hydrated user store). On web
 * the session lives in the cookie, so the api client authenticates via
 * credentials: 'include' — there is no bearer token to seed.
 */
async function createAuthedContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ storageState: STORAGE_STATE });
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
