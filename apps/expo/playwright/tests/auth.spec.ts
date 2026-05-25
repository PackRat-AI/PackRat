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
});
