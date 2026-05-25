import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WeatherLocation } from 'expo-app/features/weather/types';
import { createJSONStorage } from 'jotai/utils';

// createJSONStorage owns JSON.parse/stringify; AsyncStorage stores raw strings.
export const asyncStorage = createJSONStorage<WeatherLocation[]>(() => AsyncStorage);
