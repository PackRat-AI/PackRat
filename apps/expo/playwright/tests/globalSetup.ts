/**
 * Playwright global setup — runs once before all tests.
 *
 * Signs the seeded e2e user in through Better Auth and saves the resulting
 * browser storage state (the `better-auth.session_token` cookie plus the
 * hydrated user store) to `.auth-state.json`. The `authedPage` fixture loads
 * that state so every test starts authenticated without logging in again.
 *
 * The sign-in request is issued from the page context (not Node) so the
 * browser persists the Set-Cookie session token exactly as a real login would.
 * On web the bearer token lives in an HttpOnly cookie that JS can't read, so
 * cookie-based auth (credentials: 'include') is the only path — there is no
 * access/refresh token to cache.
 */
import * as path from 'node:path';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8098';
const API_URL = process.env.API_URL ?? 'http://localhost:8798';
const EMAIL = process.env.TEST_EMAIL ?? 'e2e@packrattest.local';
const PASSWORD = process.env.TEST_PASSWORD ?? 'E2eTestPass123!';

// Local Ubuntu has no Playwright-bundled Chromium; set PW_CHANNEL=chrome to use
// the system browser. CI installs Chromium normally and leaves PW_CHANNEL unset.
const CHANNEL = process.env.PW_CHANNEL || undefined;

export const STORAGE_STATE = path.join(__dirname, '../.auth-state.json');

async function setup() {
  const browser = await chromium.launch({ channel: CHANNEL });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Establish the web origin so the session cookie is scoped to it.
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    // Sign in from the page context so the browser stores the session cookie.
    // Retry transient 5xx — a local wrangler dev worker talking to a raw
    // Postgres (no Hyperdrive) occasionally drops a pooled connection.
    let result = { status: 0, body: '' };
    for (let attempt = 1; attempt <= 5; attempt++) {
      result = await page.evaluate(
        async ({ api, email, password }) => {
          try {
            const res = await fetch(`${api}/api/auth/sign-in/email`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password }),
            });
            return { status: res.status, body: await res.text() };
          } catch (err) {
            // A 5xx from the worker may arrive without CORS headers, surfacing
            // as a thrown "Failed to fetch" — treat as a retryable transient.
            return { status: 0, body: String(err) };
          }
        },
        { api: API_URL, email: EMAIL, password: PASSWORD },
      );
      if (result.status === 200) break;
      if (result.status >= 400 && result.status < 500) break; // real auth failure
      await page.waitForTimeout(1000);
    }
    if (result.status !== 200) {
      throw new Error(`Better Auth sign-in failed ${result.status}: ${result.body}`);
    }

    // The session lives in the better-auth.session_token cookie set by the
    // sign-in response. That's all the app needs — on load it calls get-session
    // with the cookie and hydrates its user store itself (showing a loading
    // state rather than redirecting). Capture it into the saved storage state.
    const cookies = await context.cookies();
    if (!cookies.some((c) => c.name === 'better-auth.session_token')) {
      throw new Error('Sign-in succeeded but no better-auth.session_token cookie was set');
    }

    await context.storageState({ path: STORAGE_STATE });
    console.log(`[globalSetup] Signed in as ${EMAIL}; storage state saved`);
  } finally {
    await browser.close();
  }
}

export default setup;
