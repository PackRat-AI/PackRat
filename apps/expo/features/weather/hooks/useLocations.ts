import { useAtom } from 'jotai';
import { baseLocationsAtom, locationsAtom } from '../atoms/locationsAtoms';
import type { WeatherLocation } from '../types';

type StoredLocations = WeatherLocation[] | Promise<WeatherLocation[]>;

async function resolveLocations(locations: StoredLocations) {
  return locations;
}

export function useLocations() {
  const [locationsState] = useAtom(locationsAtom);
  const [, setBaseLocations] = useAtom(baseLocationsAtom);

  const addLocation = (location: WeatherLocation) => {
    setBaseLocations(async (storedLocations) => {
      const locations = await resolveLocations(storedLocations);
      if (locations.some((loc) => loc.id === location.id)) return locations;
      return [...locations, location];
    });
  };

  const removeLocation = (locationId: number) => {
    setBaseLocations(async (storedLocations) => {
      const locations = await resolveLocations(storedLocations);
      return locations.filter((loc) => loc.id !== locationId);
    });
  };

  const updateLocation = (locationId: number, updates: Partial<WeatherLocation>) => {
    setBaseLocations(async (storedLocations) => {
      const locations = await resolveLocations(storedLocations);
      return locations.map((loc) => (loc.id === locationId ? { ...loc, ...updates } : loc));
    });
  };

  const resetLocations = () => {
    setBaseLocations([]); // Clear all locations
  };

  return {
    locationsState,
    addLocation,
    removeLocation,
    updateLocation,
    resetLocations,
  };
}
