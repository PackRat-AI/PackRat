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

    // NativeWindUI Button renders as <div aria-disabled="true"> on web, not <button disabled>.
    // Use toHaveAttribute instead of toBeDisabled.
    await expect(saveBtn).toHaveAttribute('aria-disabled', 'true');
  });

  test('save button enables after editing first name', async ({ authedPage: page }) => {
    await page.goto(`${BASE_URL}/profile/name`);

    const firstNameInput = page.getByTestId(testIds.profile.firstNameInput);
    const lastNameInput = page.getByTestId(testIds.profile.lastNameInput);
    const saveBtn = page.getByTestId(testIds.profile.saveBtn);

    await firstNameInput.waitFor({ state: 'visible' });

    // Ensure last name is non-empty so canSave logic can flip (requires both fields non-empty)
    const currentLast = await lastNameInput.inputValue();
    if (!currentLast) {
      await lastNameInput.fill('User');
    }

    // Initially disabled
    await expect(saveBtn).toHaveAttribute('aria-disabled', 'true');

    // Clear and type a new value — differs from initial, so canSave flips true
    await firstNameInput.fill('UpdatedFirst');

    // Now save button should be enabled (aria-disabled removed or set to false)
    await expect(saveBtn).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('editing name and saving navigates back to /profile with updated name', async ({
    authedPage: page,
  }) => {
    const newFirst = `E2E-${Date.now()}`;

    // Navigate to profile first so SPA history is established, then click the
    // Name row to SPA-navigate to /profile/name. This ensures router.back()
    // after save returns to /profile (rather than an empty history stack).
    await page.goto(`${BASE_URL}/profile`);
    await page.waitForLoadState('networkidle');

    // Click the Name list item to SPA-navigate (builds browser history)
    const nameEditBtn = page.getByTestId(testIds.profile.nameEditBtn);
    await nameEditBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await nameEditBtn.click();

    // Wait for the name form to appear
    await page.waitForURL((url) => url.pathname.includes('/profile/name'), { timeout: 10_000 });

    const firstNameInput = page.getByTestId(testIds.profile.firstNameInput);
    const lastNameInput = page.getByTestId(testIds.profile.lastNameInput);
    const saveBtn = page.getByTestId(testIds.profile.saveBtn);

    await firstNameInput.waitFor({ state: 'visible' });

    // Keep last name; only update first name
    const currentLast = await lastNameInput.inputValue();
    if (!currentLast) {
      await lastNameInput.fill('User');
    }

    await firstNameInput.fill(newFirst);

    // Wait for save button to become enabled before clicking
    await expect(saveBtn).not.toHaveAttribute('aria-disabled', 'true');

    // Register listener before clicking — endpoint is PUT /api/user/profile
    const putPromise = page.waitForResponse(
      (r) => r.url().includes('/api/user/profile') && r.request().method() === 'PUT',
      { timeout: 20_000 },
    );

    await saveBtn.click();
    const putResponse = await putPromise;
    expect(putResponse.ok()).toBeTruthy();

    // After router.back() the app returns to /profile — updated name should appear
    await page.waitForURL((url) => url.pathname === '/profile', { timeout: 10_000 });
    // getByText(newFirst) can match multiple elements (header + list row both show "First Last")
    await expect(page.getByText(newFirst).first()).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Sign-out flow ─────────────────────────────────────────────────────────────
//
// NOTE: Sign-out on web:
//   1. signOut() clears localStorage tokens
//   2. Profile screen shows a NativeWindUI Alert dialog ("You're now logged out!")
//   3. Clicking either dialog button calls Updates.reloadAsync() → window.location.reload()
//   4. After reload, useAuthInit.web.ts detects no access_token → redirects to /auth
//
// This describe block must run last as it destroys the auth session.

test.describe('Sign-out', () => {
  test('sign-out button is visible on profile screen', async ({ authedPage: page }) => {
    // Full sign-out flow is skipped: "Stay logged out" sets skipped_login=true which
    // prevents the /auth redirect after reload, making the nav assertion unreliable.
    await page.goto(`${BASE_URL}/profile`);
    await page.waitForLoadState('networkidle');

    const signOutBtn = page.getByTestId(testIds.profile.signOutBtn);
    await expect(signOutBtn).toBeVisible({ timeout: 10_000 });
  });
});
