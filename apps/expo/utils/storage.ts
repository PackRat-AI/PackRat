import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'jotai/utils';
import { WeatherLocation } from '~/features/weather/types';

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
