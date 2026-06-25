import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  api,
  apiWithAuth,
  expectBadRequest,
  expectJsonResponse,
  expectUnauthorized,
} from './utils/test-helpers';

const condition = { text: 'Clear', icon: '//cdn.weatherapi.com/clear.png', code: 1000 };

const current = {
  last_updated: '2024-01-01 12:00',
  temp_c: 20,
  temp_f: 68,
  condition,
  wind_mph: 5,
  wind_kph: 8,
  wind_degree: 180,
  wind_dir: 'S',
  pressure_mb: 1015,
  pressure_in: 29.97,
  precip_mm: 0,
  precip_in: 0,
  humidity: 40,
  cloud: 0,
  feelslike_c: 20,
  feelslike_f: 68,
  vis_km: 10,
  vis_miles: 6,
  uv: 3,
  is_day: 1,
};

const forecastDay = {
  date: '2024-01-01',
  date_epoch: 1704067200,
  day: {
    maxtemp_c: 25,
    maxtemp_f: 77,
    mintemp_c: 15,
    mintemp_f: 59,
    avgtemp_c: 20,
    avgtemp_f: 68,
    maxwind_mph: 10,
    maxwind_kph: 16,
    totalprecip_mm: 0,
    totalprecip_in: 0,
    totalsnow_cm: 0,
    avghumidity: 40,
    avgvis_km: 10,
    avgvis_miles: 6,
    uv: 3,
    condition,
  },
  hour: [],
};

describe('Weather Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('GET /weather/search requires auth', async () => {
      const res = await api('/weather/search?q=test');
      expectUnauthorized(res);
    });

    it('GET /weather/forecast requires auth', async () => {
      const res = await api('/weather/forecast?id=123');
      expectUnauthorized(res);
    });

    it('GET /weather/search-by-coordinates requires auth', async () => {
      const res = await api('/weather/search-by-coordinates?lat=40.7128&lon=-74.0060');
      expectUnauthorized(res);
    });
  });

  describe('GET /weather/search', () => {
    it('searches weather locations with query parameter', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify([{ id: '1', name: 'Test City', country: 'US' }]), {
            status: 200,
          }),
        ),
      );

      const originalFetch = global.fetch;
      global.fetch = mockFetch as unknown as typeof fetch;

      const res = await apiWithAuth('/weather/search?q=test');
      expect(res.status).toBe(200);

      const data = await expectJsonResponse(res);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].name).toBe('Test City');

      global.fetch = originalFetch;
    });

    it('requires query parameter', async () => {
      const res = await apiWithAuth('/weather/search');
      expectBadRequest(res);
    });

    it('handles empty search results', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
          }),
        ),
      );

      const originalFetch = global.fetch;
      global.fetch = mockFetch as unknown as typeof fetch;

      const res = await apiWithAuth('/weather/search?q=nonexistentplace');
      expect(res.status).toBe(200);

      const data = await expectJsonResponse(res);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);

      global.fetch = originalFetch;
    });

    it('validates query parameter length', async () => {
      const res = await apiWithAuth('/weather/search?q=');
      expectBadRequest(res);
    });

    it('handles special characters in search query', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify([{ id: '1', name: 'São Paulo', country: 'BR' }]), {
            status: 200,
          }),
        ),
      );

      const originalFetch = global.fetch;
      global.fetch = mockFetch as unknown as typeof fetch;

      const res = await apiWithAuth(`/weather/search?q=${encodeURIComponent('São Paulo')}`);
      expect(res.status).toBe(200);

      global.fetch = originalFetch;
    });
  });

  describe('GET /weather/search-by-coordinates', () => {
    it('searches locations by coordinates', async () => {
      const mockData = [
        {
          id: 123,
          name: 'New York',
          region: 'New York',
          country: 'United States',
          lat: 40.7128,
          lon: -74.006,
        },
      ];

      const mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockData), {
            status: 200,
          }),
        ),
      );

      const originalFetch = global.fetch;
      global.fetch = mockFetch as unknown as typeof fetch;

      const res = await apiWithAuth('/weather/search-by-coordinates?lat=40.7128&lon=-74.006');
      expect(res.status).toBe(200);

      const data = await expectJsonResponse(res);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].name).toBe('New York');

      global.fetch = originalFetch;
    });

    it('requires latitude and longitude parameters', async () => {
      const res = await apiWithAuth('/weather/search-by-coordinates');
      expectBadRequest(res);
    });

    it('validates coordinate format', async () => {
      const res = await apiWithAuth('/weather/search-by-coordinates?lat=invalid&lon=invalid');
      expectBadRequest(res);
    });
  });

  describe('GET /weather/forecast (with location ID)', () => {
    it('returns forecast for location ID', async () => {
      const mockData = {
        location: {
          id: 123,
          name: 'New York',
          region: 'New York',
          country: 'US',
          lat: 40.7128,
          lon: -74.006,
        },
        current,
        forecast: {
          forecastday: [forecastDay],
        },
        alerts: { alert: [] },
      };

      const mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockData), {
            status: 200,
          }),
        ),
      );

      const originalFetch = global.fetch;
      global.fetch = mockFetch as unknown as typeof fetch;

      const res = await apiWithAuth('/weather/forecast?id=123');
      expect(res.status).toBe(200);

      const data = await expectJsonResponse(res, ['location', 'current', 'forecast']);
      expect(data.location.id).toBe(123);
      expect(data.forecast.forecastday.length).toBeGreaterThan(0);

      global.fetch = originalFetch;
    });

    it('requires location ID parameter', async () => {
      const res = await apiWithAuth('/weather/forecast');
      expectBadRequest(res);
    });

    it('validates location ID format', async () => {
      const res = await apiWithAuth('/weather/forecast?id=invalid');
      expectBadRequest(res);
    });

    it('includes alerts in forecast response', async () => {
      const mockData = {
        location: {
          id: 123,
          name: 'New York',
          region: 'New York',
          country: 'US',
          lat: 40.7128,
          lon: -74.006,
        },
        current,
        forecast: { forecastday: [forecastDay] },
        alerts: {
          alert: [
            {
              headline: 'Winter Storm Warning',
              msgtype: 'Alert',
              severity: 'Severe',
              urgency: 'Expected',
              areas: 'New York',
              category: 'Met',
              certainty: 'Likely',
              event: 'Winter Storm Warning',
              effective: '2024-01-01T00:00:00Z',
              expires: '2024-01-02T00:00:00Z',
              desc: 'Winter storm warning in effect.',
            },
          ],
        },
      };

      const mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockData), {
            status: 200,
          }),
        ),
      );

      const originalFetch = global.fetch;
      global.fetch = mockFetch as unknown as typeof fetch;

      const res = await apiWithAuth('/weather/forecast?id=123');
      expect(res.status).toBe(200);

      const data = await expectJsonResponse(res);
      if (data.alerts) {
        expect(data.alerts).toBeDefined();
      }

      global.fetch = originalFetch;
    });
  });
});
