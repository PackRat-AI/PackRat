import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WeatherLocation } from 'expo-app/features/weather/types';
import { createJSONStorage } from 'jotai/utils';

// Jotai storage adapter backed by AsyncStorage. `createJSONStorage` owns the
// JSON (de)serialization, so the backing storage must be a *string* storage —
// AsyncStorage already is one. (The previous hand-rolled adapter parsed inside
// the string-storage layer, which only type-checked because JSON.parse returns
// `any`; it was the wrong shape for createJSONStorage.)
export const asyncStorage = createJSONStorage<WeatherLocation[]>(() => AsyncStorage);
