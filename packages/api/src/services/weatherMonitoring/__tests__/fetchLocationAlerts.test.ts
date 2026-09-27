import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getEnv: vi.fn(() => ({ WEATHER_API_KEY: 'test-key' })),
}));

vi.mock('@packrat/api/utils/env-validation', () => ({ getEnv: mocks.getEnv }));

import { fetchLocationAlerts } from '../fetchLocationAlerts';

const alert = {
  headline: 'Flood Warning until 6 PM',
  msgtype: 'Alert',
  severity: 'Severe',
  urgency: 'Expected',
  areas: 'Boulder County',
  category: 'Met',
  certainty: 'Likely',
  event: 'Flood Warning',
  effective: '2026-01-01T00:00:00Z',
  expires: '2026-01-01T18:00:00Z',
  desc: 'Rising water expected.',
};

/** The minimum WeatherAPI forecast shape the response schema will accept. */
function forecastResponse(alerts: unknown[] | undefined) {
  return {
    location: {
      name: 'Boulder',
      region: 'Colorado',
      country: 'USA',
      lat: 40.01,
      lon: -105.27,
      tz_id: 'America/Denver',
      localtime_epoch: 1767225600,
      localtime: '2026-01-01 00:00',
    },
    current: {
      last_updated_epoch: 1767225600,
      last_updated: '2026-01-01 00:00',
      temp_c: 2,
      temp_f: 35.6,
      is_day: 0,
      condition: { text: 'Clear', icon: '//icon.png', code: 1000 },
      wind_mph: 3,
      wind_kph: 4.8,
      wind_degree: 180,
      wind_dir: 'S',
      pressure_mb: 1010,
      pressure_in: 29.83,
      precip_mm: 0,
      precip_in: 0,
      humidity: 40,
      cloud: 0,
      feelslike_c: 1,
      feelslike_f: 33.8,
      vis_km: 16,
      vis_miles: 9,
      uv: 0,
      gust_mph: 5,
      gust_kph: 8,
    },
    forecast: { forecastday: [] },
    ...(alerts === undefined ? {} : { alerts: { alert: alerts } }),
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock = vi.fn().mockResolvedValue(jsonResponse(forecastResponse([alert])));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchLocationAlerts', () => {
  it('returns the location’s active alerts', async () => {
    const result = await fetchLocationAlerts(42);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ event: 'Flood Warning' });
  });

  it('queries WeatherAPI by location id with alerts enabled', async () => {
    await fetchLocationAlerts(42);

    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('/forecast.json');
    expect(url).toContain(`q=${encodeURIComponent('id:42')}`);
    expect(url).toContain('alerts=yes');
  });

  it('requests a single day rather than the full forecast the app screen renders', async () => {
    await fetchLocationAlerts(42);

    expect(fetchMock.mock.calls[0]?.[0] as string).toContain('days=1');
  });

  it('authenticates with the configured API key', async () => {
    await fetchLocationAlerts(42);

    expect(fetchMock.mock.calls[0]?.[0] as string).toContain('key=test-key');
  });

  it('returns an empty list when the location has no alerts array', async () => {
    fetchMock.mockResolvedValue(jsonResponse(forecastResponse(undefined)));

    expect(await fetchLocationAlerts(42)).toEqual([]);
  });

  it('returns an empty list when the alerts array is present but empty', async () => {
    fetchMock.mockResolvedValue(jsonResponse(forecastResponse([])));

    expect(await fetchLocationAlerts(42)).toEqual([]);
  });

  it('throws naming the status and location when WeatherAPI rejects the request', async () => {
    fetchMock.mockResolvedValue(new Response('Forbidden', { status: 403 }));

    await expect(fetchLocationAlerts(42)).rejects.toThrow('WeatherAPI HTTP 403 for location 42');
  });
});
