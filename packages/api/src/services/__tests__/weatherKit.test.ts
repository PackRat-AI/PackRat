import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import type { WeatherAPIForecastResponse } from '@packrat/schemas/weather';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildStubForecast } from '../weatherService';

const mocks = vi.hoisted(() => ({ captureApiException: vi.fn() }));
vi.mock('@packrat/api/utils/sentry', () => ({ captureApiException: mocks.captureApiException }));

/** The module caches its token, so each test gets a fresh copy. */
async function loadWeatherKit() {
  vi.resetModules();
  return import('../weatherKit');
}

// A real PKCS#8 P-256 key, generated for tests only — importKey rejects a
// placeholder, so the signing path needs a genuine one.
const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgbpFq/ywiXalhQFf7
KUajl6M6vqPDhxHrUC34TJ/HuKGhRANCAATp0Gwxg6GXUetoJJ71850cpuUU+T4Z
1JdBd4lMqa8/XaLWwyunUyQZdMkNa9nTnNbjeYAP4CNux7qBCijlG0ly
-----END PRIVATE KEY-----`;

const env = {
  WEATHERKIT_KEY_ID: 'WKKEY12345',
  WEATHERKIT_TEAM_ID: 'TEAM456',
  WEATHERKIT_SERVICE_ID: 'com.packrat.weatherkit',
  WEATHERKIT_PRIVATE_KEY: TEST_PRIVATE_KEY,
} as ValidatedEnv;

const unconfiguredEnv = {} as ValidatedEnv;

/** WeatherKit day `offset` days after 2026-07-16, local midnight in Denver (UTC-6). */
function weatherKitDay(offset: number, overrides: Record<string, unknown> = {}) {
  const start = new Date(Date.UTC(2026, 6, 16 + offset, 6));
  return {
    forecastStart: start.toISOString(),
    conditionCode: 'Snow',
    maxUvIndex: 4,
    precipitationAmount: 12.7,
    precipitationChance: 0.6,
    precipitationType: 'snow',
    snowfallAmount: 80,
    temperatureMax: 10,
    temperatureMin: -5,
    sunrise: new Date(Date.UTC(2026, 6, 16 + offset, 11, 45)).toISOString(),
    sunset: new Date(Date.UTC(2026, 6, 17 + offset, 2, 27)).toISOString(),
    daytimeForecast: { humidity: 0.42, windSpeed: 16.09344 },
    ...overrides,
  };
}

/** The Denver stub trimmed to the first `days` days, as WeatherAPI's plan returns. */
function shortForecast(days: number): WeatherAPIForecastResponse {
  const forecast = buildStubForecast();
  return {
    ...forecast,
    forecast: { forecastday: forecast.forecast.forecastday.slice(0, days) },
  };
}

function weatherKitResponse(days: unknown[]) {
  return new Response(JSON.stringify({ forecastDaily: { days } }), { status: 200 });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  mocks.captureApiException.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('toForecastDay', () => {
  it('maps a WeatherKit day into the WeatherAPI day shape in the location timezone', async () => {
    const { toForecastDay } = await loadWeatherKit();
    const day = toForecastDay({ day: weatherKitDay(3), timezone: 'America/Denver' });

    expect(day.date).toBe('2026-07-19');
    expect(day.hour).toEqual([]);
    expect(day.day).toMatchObject({
      maxtemp_c: 10,
      maxtemp_f: 50,
      mintemp_c: -5,
      mintemp_f: 23,
      avgtemp_c: 2.5,
      maxwind_kph: 16.1,
      maxwind_mph: 10,
      totalprecip_mm: 12.7,
      totalprecip_in: 0.5,
      totalsnow_cm: 8,
      avghumidity: 42,
      uv: 4,
      condition: { text: 'Snow', icon: '', code: 1219 },
      daily_chance_of_rain: 0,
      daily_chance_of_snow: 60,
    });
    expect(day.astro?.sunrise).toBe('05:45 AM');
    expect(day.astro?.sunset).toBe('08:27 PM');
  });

  it('counts rain chance only for rain, and both for mixed precipitation', async () => {
    const { toForecastDay } = await loadWeatherKit();
    const rain = toForecastDay({
      day: weatherKitDay(0, { precipitationType: 'rain', conditionCode: 'Rain' }),
      timezone: 'UTC',
    });
    const mixed = toForecastDay({
      day: weatherKitDay(0, { precipitationType: 'mixed', conditionCode: 'WintryMix' }),
      timezone: 'UTC',
    });

    expect([rain.day.daily_chance_of_rain, rain.day.daily_chance_of_snow]).toEqual([60, 0]);
    expect([mixed.day.daily_chance_of_rain, mixed.day.daily_chance_of_snow]).toEqual([60, 60]);
    expect(mixed.day.condition).toEqual({ text: 'Wintry mix', icon: '', code: 1069 });
  });

  it('falls back to partly cloudy for a condition code it does not know', async () => {
    const { toForecastDay } = await loadWeatherKit();
    const day = toForecastDay({
      day: weatherKitDay(0, { conditionCode: 'SomethingNew' }),
      timezone: 'UTC',
    });

    expect(day.day.condition).toEqual({ text: 'Partly cloudy', icon: '', code: 1003 });
  });
});

describe('extendForecastWithWeatherKit', () => {
  it('appends WeatherKit days after the last WeatherAPI day, up to 10, with attribution', async () => {
    const { extendForecastWithWeatherKit, APPLE_WEATHER_ATTRIBUTION } = await loadWeatherKit();
    fetchMock.mockResolvedValue(
      weatherKitResponse(Array.from({ length: 11 }, (_, i) => weatherKitDay(i))),
    );

    const result = await extendForecastWithWeatherKit({ env, forecast: shortForecast(3) });

    expect(result.forecast.forecastday.map((d) => d.date)).toEqual([
      '2026-07-16',
      '2026-07-17',
      '2026-07-18',
      '2026-07-19',
      '2026-07-20',
      '2026-07-21',
      '2026-07-22',
      '2026-07-23',
      '2026-07-24',
      '2026-07-25',
    ]);
    // WeatherAPI's own days are kept as-is, hourly data included.
    expect(result.forecast.forecastday[0]?.day.maxtemp_f).toBe(78);
    expect(result.forecast.forecastday[3]?.day.condition.text).toBe('Snow');
    expect(result.attribution).toEqual(APPLE_WEATHER_ATTRIBUTION);
  });

  it('requests the daily dataset at the location with a signed developer token', async () => {
    const { extendForecastWithWeatherKit } = await loadWeatherKit();
    fetchMock.mockResolvedValue(weatherKitResponse([weatherKitDay(5)]));

    await extendForecastWithWeatherKit({ env, forecast: shortForecast(3) });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://weatherkit.apple.com/api/v1/weather/en/39.7400/-104.9800?dataSets=forecastDaily&timezone=America%2FDenver',
    );
    const token = ((init.headers as Record<string, string>).authorization ?? '').replace(
      'Bearer ',
      '',
    );
    const [header, payload, signature] = token.split('.');
    expect(JSON.parse(atob(header ?? ''))).toEqual({
      alg: 'ES256',
      kid: 'WKKEY12345',
      id: 'TEAM456.com.packrat.weatherkit',
    });
    const claims = JSON.parse(atob(payload ?? ''));
    expect(claims).toMatchObject({ iss: 'TEAM456', sub: 'com.packrat.weatherkit' });
    expect(claims.exp - claims.iat).toBe(3600);
    expect(signature?.length).toBe(86); // 64-byte raw r||s, base64url
  });

  it('reuses the minted token across requests', async () => {
    const { extendForecastWithWeatherKit } = await loadWeatherKit();
    fetchMock.mockImplementation(async () => weatherKitResponse([weatherKitDay(5)]));

    await extendForecastWithWeatherKit({ env, forecast: shortForecast(3) });
    await extendForecastWithWeatherKit({ env, forecast: shortForecast(3) });

    const auth = fetchMock.mock.calls.map(
      ([, init]) => ((init as RequestInit).headers as Record<string, string>).authorization,
    );
    expect(auth[0]).toBe(auth[1]);
  });

  it('returns the forecast untouched when WeatherKit is not configured', async () => {
    const { extendForecastWithWeatherKit } = await loadWeatherKit();
    const forecast = shortForecast(3);

    const result = await extendForecastWithWeatherKit({ env: unconfiguredEnv, forecast });

    expect(result).toBe(forecast);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('skips WeatherKit when the forecast already covers 10 days', async () => {
    const { extendForecastWithWeatherKit } = await loadWeatherKit();
    const forecast = shortForecast(10);

    const result = await extendForecastWithWeatherKit({ env, forecast });

    expect(result).toBe(forecast);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('adds no attribution when WeatherKit has no day past WeatherAPI', async () => {
    const { extendForecastWithWeatherKit } = await loadWeatherKit();
    fetchMock.mockResolvedValue(weatherKitResponse([weatherKitDay(0), weatherKitDay(1)]));
    const forecast = shortForecast(3);

    const result = await extendForecastWithWeatherKit({ env, forecast });

    expect(result).toBe(forecast);
    expect(result.attribution).toBeUndefined();
  });

  it('keeps the WeatherAPI forecast and reports when WeatherKit fails', async () => {
    const { extendForecastWithWeatherKit } = await loadWeatherKit();
    fetchMock.mockResolvedValue(new Response('denied', { status: 401 }));
    const forecast = shortForecast(3);

    const result = await extendForecastWithWeatherKit({ env, forecast, userId: 'user-1' });

    expect(result).toBe(forecast);
    expect(mocks.captureApiException).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'weather.weatherKitDaily',
        userId: 'user-1',
        error: expect.objectContaining({ message: 'WeatherKit HTTP 401' }),
      }),
    );
  });
});
