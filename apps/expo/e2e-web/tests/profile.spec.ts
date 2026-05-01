/**
 * Web E2E tests for PackRat profile functionality.
 *
 * Tests use the `authedPage` fixture which pre-seeds auth tokens in
 * localStorage before any page JS runs.
 *
 * TestIds match the constants in lib/testIds.ts.
 */
import { testIds } from '../../lib/testIds';
import { BASE_URL, expect, test } from './fixtures';

// ─── Profile name edit ────────────────────────────────────────────────────────

test.describe('Profile name edit', () => {
  test('both name inputs are visible on /profile/name', async ({ authedPage: page }) => {
    await page.goto(`${BASE_URL}/profile/name`);

    await expect(page.getByTestId(testIds.profile.firstNameInput)).toBeVisible();
    await expect(page.getByTestId(testIds.profile.lastNameInput)).toBeVisible();
  });

  test('save button is disabled when name is unchanged', async ({ authedPage: page }) => {
    await page.goto(`${BASE_URL}/profile/name`);

    const saveBtn = page.getByTestId(testIds.profile.saveBtn);
    await saveBtn.waitFor({ state: 'visible' });

    // Without any edits the save button must be disabled
    await expect(saveBtn).toBeDisabled();
  });

  test('save button enables after editing first name', async ({ authedPage: page }) => {
    await page.goto(`${BASE_URL}/profile/name`);

    const firstNameInput = page.getByTestId(testIds.profile.firstNameInput);
    const saveBtn = page.getByTestId(testIds.profile.saveBtn);

    await firstNameInput.waitFor({ state: 'visible' });
    await expect(saveBtn).toBeDisabled();

    // Clear and type a new value — differs from initial, so canSave flips true
    await firstNameInput.fill('UpdatedFirst');

    await expect(saveBtn).toBeEnabled();
  });

  test('editing name and saving navigates back to /profile with updated name', async ({
    authedPage: page,
  }) => {
    const newFirst = `E2E-${Date.now()}`;

    // Intercept the PATCH to confirm it fires and succeeds
    const [patchResponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/users/profile') && r.request().method() === 'PATCH',
      ),
      (async () => {
        await page.goto(`${BASE_URL}/profile/name`);

        const firstNameInput = page.getByTestId(testIds.profile.firstNameInput);
        const lastNameInput = page.getByTestId(testIds.profile.lastNameInput);
        const saveBtn = page.getByTestId(testIds.profile.saveBtn);

        await firstNameInput.waitFor({ state: 'visible' });

        // Keep last name; only update first name
        const currentLast = await lastNameInput.inputValue();
        if (!currentLast) {
          // Ensure last name is non-empty so canSave can be true
          await lastNameInput.fill('TestLast');
        }

        await firstNameInput.fill(newFirst);
        await expect(saveBtn).toBeEnabled();
        await saveBtn.click();
      })(),
    ]);

    expect(patchResponse.ok()).toBeTruthy();

    // After router.back() the app returns to /profile — updated name should appear
    await page.waitForURL((url) => url.pathname === '/profile', { timeout: 10_000 });
    await expect(page.getByText(newFirst)).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Sign-out flow ─────────────────────────────────────────────────────────────
//
// NOTE: Sign-out clears all localStorage tokens and reloads the page, which
// invalidates the authenticated session. This describe block must run last and
// uses its own browser context (via authedPage) so it does not affect other tests.

test.describe('Sign-out', () => {
  test('clicking sign-out redirects to the sign-in screen', async ({ authedPage: page }) => {
    await page.goto(`${BASE_URL}/profile`);

    // Wait for the profile screen to fully render
    await expect(page.getByText('Account Information')).toBeVisible();

    const signOutBtn = page.getByTestId(testIds.profile.signOutBtn);
    await expect(signOutBtn).toBeVisible();

    // After signOut(), the profile screen calls Updates.reloadAsync() which on
    // web triggers a full page reload. Without tokens the auth gate redirects to
    // the sign-in screen. We wait for either a URL change or the sign-in button.
    await Promise.all([
      page
        .waitForURL(
          (url) =>
            url.pathname.includes('sign-in') ||
            url.pathname.includes('login') ||
            url.pathname === '/',
          { timeout: 15_000 },
        )
        .catch(() => null), // fallback: URL may not change if alert is shown first
      signOutBtn.click(),
    ]);

    // Regardless of redirect strategy, the sign-in entry point must be visible
    await expect(
      page
        .getByTestId(testIds.auth.signInEmailBtn)
        .or(page.getByTestId(testIds.auth.emailInput))
        .or(page.getByText(/sign in/i).first()),
    ).toBeVisible({ timeout: 15_000 });
  });
});
