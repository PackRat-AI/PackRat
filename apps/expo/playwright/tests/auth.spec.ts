import { testIds } from '../../lib/testIds';
import { API_URL, BASE_URL, expect, test } from './fixtures';

async function getPasswordResetCode(email: string): Promise<string> {
  const response = await fetch(
    `${API_URL}/api/password-reset/e2e-code?email=${encodeURIComponent(email)}`,
  );
  if (!response.ok) {
    throw new Error(`Failed to load reset code for ${email}`);
  }

  const payload = (await response.json()) as { code?: string | null };
  if (!payload.code) {
    throw new Error(`No password reset code found for ${email}`);
  }

  return payload.code;
}

async function waitForPasswordResetCode(email: string): Promise<string> {
  let code = '';
  await expect
    .poll(
      async () => {
        try {
          code = await getPasswordResetCode(email);
        } catch {
          code = '';
        }
        return code;
      },
      { timeout: 20_000 },
    )
    .toMatch(/^\d{6}$/);

  return code;
}

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

  test('resets a password end to end using the local DB code', async ({ page }) => {
    test.setTimeout(120_000);
    const email = `e2e-reset-${Date.now()}@packrat.test`;
    const initialPassword = 'ResetStart1!';
    const nextPassword = 'ResetDone1!';

    await page.goto(`${BASE_URL}/auth/(create-account)`);
    await page.locator('input').nth(0).fill('Reset');
    await page.locator('input').nth(1).fill('User');
    await page.getByText('Next', { exact: true }).click();

    await expect(page.getByText('Set up your credentials')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId(testIds.auth.createEmailInput).fill(email);
    await page.getByTestId(testIds.auth.createPasswordInput).fill(initialPassword);
    await page.getByTestId(testIds.auth.createConfirmPasswordInput).fill(initialPassword);
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

    const browser = page.context().browser();
    expect(browser).toBeTruthy();
    if (!browser) {
      throw new Error('Browser not available');
    }
    const resetContext = await browser.newContext();
    const resetPage = await resetContext.newPage();

    await resetPage.goto(`${BASE_URL}/auth`);
    await resetPage.getByTestId(testIds.auth.signInEmailBtn).click();
    await resetPage.getByText(/Forgot Password/i).click();
    await resetPage.getByRole('textbox').fill(email);

    const resetRequestPromise = resetPage.waitForResponse(
      (response) =>
        response.url().includes('/api/password-reset/request') &&
        response.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await resetPage.getByText('Send Code', { exact: true }).click();
    expect((await resetRequestPromise).ok()).toBeTruthy();
    await resetPage.waitForURL(/\/auth\/one-time-password/, { timeout: 10_000 });

    const resetCode = await waitForPasswordResetCode(email);

    await resetPage.locator('input[autocomplete="sms-otp"]').first().fill(resetCode);
    await resetPage.getByText('Continue', { exact: true }).click();
    await resetPage.waitForURL(/\/auth\/reset-password/, { timeout: 10_000 });

    const passwordInputs = resetPage.locator('input[type="password"]');
    await passwordInputs.nth(0).fill(nextPassword);
    await passwordInputs.nth(1).fill(nextPassword);
    await passwordInputs.nth(1).click();

    const resetPromise = resetPage.waitForResponse(
      (response) =>
        response.url().includes('/api/password-reset/verify') &&
        response.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await passwordInputs.nth(1).press('Enter');
    expect((await resetPromise).ok()).toBeTruthy();

    await resetPage.goto(`${BASE_URL}/auth`);
    await resetPage.getByTestId(testIds.auth.signInEmailBtn).click();
    await resetPage.locator('input[type="email"]').fill(email);
    await resetPage.locator('input[type="password"]').fill(nextPassword);
    const signInResponse = resetPage.waitForResponse(
      (response) =>
        response.url().includes('/api/auth/sign-in/email') &&
        response.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await resetPage.getByTestId(testIds.auth.continueBtn).click();
    expect((await signInResponse).ok()).toBeTruthy();
    await expect(resetPage.getByText(/Dashboard|Packs/i).first()).toBeVisible({ timeout: 15_000 });

    await resetContext.close();
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
