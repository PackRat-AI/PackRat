import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WeatherService } from '../weatherService';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

// Mock environment validation
vi.mock('@packrat/api/utils/env-validation', () => ({
  getEnv: vi.fn(() => ({
    OPENWEATHER_KEY: 'test-api-key',
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockContext() {
  return {
    get: vi.fn(),
    req: { json: vi.fn() },
    json: vi.fn(),
    env: {
      OPENWEATHER_KEY: 'test-api-key',
    },
  } as unknown as ConstructorParameters<typeof WeatherService>[0];
}

function mockWeatherApiResponse(overrides: Record<string, unknown> = {}) {
  const weather = overrides.weather as { main: string }[] | undefined;
  return {
    main: {
      temp: 72.5,
      humidity: 65,
      ...(overrides.main as Record<string, unknown>),
    },
    weather: weather || [
      {
        main: 'Clear',
      },
    ],
    wind: {
      speed: 8.3,
      ...(overrides.wind as Record<string, unknown>),
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('WeatherService', () => {
  let service: WeatherService;
  let mockContext: ReturnType<typeof makeMockContext>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = makeMockContext();
    service = new WeatherService(mockContext);

    // Mock global fetch
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  // -------------------------------------------------------------------------
  // getWeatherForLocation - successful requests
  // -------------------------------------------------------------------------
  describe('getWeatherForLocation - successful requests', () => {
    it('returns formatted weather data for valid location', async () => {
      const mockResponse = mockWeatherApiResponse();
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.getWeatherForLocation('San Francisco');

      expect(result).toEqual({
        location: 'San Francisco',
        temperature: 73, // Rounded from 72.5
        conditions: 'Clear',
        humidity: 65,
        windSpeed: 8, // Rounded from 8.3
      });
    });

    it('rounds temperature correctly', async () => {
      const mockResponse = mockWeatherApiResponse({ main: { temp: 68.4 } });
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.getWeatherForLocation('Denver');

      expect(result.temperature).toBe(68);
    });

    it('rounds wind speed correctly', async () => {
      const mockResponse = mockWeatherApiResponse({ wind: { speed: 12.8 } });
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.getWeatherForLocation('Chicago');

      expect(result.windSpeed).toBe(13);
    });

    it('calls API with correctly encoded location parameter', async () => {
      const mockResponse = mockWeatherApiResponse();
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await service.getWeatherForLocation('New York City');

      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('q=New%20York%20City'));
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('units=imperial'));
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('appid=test-api-key'));
    });

    it('handles special characters in location names', async () => {
      const mockResponse = mockWeatherApiResponse();
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await service.getWeatherForLocation("Château-d'Œx, Switzerland");

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("Ch%C3%A2teau-d'%C5%92x%2C%20Switzerland"),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getWeatherForLocation - error handling
  // -------------------------------------------------------------------------
  describe('getWeatherForLocation - error handling', () => {
    it('throws error when API request fails', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(service.getWeatherForLocation('InvalidCity')).rejects.toThrow(
        'Weather API request failed',
      );
    });

    it('throws error when API returns 401 (invalid API key)', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(service.getWeatherForLocation('Seattle')).rejects.toThrow(
        'Weather API request failed',
      );
    });

    it('throws error when API returns 500', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(service.getWeatherForLocation('Portland')).rejects.toThrow(
        'Weather API request failed',
      );
    });

    it('throws error when fetch rejects', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      await expect(service.getWeatherForLocation('Boston')).rejects.toThrow('Network error');
    });
  });

  // -------------------------------------------------------------------------
  // getWeatherForLocation - data variations
  // -------------------------------------------------------------------------
  describe('getWeatherForLocation - data variations', () => {
    it('handles Clear weather condition', async () => {
      const mockResponse = mockWeatherApiResponse({ weather: [{ main: 'Clear' }] });
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.getWeatherForLocation('TestCity');
      expect(result.conditions).toBe('Clear');
    });

    it('handles Clouds weather condition', async () => {
      const mockResponse = mockWeatherApiResponse({ weather: [{ main: 'Clouds' }] });
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.getWeatherForLocation('TestCity');
      expect(result.conditions).toBe('Clouds');
    });

    it('handles Rain weather condition', async () => {
      const mockResponse = mockWeatherApiResponse({ weather: [{ main: 'Rain' }] });
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.getWeatherForLocation('TestCity');
      expect(result.conditions).toBe('Rain');
    });

    it('handles Snow weather condition', async () => {
      const mockResponse = mockWeatherApiResponse({ weather: [{ main: 'Snow' }] });
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.getWeatherForLocation('TestCity');
      expect(result.conditions).toBe('Snow');
    });

    it('handles Thunderstorm weather condition', async () => {
      const mockResponse = mockWeatherApiResponse({ weather: [{ main: 'Thunderstorm' }] });
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.getWeatherForLocation('TestCity');
      expect(result.conditions).toBe('Thunderstorm');
    });

    it('handles Drizzle weather condition', async () => {
      const mockResponse = mockWeatherApiResponse({ weather: [{ main: 'Drizzle' }] });
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.getWeatherForLocation('TestCity');
      expect(result.conditions).toBe('Drizzle');
    });

    it('handles extreme temperatures', async () => {
      const temperatures = [-20, 0, 32, 100, 120];

      for (const temp of temperatures) {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => mockWeatherApiResponse({ main: { temp } }),
        });

        const result = await service.getWeatherForLocation('TestCity');
        expect(result.temperature).toBe(Math.round(temp));
      }
    });

    it('handles zero wind speed', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockWeatherApiResponse({ wind: { speed: 0 } }),
      });

      const result = await service.getWeatherForLocation('TestCity');
      expect(result.windSpeed).toBe(0);
    });

    it('handles 100% humidity', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockWeatherApiResponse({ main: { humidity: 100 } }),
      });

      const result = await service.getWeatherForLocation('TestCity');
      expect(result.humidity).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // API URL construction
  // -------------------------------------------------------------------------
  describe('API URL construction', () => {
    it('constructs correct OpenWeatherMap API URL', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockWeatherApiResponse(),
      });

      await service.getWeatherForLocation('Austin');

      const calledUrl = fetchMock.mock.calls[0][0];
      expect(calledUrl).toContain('https://api.openweathermap.org/data/2.5/weather');
      expect(calledUrl).toContain('q=Austin');
      expect(calledUrl).toContain('units=imperial');
      expect(calledUrl).toContain('appid=test-api-key');
    });
  });
});
