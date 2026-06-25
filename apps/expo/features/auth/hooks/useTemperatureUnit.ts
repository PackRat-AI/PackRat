import { use$ } from '@legendapp/state/react';
import { preferencesStore } from 'expo-app/features/auth/store/preferences';
import { getDefaultTemperatureUnit } from 'expo-app/lib/unitDefaults';

export function useTemperatureUnit() {
  const stored = use$(preferencesStore.temperatureUnit);
  const unit: 'C' | 'F' = stored ?? getDefaultTemperatureUnit();

  const setTemperatureUnit = (value: 'C' | 'F') => {
    preferencesStore.temperatureUnit.set(value);
  };

  // Takes a Celsius value and returns a formatted string in the user's preferred unit
  const displayTemperature = (celsius: number): string => {
    if (unit === 'F') {
      return `${Math.round(celsius * 1.8 + 32)}°F`;
    }
    return `${Math.round(celsius)}°C`;
  };

  // Returns the raw numeric value in the preferred unit (no unit suffix)
  const toPreferred = (celsius: number): number => {
    if (unit === 'F') return Math.round(celsius * 1.8 + 32);
    return Math.round(celsius);
  };

  return { unit, setTemperatureUnit, displayTemperature, toPreferred };
}
