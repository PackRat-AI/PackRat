import { useAtom } from 'jotai';
import { baseLocationsAtom, locationsAtom } from '../atoms/locationsAtoms';
import type { WeatherLocation } from '../types';

export function useLocations() {
  const [locationsState] = useAtom(locationsAtom);
  const [, setBaseLocations] = useAtom(baseLocationsAtom);

  const addLocation = (location: WeatherLocation) => {
    if (locationsState.state !== 'hasData') return;

    const locations = locationsState.data;

    // Check if location already exists
    if (locations.some((loc) => loc.id === location.id)) {
      return;
    }

    // Add new location
    setBaseLocations([...locations, location]);
  };

  const removeLocation = (locationId: string) => {
    if (locationsState.state !== 'hasData') return;

    const locations = locationsState.data;

    // Remove location
    setBaseLocations(locations.filter((loc) => loc.id !== locationId));
  };

  const updateLocation = (locationId: string, updates: Partial<WeatherLocation>) => {
    if (locationsState.state !== 'hasData') return;

    const locations = locationsState.data;

    // Update location
    setBaseLocations(
      locations.map((loc) => (loc.id === locationId ? { ...loc, ...updates } : loc))
    );
  };

  return {
    locationsState,
    addLocation,
    removeLocation,
    updateLocation,
  };
}
