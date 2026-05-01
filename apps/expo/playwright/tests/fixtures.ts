import { type Browser, type BrowserContext, test as base, type Page } from '@playwright/test';
import { AUTH_STATE_PATH } from './globalSetup';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8081';

async function createAuthedContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ storageState: AUTH_STATE_PATH });
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
export const API_URL = process.env.API_URL ?? 'http://localhost:8787';
