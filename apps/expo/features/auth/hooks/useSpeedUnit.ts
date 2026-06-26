import { use$ } from '@legendapp/state/react';
import { preferencesStore } from 'expo-app/features/auth/store/preferences';
import { getDefaultSpeedUnit } from 'expo-app/lib/unitDefaults';

export function useSpeedUnit() {
  const stored = use$(preferencesStore.speedUnit);
  const unit: 'mph' | 'kmh' = stored ?? getDefaultSpeedUnit();

  const setSpeedUnit = (value: 'mph' | 'kmh') => {
    preferencesStore.speedUnit.set(value);
  };

  // Takes a km/h value, returns a formatted string in the user's preferred unit
  const displayWindSpeed = (kph: number): string => {
    if (unit === 'mph') return `${Math.round(kph * 0.621371)} mph`;
    return `${Math.round(kph)} km/h`;
  };

  // Takes a km value, returns a formatted string in the user's preferred unit
  const displayVisibility = (km: number): string => {
    if (unit === 'mph') return `${Math.round(km * 0.621371)} mi`;
    return `${Math.round(km)} km`;
  };

  return { unit, setSpeedUnit, displayWindSpeed, displayVisibility };
}
