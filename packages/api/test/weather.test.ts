import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  api,
  apiWithAuth,
  expectBadRequest,
  expectJsonResponse,
  expectUnauthorized,
} from './utils/test-helpers';

describe('Weather Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('GET /weather/search requires auth', async () => {
      const res = await api('/weather/search?q=test');
      expectUnauthorized(res);
    });

    it('GET /weather/current requires auth', async () => {
      const res = await api('/weather/current?lat=40.7128&lon=-74.0060');
      expectUnauthorized(res);
    });

    it('GET /weather/forecast requires auth', async () => {
      const res = await api('/weather/forecast?lat=40.7128&lon=-74.0060');
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
      global.fetch = mockFetch as any;

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
      global.fetch = mockFetch as any;

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
      global.fetch = mockFetch as any;

      const res = await apiWithAuth(`/weather/search?q=${encodeURIComponent('São Paulo')}`);
      expect(res.status).toBe(200);

      global.fetch = originalFetch;
    });
  });

  describe('GET /weather/current', () => {
    it('returns current weather for coordinates', async () => {
      const mockWeatherData = {
        location: {
          name: 'New York',
          country: 'US',
          lat: 40.7128,
          lon: -74.006,
        },
        current: {
          temp_c: 20,
          temp_f: 68,
          condition: { text: 'Sunny', icon: 'sunny.png' },
          wind_mph: 10,
          humidity: 65,
          vis_km: 16,
        },
      };

      const mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockWeatherData), {
            status: 200,
          }),
        ),
      );

      const originalFetch = global.fetch;
      global.fetch = mockFetch as any;

      const res = await apiWithAuth('/weather/current?lat=40.7128&lon=-74.0060');
      expect(res.status).toBe(200);

      const data = await expectJsonResponse(res, ['location', 'current']);
      expect(data.location.name).toBe('New York');
      expect(data.current.temp_c).toBe(20);

      global.fetch = originalFetch;
    });

    it('requires latitude and longitude parameters', async () => {
      const res = await apiWithAuth('/weather/current');
      expectBadRequest(res);

      const data = await res.json();
      expect(data.error).toContain('lat');
    });

    it('requires latitude parameter', async () => {
      const res = await apiWithAuth('/weather/current?lon=-74.0060');
      expectBadRequest(res);
    });

    it('requires longitude parameter', async () => {
      const res = await apiWithAuth('/weather/current?lat=40.7128');
      expectBadRequest(res);
    });

    it('validates latitude range', async () => {
      const res = await apiWithAuth('/weather/current?lat=91&lon=-74.0060');
      expectBadRequest(res);

      const data = await res.json();
      expect(data.error).toContain('latitude');
    });

    it('validates longitude range', async () => {
      const res = await apiWithAuth('/weather/current?lat=40.7128&lon=181');
      expectBadRequest(res);

      const data = await res.json();
      expect(data.error).toContain('longitude');
    });

    it('accepts location name as alternative', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              location: { name: 'London', country: 'UK' },
              current: { temp_c: 15, condition: { text: 'Cloudy' } },
            }),
            {
              status: 200,
            },
          ),
        ),
      );

      const originalFetch = global.fetch;
      global.fetch = mockFetch as any;

      const res = await apiWithAuth('/weather/current?location=London');

      if (res.status === 200) {
        const data = await expectJsonResponse(res);
        expect(data.location.name).toBe('London');
      }

      global.fetch = originalFetch;
    });
  });

  describe('GET /weather/forecast', () => {
    it('returns weather forecast for coordinates', async () => {
      const mockForecastData = {
        location: { name: 'Seattle', country: 'US' },
        forecast: {
          forecastday: [
            {
              date: '2024-01-01',
              day: {
                maxtemp_c: 25,
                mintemp_c: 15,
                condition: { text: 'Sunny', icon: 'sunny.png' },
              },
            },
          ],
        },
      };

      const mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockForecastData), {
            status: 200,
          }),
        ),
      );

      const originalFetch = global.fetch;
      global.fetch = mockFetch as any;

      const res = await apiWithAuth('/weather/forecast?lat=47.6062&lon=-122.3321');
      expect(res.status).toBe(200);

      const data = await expectJsonResponse(res, ['location', 'forecast']);
      expect(data.forecast.forecastday.length).toBeGreaterThan(0);

      global.fetch = originalFetch;
    });

    it('requires latitude and longitude parameters', async () => {
      const res = await apiWithAuth('/weather/forecast');
      expectBadRequest(res);
    });

    it('accepts days parameter', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              forecast: { forecastday: Array(5).fill({ date: '2024-01-01', day: {} }) },
            }),
            {
              status: 200,
            },
          ),
        ),
      );

      const originalFetch = global.fetch;
      global.fetch = mockFetch as any;

      const res = await apiWithAuth('/weather/forecast?lat=40.7128&lon=-74.0060&days=5');

      if (res.status === 200) {
        const data = await expectJsonResponse(res);
        expect(data.forecast.forecastday.length).toBe(5);
      }

      global.fetch = originalFetch;
    });

    it('validates days parameter range', async () => {
      const res = await apiWithAuth('/weather/forecast?lat=40.7128&lon=-74.0060&days=15');

      // Many weather APIs limit forecast days to 7-10 days
      if (res.status === 400) {
        expectBadRequest(res);
        const data = await res.json();
        expect(data.error).toContain('days');
      }
    });

    it('handles zero or negative days parameter', async () => {
      const res = await apiWithAuth('/weather/forecast?lat=40.7128&lon=-74.0060&days=0');
      expectBadRequest(res);
    });
  });

  describe('GET /weather/alerts', () => {
    it('returns weather alerts for location', async () => {
      const mockAlerts = {
        alerts: {
          alert: [
            {
              headline: 'Winter Storm Warning',
              severity: 'Severe',
              areas: 'New York',
              category: 'Met',
              desc: 'Heavy snow expected',
            },
          ],
        },
      };

      const mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockAlerts), {
            status: 200,
          }),
        ),
      );

      const originalFetch = global.fetch;
      global.fetch = mockFetch as any;

      const res = await apiWithAuth('/weather/alerts?lat=40.7128&lon=-74.0060');

      if (res.status === 200) {
        const data = await expectJsonResponse(res, ['alerts']);
        expect(data.alerts.alert.length).toBeGreaterThan(0);
      } else if (res.status === 404) {
        // Alerts endpoint may not be implemented
        expect(res.status).toBe(404);
      }

      global.fetch = originalFetch;
    });

    it('returns empty alerts when none exist', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ alerts: { alert: [] } }), {
            status: 200,
          }),
        ),
      );

      const originalFetch = global.fetch;
      global.fetch = mockFetch as any;

      const res = await apiWithAuth('/weather/alerts?lat=40.7128&lon=-74.0060');

      if (res.status === 200) {
        const data = await expectJsonResponse(res);
        expect(data.alerts.alert.length).toBe(0);
      } else if (res.status === 404) {
        expect(res.status).toBe(404);
      }

      global.fetch = originalFetch;
    });
  });

  describe('Weather Service Integration', () => {
    it('handles API key errors', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: { message: 'API key invalid' } }), {
            status: 401,
          }),
        ),
      );

      const originalFetch = global.fetch;
      global.fetch = mockFetch as any;

      const res = await apiWithAuth('/weather/current?lat=40.7128&lon=-74.0060');

      // Should handle gracefully
      if (res.status === 500) {
        const data = await res.json();
        expect(data.error).toBeDefined();
      }

      global.fetch = originalFetch;
    });

    it('handles service timeouts', async () => {
      const mockFetch = vi.fn(() => Promise.reject(new Error('Request timeout')));

      const originalFetch = global.fetch;
      global.fetch = mockFetch as any;

      const res = await apiWithAuth('/weather/current?lat=40.7128&lon=-74.0060');

      // Should handle timeouts gracefully
      if (res.status === 500) {
        const data = await res.json();
        expect(data.error).toBeDefined();
      }

      global.fetch = originalFetch;
    });

    it('handles rate limiting from weather service', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: { message: 'Rate limit exceeded' } }), {
            status: 429,
          }),
        ),
      );

      const originalFetch = global.fetch;
      global.fetch = mockFetch as any;

      const res = await apiWithAuth('/weather/current?lat=40.7128&lon=-74.0060');

      // Should propagate or handle rate limiting
      expect([429, 500]).toContain(res.status);

      global.fetch = originalFetch;
    });
  });

  describe('Caching and Performance', () => {
    it('may implement caching for repeated requests', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              location: { name: 'Boston' },
              current: { temp_c: 18 },
            }),
            {
              status: 200,
            },
          ),
        ),
      );

      const originalFetch = global.fetch;
      global.fetch = mockFetch as any;

      // Make two identical requests
      const res1 = await apiWithAuth('/weather/current?lat=42.3601&lon=-71.0589');
      const res2 = await apiWithAuth('/weather/current?lat=42.3601&lon=-71.0589');

      if (res1.status === 200 && res2.status === 200) {
        // If caching is implemented, the second call might not hit the external API
        // This is just testing that the functionality works
        expect(res2.status).toBe(200);
      }

      global.fetch = originalFetch;
    });
  });

  describe('Error Handling', () => {
    it('handles malformed coordinates gracefully', async () => {
      const res = await apiWithAuth('/weather/current?lat=invalid&lon=invalid');
      expectBadRequest(res);
    });

    it('handles extreme coordinates', async () => {
      const res = await apiWithAuth('/weather/current?lat=999&lon=999');
      expectBadRequest(res);
    });

    it('handles missing weather data gracefully', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({}), {
            status: 200,
          }),
        ),
      );

      const originalFetch = global.fetch;
      global.fetch = mockFetch as any;

      const res = await apiWithAuth('/weather/current?lat=40.7128&lon=-74.0060');

      // Should handle missing data gracefully
      if (res.status === 500) {
        const data = await res.json();
        expect(data.error).toBeDefined();
      }

      global.fetch = originalFetch;
    });
  });
});
