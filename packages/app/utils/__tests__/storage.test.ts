import { beforeEach, describe, expect, it, type MockedFunction, vi } from 'vitest';

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

// Mock createJSONStorage
vi.mock('jotai/utils', () => ({
  createJSONStorage: vi.fn((storageFunction) => storageFunction()),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WeatherLocation } from 'app/features/weather/types';
import { asyncStorage } from '../storage';

describe('storage', () => {
  const mockAsyncStorage = AsyncStorage as unknown as {
    getItem: MockedFunction<typeof AsyncStorage.getItem>;
    setItem: MockedFunction<typeof AsyncStorage.setItem>;
    removeItem: MockedFunction<typeof AsyncStorage.removeItem>;
  };

  const createMockWeatherLocation = (id: number, name: string): WeatherLocation => ({
    id,
    name,
    temperature: 72,
    condition: 'Sunny',
    time: '2024-01-01T12:00:00Z',
    highTemp: 78,
    lowTemp: 65,
    lat: 40.7128,
    lon: -74.006,
    isActive: true,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getItem', () => {
    it('should retrieve and parse JSON value from AsyncStorage', async () => {
      const testData = [
        createMockWeatherLocation(1, 'Location 1'),
        createMockWeatherLocation(2, 'Location 2'),
      ];
      const serializedData = JSON.stringify(testData);

      mockAsyncStorage.getItem.mockResolvedValueOnce(serializedData);

      const result = await asyncStorage.getItem('weather-locations', []);

      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('weather-locations');
      expect(result).toEqual(testData);
    });

    it('should return null when AsyncStorage returns null', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(null);

      const result = await asyncStorage.getItem('weather-locations', []);

      expect(result).toBe(null); // createJSONStorage returns null when storage is null
    });

    it('should return null when AsyncStorage returns empty string', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce('');

      const result = await asyncStorage.getItem('weather-locations', []);

      // Empty string is falsy, so it returns null
      expect(result).toBe(null);
    });

    it('should handle JSON parsing errors gracefully', async () => {
      const invalidJson = '{ invalid json }';
      mockAsyncStorage.getItem.mockResolvedValueOnce(invalidJson);

      // The function should throw on invalid JSON, as that's expected behavior
      await expect(asyncStorage.getItem('weather-locations', [])).rejects.toThrow();
    });

    it('should handle AsyncStorage errors', async () => {
      const storageError = new Error('Storage read error');
      mockAsyncStorage.getItem.mockRejectedValueOnce(storageError);

      await expect(asyncStorage.getItem('weather-locations', [])).rejects.toThrow(
        'Storage read error',
      );
    });
  });

  describe('setItem', () => {
    it('should serialize and store data in AsyncStorage', async () => {
      const testData = [createMockWeatherLocation(1, 'Location 1')];

      mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

      await asyncStorage.setItem('weather-locations', testData);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'weather-locations',
        JSON.stringify(testData),
      );
    });

    it('should handle empty arrays', async () => {
      mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

      await asyncStorage.setItem('weather-locations', []);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'weather-locations',
        JSON.stringify([]),
      );
    });

    it('should handle complex nested objects', async () => {
      const complexData = [
        {
          ...createMockWeatherLocation(1, 'Complex Location'),
          details: {
            feelsLike: 75,
            humidity: 60,
            visibility: 10,
            uvIndex: 3,
            windSpeed: 5,
            weatherCode: 200,
            isDay: 1,
          },
        },
      ];

      mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

      await asyncStorage.setItem('weather-locations', complexData);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'weather-locations',
        JSON.stringify(complexData),
      );
    });

    it('should handle null values', async () => {
      mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

      // Note: null isn't valid for WeatherLocation[], but testing the underlying JSON storage
      await expect(asyncStorage.setItem('weather-locations', null as any)).resolves.not.toThrow();

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('weather-locations', 'null');
    });

    it('should handle AsyncStorage write errors', async () => {
      const storageError = new Error('Storage write error');
      mockAsyncStorage.setItem.mockRejectedValueOnce(storageError);

      await expect(asyncStorage.setItem('weather-locations', [])).rejects.toThrow(
        'Storage write error',
      );
    });

    it('should handle JSON serialization errors', async () => {
      // Create a circular reference that can't be serialized
      const circularData: Record<string, unknown> = { name: 'test' };
      circularData.self = circularData;

      await expect(
        asyncStorage.setItem('weather-locations', circularData as any),
      ).rejects.toThrow();
    });
  });

  describe('removeItem', () => {
    it('should remove item from AsyncStorage', async () => {
      mockAsyncStorage.removeItem.mockResolvedValueOnce(undefined);

      await asyncStorage.removeItem('weather-locations');

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('weather-locations');
    });

    it('should handle removal errors', async () => {
      const removalError = new Error('Storage removal error');
      mockAsyncStorage.removeItem.mockRejectedValueOnce(removalError);

      await expect(asyncStorage.removeItem('weather-locations')).rejects.toThrow(
        'Storage removal error',
      );
    });

    it('should handle removing non-existent keys gracefully', async () => {
      // AsyncStorage typically doesn't error when removing non-existent keys
      mockAsyncStorage.removeItem.mockResolvedValueOnce(undefined);

      await expect(asyncStorage.removeItem('non-existent-key')).resolves.not.toThrow();

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('non-existent-key');
    });
  });

  describe('integration', () => {
    it('should support a complete set/get/remove cycle', async () => {
      const testData = [createMockWeatherLocation(1, 'Test Location')];

      // Set
      mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);
      await asyncStorage.setItem('test-key', testData);

      // Get
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(testData));
      const retrieved = await asyncStorage.getItem('test-key', []);
      expect(retrieved).toEqual(testData);

      // Remove
      mockAsyncStorage.removeItem.mockResolvedValueOnce(undefined);
      await asyncStorage.removeItem('test-key');

      // Verify all operations called AsyncStorage correctly
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('test-key', JSON.stringify(testData));
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('test-key');
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('test-key');
    });
  });
});
