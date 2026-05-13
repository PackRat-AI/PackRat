import { type Browser, type BrowserContext, test as base, type Page } from '@playwright/test';
import { AUTH_STATE_PATH } from './globalSetup';

const TRAILING_SLASH_RE = /\/$/;
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8081';
export const API_URL = process.env.API_URL ?? 'http://localhost:8787';

async function createAuthedContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({ storageState: AUTH_STATE_PATH });
  // Strip Origin header so Better Auth's trustedOrigins check doesn't reject
  // requests from localhost:8081 with INVALID_ORIGIN.
  const apiBase = API_URL.replace(TRAILING_SLASH_RE, '');
  await context.route(
    (url) => url.href.startsWith(apiBase),
    async (route) => {
      const headers = { ...route.request().headers() };
      delete headers.origin;
      try {
        const response = await route.fetch({ headers });
        await route.fulfill({ response });
      } catch {
        // Context may be disposed when a request fires during context.close().
        await route.abort().catch(() => {});
      }
    },
  );
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
