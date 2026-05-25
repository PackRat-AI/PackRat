import { testIds } from '../../lib/testIds';
import { API_URL, BASE_URL, expect, test } from './fixtures';

test.describe('Auth web flow', () => {
  test('signs in through the UI and reaches the authenticated app', async ({
    page,
    authCredentials,
  }) => {
    await page.goto(`${BASE_URL}/auth`);

    await page.getByTestId(testIds.auth.signInEmailBtn).click();
    await page.locator('input[type="email"]').fill(authCredentials.email);
    await page.locator('input[type="password"]').fill(authCredentials.password);
    await page.getByText('Submit', { exact: true }).click();

    await expect(page.getByText(/Dashboard|Packs/i).first()).toBeVisible({ timeout: 15_000 });

    const session = await page.evaluate(async (apiUrl) => {
      const response = await fetch(`${apiUrl}/api/auth/get-session`, {
        credentials: 'include',
      });
      return response.ok ? response.json() : null;
    }, API_URL);
    expect(session?.user?.email).toBe(authCredentials.email);
  });

  test('rejects invalid credentials without creating a session', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`);

    await page.getByTestId(testIds.auth.signInEmailBtn).click();
    await page.locator('input[type="email"]').fill(`missing-${Date.now()}@packrat.test`);
    await page.locator('input[type="password"]').fill('WrongPassword1!');
    const loginPromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/auth/sign-in/email') &&
        response.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await page.getByTestId(testIds.auth.continueBtn).click();

    expect((await loginPromise).ok()).toBeFalsy();
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });

    const session = await page.evaluate(async (apiUrl) => {
      const response = await fetch(`${apiUrl}/api/auth/get-session`, {
        credentials: 'include',
      });
      return response.ok ? response.json() : null;
    }, API_URL);
    expect(session?.user).toBeFalsy();
  });

  test('creates an account and opens email verification', async ({ page }) => {
    const email = `e2e-signup-${Date.now()}@packrat.test`;

    await page.goto(`${BASE_URL}/auth/(create-account)`);

    await page.locator('input').nth(0).fill('Signup');
    await page.locator('input').nth(1).fill('User');
    await page.getByText('Next', { exact: true }).click();

    await expect(page.getByText('Set up your credentials')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId(testIds.auth.createEmailInput).fill(email);
    await page.getByTestId(testIds.auth.createPasswordInput).fill('E2eSignup1!');
    await page.getByTestId(testIds.auth.createConfirmPasswordInput).fill('E2eSignup1!');
    await page.getByTestId(testIds.auth.createConfirmPasswordInput).click();

    const signUpPromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/auth/sign-up/email') &&
        response.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await page.getByTestId(testIds.auth.createConfirmPasswordInput).press('Enter');
    expect((await signUpPromise).ok()).toBeTruthy();

    await page.waitForURL(/\/auth\/one-time-password/, { timeout: 10_000 });
    await expect(page.getByTestId(testIds.auth.otpScreen)).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });

  test('forgot password requests a reset code and opens OTP screen', async ({
    page,
    authCredentials,
  }) => {
    await page.goto(`${BASE_URL}/auth/(login)`);
    await page.getByText(/Forgot Password/i).click();

    await page.getByRole('textbox').fill(authCredentials.email);

    const resetPromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/password-reset/request') &&
        response.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await page.getByText('Send Code', { exact: true }).click();
    expect((await resetPromise).ok()).toBeTruthy();

    await page.waitForURL(/\/auth\/one-time-password/, { timeout: 10_000 });
    await expect(page.getByTestId(testIds.auth.otpScreen)).toBeVisible();
    await expect(page.getByText(authCredentials.email)).toBeVisible();
  });

  test('signs out from profile and returns to guest auth state', async ({ signedInPage: page }) => {
    page.on('dialog', (dialog) => dialog.accept());

    await page.goto(`${BASE_URL}/profile`);
    const signOutPromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/auth/sign-out') && response.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await page.getByTestId(testIds.profile.signOutBtn).click();
    expect((await signOutPromise).ok()).toBeTruthy();

    await expect(page.getByText(/Dashboard|Packs/i).first()).toBeVisible({ timeout: 15_000 });

    const session = await page.evaluate(async (apiUrl) => {
      const response = await fetch(`${apiUrl}/api/auth/get-session`, {
        credentials: 'include',
      });
      return response.ok ? response.json() : null;
    }, API_URL);
    expect(session?.user).toBeFalsy();
  });
});
