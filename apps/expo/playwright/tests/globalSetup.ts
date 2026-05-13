import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromium } from '@playwright/test';

const DASHBOARD_TAB_RE = /Dashboard/i;
const TRAILING_SLASH_RE = /\/$/;
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8081';
const API_URL = process.env.API_URL ?? 'http://localhost:8787';
export const AUTH_STATE_PATH = path.join(__dirname, '../.auth/state.json');

export default async function setup() {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    throw new Error('TEST_EMAIL and TEST_PASSWORD must be set');
  }

  fs.mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });

  // --disable-web-security bypasses browser-side CORS enforcement.
  // context.route() below strips the Origin header so Better Auth's
  // server-side origin check also passes (it guards: if origin && !trusted).
  const browser = await chromium.launch({
    args: ['--disable-web-security', '--disable-site-isolation-trials'],
  });
  const context = await browser.newContext();

  // Strip Origin header from all API requests so Better Auth's server-side
  // trustedOrigins check doesn't reject them with INVALID_ORIGIN.
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
        // Context may be disposed if a request fires while the browser is closing.
        await route.abort().catch(() => {});
      }
    },
  );

  const page = await context.newPage();

  // Capture console errors so CI logs show any auth failures.
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('[page:error]', msg.text());
  });

  await page.goto(`${BASE_URL}/auth`, { waitUntil: 'load' });

  await page.getByTestId('sign-in-email-button').waitFor({ timeout: 15_000 });
  await page.getByTestId('sign-in-email-button').click();

  // fill() uses Playwright's CDP path which fires real browser input events,
  // correctly updating React/tanstack-form field state (verified via React
  // props diagnostic in a prior run). locator.press('Enter') targets the
  // focused password input directly and triggers onSubmitEditing →
  // form.handleSubmit().
  await page.getByTestId('email-input').waitFor({ timeout: 15_000 });
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);

  const [signInResponse] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/sign-in/email') && r.request().method() === 'POST',
      { timeout: 30_000 },
    ),
    page.getByTestId('password-input').press('Enter'),
  ]);

  if (!signInResponse.ok()) {
    const body = await signInResponse.text().catch(() => '');
    throw new Error(`Sign-in failed (${signInResponse.status()}): ${body}`);
  }

  await page.goto(`${BASE_URL}/`, { waitUntil: 'load' });
  await page.getByRole('tab', { name: DASHBOARD_TAB_RE }).waitFor({ timeout: 15_000 });

  await context.storageState({ path: AUTH_STATE_PATH });
  console.log(`[globalSetup] Logged in as ${email}`);

  await browser.close();
}
