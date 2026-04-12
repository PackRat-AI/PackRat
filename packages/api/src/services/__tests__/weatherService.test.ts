import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WeatherService } from '../weatherService';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
global.fetch = vi.fn() as any;

vi.mock('@packrat/api/utils/env-validation', () => ({
  getEnv: vi.fn(() => ({
    OPENWEATHER_KEY: 'test-api-key',
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockContext() {
  return {} as any;
}

function mockWeatherResponse(data: any) {
  (global.fetch as any).mockResolvedValue({
    ok: true,
    json: async () => data,
  } as Response);
}

function mockWeatherError() {
  (global.fetch as any).mockResolvedValue({
    ok: false,
    status: 404,
  } as Response);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('WeatherService', () => {
  let service: WeatherService;
  let mockContext: ReturnType<typeof makeMockContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = makeMockContext();
    service = new WeatherService(mockContext);
  });

  describe('getWeatherForLocation', () => {
    it('fetches weather data successfully', async () => {
      const mockData = {
        main: {
          temp: 72.5,
          humidity: 65,
        },
        weather: [{ main: 'Clear' }],
        wind: {
          speed: 8.3,
        },
      };

      mockWeatherResponse(mockData);

      const result = await service.getWeatherForLocation('Seattle');

      expect(result).toEqual({
        location: 'Seattle',
        temperature: 73, // Rounded
        conditions: 'Clear',
        humidity: 65,
        windSpeed: 8, // Rounded
      });
    });

    it('makes API call with correct parameters', async () => {
      mockWeatherResponse({
        main: { temp: 70, humidity: 50 },
        weather: [{ main: 'Sunny' }],
        wind: { speed: 5 },
      });

      await service.getWeatherForLocation('New York');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openweathermap.org/data/2.5/weather?q=New%20York&units=imperial&appid=test-api-key',
      );
    });

    it('encodes location with spaces correctly', async () => {
      mockWeatherResponse({
        main: { temp: 70, humidity: 50 },
        weather: [{ main: 'Sunny' }],
        wind: { speed: 5 },
      });

      await service.getWeatherForLocation('San Francisco');

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('q=San%20Francisco'));
    });

    it('rounds temperature to nearest integer', async () => {
      mockWeatherResponse({
        main: { temp: 68.7, humidity: 50 },
        weather: [{ main: 'Cloudy' }],
        wind: { speed: 5 },
      });

      const result = await service.getWeatherForLocation('Portland');

      expect(result.temperature).toBe(69);
    });

    it('rounds wind speed to nearest integer', async () => {
      mockWeatherResponse({
        main: { temp: 70, humidity: 50 },
        weather: [{ main: 'Windy' }],
        wind: { speed: 12.8 },
      });

      const result = await service.getWeatherForLocation('Chicago');

      expect(result.windSpeed).toBe(13);
    });

    it('throws error when API request fails', async () => {
      mockWeatherError();

      await expect(service.getWeatherForLocation('InvalidLocation')).rejects.toThrow(
        'Weather API request failed',
      );
    });

    it('handles special characters in location', async () => {
      mockWeatherResponse({
        main: { temp: 70, humidity: 50 },
        weather: [{ main: 'Sunny' }],
        wind: { speed: 5 },
      });

      await service.getWeatherForLocation('São Paulo');

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('q=S%C3%A3o%20Paulo'));
    });

    it('returns correct weather conditions', async () => {
      const conditions = ['Clear', 'Clouds', 'Rain', 'Snow', 'Thunderstorm'];

      for (const condition of conditions) {
        mockWeatherResponse({
          main: { temp: 70, humidity: 50 },
          weather: [{ main: condition }],
          wind: { speed: 5 },
        });

        const result = await service.getWeatherForLocation('Test');
        expect(result.conditions).toBe(condition);
      }
    });
  });
});
