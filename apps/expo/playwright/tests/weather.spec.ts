import { testIds } from '../../lib/testIds';
import { BASE_URL, expect, fillInputByTestId, test } from './fixtures';

test.describe('Weather web flow', () => {
  test('searches for a location and saves it locally', async ({ signedInPage: page }) => {
    await page.goto(`${BASE_URL}/weather/search`);

    await fillInputByTestId({ page, testID: testIds.weather.searchInput, value: 'Boulder' });
    await expect(page.getByText('Boulder').first()).toBeVisible({ timeout: 15_000 });

    page.on('dialog', (dialog) => dialog.accept());
    await page.locator('[data-testid^="weather:search-result-add-"]').first().click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const locations = window.localStorage.getItem('locations');
          return locations
            ? JSON.parse(locations).some(({ name }: { name: string }) => name === 'Boulder')
            : false;
        }),
      )
      .toBe(true);

    await page.goto(`${BASE_URL}/weather`);
    await expect(page.getByText('Boulder').first()).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(/Sunny|Cloud|Rain|Snow|Clear|Overcast|Mist/i).first(),
    ).toBeVisible();
  });

  test('filters saved locations without touching the network', async ({ signedInPage: page }) => {
    await page.goto(`${BASE_URL}/weather`);
    await page.evaluate(() => {
      window.localStorage.setItem(
        'locations',
        JSON.stringify([
          {
            id: 615702,
            name: 'Boulder',
            temperature: 72,
            condition: 'Sunny',
            time: '9:00 AM',
            highTemp: 79,
            lowTemp: 48,
            lat: 40.02,
            lon: -105.27,
          },
          {
            id: 5368361,
            name: 'Los Angeles',
            temperature: 68,
            condition: 'Cloudy',
            time: '8:00 AM',
            highTemp: 70,
            lowTemp: 58,
            lat: 34.05,
            lon: -118.24,
          },
        ]),
      );
    });

    await page.reload();
    await fillInputByTestId({ page, testID: testIds.weather.savedSearchInput, value: 'boul' });

    await expect(page.getByTestId(testIds.weather.location(615702))).toBeVisible();
    await expect(page.getByTestId(testIds.weather.location(5368361))).not.toBeVisible();
  });
});
