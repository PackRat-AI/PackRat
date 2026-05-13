import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromium } from '@playwright/test';

const DASHBOARD_TAB_RE = /Dashboard/i;
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8081';
export const AUTH_STATE_PATH = path.join(__dirname, '../.auth/state.json');

export default async function setup() {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    throw new Error('TEST_EMAIL and TEST_PASSWORD must be set');
  }

  fs.mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture ALL page console output so CI logs reveal JS errors, warnings,
  // auth client messages, etc.
  page.on('console', (msg) => {
    console.log(`[page:${msg.type()}]`, msg.text());
  });

  // Capture every network request so we can see what URLs are hit (or not hit).
  page.on('request', (req) => {
    console.log('[req]', req.method(), req.url());
  });
  page.on('response', (res) => {
    console.log('[res]', res.status(), res.url());
  });

  // Start from the auth entry screen, then click through to login
  await page.goto(`${BASE_URL}/auth`, { waitUntil: 'load' });

  await page.getByTestId('sign-in-email-button').waitFor({ timeout: 15_000 });
  await page.getByTestId('sign-in-email-button').click();

  await page.getByTestId('email-input').waitFor({ timeout: 15_000 });
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);

  // Read the React props directly off the DOM elements to verify that
  // fill() actually updated the tanstack-form field state (not just DOM value).
  const postFillState = await page.evaluate(() => {
    const getReactValue = (sel: string): string => {
      const el = document.querySelector(sel);
      if (!el) return 'NOT_FOUND';
      const propsKey = Object.keys(el).find((k) => k.startsWith('__reactProps'));
      if (!propsKey) return 'NO_REACT_PROPS';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return String((el as any)[propsKey]?.value ?? 'UNDEFINED');
    };
    const btn = document.querySelector('[data-testid="continue-button"]');
    return {
      emailReactValue: getReactValue('[data-testid="email-input"]'),
      pwdReactLen: (() => {
        const v = getReactValue('[data-testid="password-input"]');
        return v.length;
      })(),
      btnAriaDisabled: btn?.getAttribute('aria-disabled') ?? 'NO_ATTR',
      btnPointerEvents: btn ? window.getComputedStyle(btn).pointerEvents : 'N/A',
    };
  });
  console.log('[globalSetup] post-fill React state:', JSON.stringify(postFillState));

  // Use locator.press('Enter') which explicitly targets the password input
  // (more reliable than page.keyboard which depends on current focus state).
  const [signInResponse] = await Promise.all([
    page.waitForResponse(
      (r) => {
        const method = r.request().method();
        const url = r.url();
        if (method === 'POST') console.log('[globalSetup] POST response:', url, r.status());
        // Catch any POST — the URL check is just for the specific sign-in path.
        return method === 'POST' && url.includes('/sign-in/email');
      },
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
