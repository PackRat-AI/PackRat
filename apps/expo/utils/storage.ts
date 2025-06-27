import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WeatherLocation } from 'expo-app/features/weather/types';
import { createJSONStorage } from 'jotai/utils';

// Create a storage adapter for Jotai that uses AsyncStorage
export const asyncStorage = createJSONStorage<WeatherLocation[]>(() => ({
  getItem: async (key: string) => {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  },
  setItem: async (key: string, value: unknown) => {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  removeItem: async (key: string) => {
    await AsyncStorage.removeItem(key);
  },
}));
