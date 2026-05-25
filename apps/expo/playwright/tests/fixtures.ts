import * as fs from 'node:fs';
import * as path from 'node:path';
import { test as base, expect, type Page } from '@playwright/test';
import { z } from 'zod';
import { testIds } from '../../lib/testIds';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8081';
export const API_URL = process.env.API_URL ?? 'http://localhost:8787';

const TOKENS_FILE = path.join(__dirname, '../.auth-tokens.json');
const AUTHENTICATED_APP_TEXT = /Dashboard|Packs/i;

const CachedAuthSchema = z.object({
  accessToken: z.string(),
  authMode: z.enum(['credentials', 'token']).optional(),
  refreshToken: z.string(),
  email: z.string().email(),
  password: z.string(),
  user: z.record(z.string(), z.unknown()).nullable(),
});

type CachedAuth = z.infer<typeof CachedAuthSchema>;

export function loadCachedAuth(): CachedAuth {
  if (!fs.existsSync(TOKENS_FILE)) {
    throw new Error(`Auth tokens file not found at ${TOKENS_FILE}. Did globalSetup run?`);
  }
  return CachedAuthSchema.parse(JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf-8')));
}

export type AuthFixtures = {
  authCredentials: Pick<CachedAuth, 'email' | 'password'>;
  signedInPage: Page;
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

export async function signInViaUi(page: Page, credentials: Pick<CachedAuth, 'email' | 'password'>) {
  await page.goto(`${BASE_URL}/auth`);
  await page.getByTestId(testIds.auth.signInEmailBtn).click();
  await page.locator('input[type="email"]').fill(credentials.email);
  await page.locator('input[type="password"]').fill(credentials.password);

  const signInResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/auth/sign-in/email') && response.request().method() === 'POST',
    { timeout: 20_000 },
  );
  await page.getByTestId(testIds.auth.continueBtn).click();
  expect((await signInResponse).ok()).toBeTruthy();
  await expect(page.getByText(AUTHENTICATED_APP_TEXT).first()).toBeVisible({ timeout: 15_000 });
}

export const test = base.extend<AuthFixtures>({
  signedInPage: async ({ page, authCredentials }, use) => {
    await signInViaUi(page, authCredentials);
    await use(page);
  },
  authCredentials: async ({ context: _context }, use) => {
    const { email, password } = loadCachedAuth();
    await use({ email, password });
  },
});

export { expect };
export { BASE_URL };
