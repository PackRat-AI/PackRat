import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://packrat.pages.dev/');
  await page.getByRole('link', { name: 'Get Started' }).click();
  await page.locator('input[type="email"]').click();
  await page.locator('input[type="email"]').fill('zoot3@email.com');
  await page.locator('input[type="password"]').click();
  await page.locator('input[type="password"]').fill('12345678');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByPlaceholder('Search by park, city, or trail').click();
  await page.getByPlaceholder('Search by park, city, or trail').fill('Manila ');
  await page.getByText('city', { exact: true }).click();
  await page.getByText('').click();
  await page.getByText('').click();
});
