import { getAuth } from '@packrat/api/auth';
import { weatherRoutes } from '@packrat/api/routes/weather';
import { getEnv } from '@packrat/api/utils/env-validation';
import { captureApiException } from '@packrat/api/utils/sentry';
import { Elysia } from 'elysia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@packrat/api/auth', () => ({
  getAuth: vi.fn(),
}));

vi.mock('@packrat/api/auth/local-e2e', () => ({
  getLocalE2EUserFromRequest: vi.fn(async () => null),
}));

vi.mock('@packrat/api/auth/mcp-token', () => ({
  resolveMcpBearerUser: vi.fn(async () => null),
}));

vi.mock('@packrat/api/utils/env-validation', () => ({
  getEnv: vi.fn(),
}));

vi.mock('@packrat/api/utils/queryMetrics', () => ({
  setQueryMetricsUser: vi.fn(),
}));

vi.mock('@packrat/api/utils/sentry', () => ({
  apiAddBreadcrumb: vi.fn(),
  captureApiException: vi.fn(),
  setApiUser: vi.fn(),
}));

const mockGetAuth = vi.mocked(getAuth);
const mockGetEnv = vi.mocked(getEnv);
const mockCaptureApiException = vi.mocked(captureApiException);
const mockFetch = vi.fn();

const app = new Elysia().use(weatherRoutes);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetEnv.mockReturnValue({
    WEATHER_API_KEY: 'weather-e2e-stub-local',
  } as never);
  mockGetAuth.mockResolvedValue({
    api: {
      getSession: vi.fn(async () => ({
        user: {
          id: 'test-user-id',
          email: 'swift-e2e@example.com',
          name: 'Swift E2E',
          role: 'USER',
        },
      })),
    },
  } as never);
  vi.stubGlobal('fetch', mockFetch);
});

describe('weather E2E stub routes', () => {
  it('serves deterministic search and forecast data without calling WeatherAPI', async () => {
    const search = await app.handle(new Request('http://localhost/weather/search?q=Denver'));
    expect(search.status).toBe(200);
    const locations = (await search.json()) as Array<{ id: number; name: string }>;

    expect(locations[0]).toMatchObject({ id: 5419384, name: 'Denver' });

    const forecast = await app.handle(
      new Request(`http://localhost/weather/forecast?id=${locations[0]?.id ?? 0}`),
    );
    expect(forecast.status).toBe(200);
    const body = (await forecast.json()) as {
      location: { id: number; name: string };
      current: { temp_f: number };
      forecast: { forecastday: unknown[] };
    };

    expect(body.location).toMatchObject({ id: 5419384, name: 'Denver' });
    expect(body.current.temp_f).toBe(72);
    expect(body.forecast.forecastday).toHaveLength(10);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockCaptureApiException).not.toHaveBeenCalled();
  });

  it('serves by-name forecast data and not-found responses deterministically', async () => {
    const yosemite = await app.handle(new Request('http://localhost/weather/by-name?q=Yosemite'));
    expect(yosemite.status).toBe(200);
    await expect(yosemite.json()).resolves.toMatchObject({
      location: { name: 'Yosemite Valley', region: 'California' },
      current: { temp_f: 68 },
    });

    const missing = await app.handle(new Request('http://localhost/weather/by-name?q=Atlantis'));
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toMatchObject({
      error: 'No weather location matched "Atlantis"',
    });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockCaptureApiException).not.toHaveBeenCalled();
  });
});
