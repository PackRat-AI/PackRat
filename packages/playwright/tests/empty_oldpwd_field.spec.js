import { test, expect } from '@playwright/test';
test.setTimeout(60000);

test('change password with empty oldpassword field shows error message', async ({ page }) => {
  await page.goto('https://packrat.world/');
  await page.getByRole('link', { name: 'Get Started' }).click();
  await page.getByLabel('Email').click();
  await page.getByLabel('Email').fill('zoot3@email.com');
  await page.getByLabel('Password').click();
  await page.getByLabel('Password').fill('12345678');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByRole('button', { name: 'Menu' }).hover();
  await page.getByRole('button', { name: ' Profile' }).click();
  await page.goto('https://packrat.world/profile');
  await page.getByRole('button', { name: '󰢻' }).click();
  await page.getByLabel('Old password').click();
  await page.getByLabel('Old password').fill('');
  await page.getByLabel('New password', { exact: true }).click();
  await page.getByLabel('New password', { exact: true }).fill('87654321');
  await page.getByLabel('Confirm new password').click();
  await page.getByLabel('Confirm new password').fill('87654321');
  await page.getByRole('button', { name: 'Change password' }).click();

   // Verify the error message for invalid email format
   const passwordErrorMessage = page.locator('text=Password is required');
   await expect(passwordErrorMessage).toBeVisible({ timeout: 50000 }); // Adjust the timeout as needed
 });