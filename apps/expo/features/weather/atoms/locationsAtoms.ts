import { atom } from 'jotai';
import { atomWithStorage, loadable } from 'jotai/utils';
import { asyncStorage } from 'expo-app/utils/storage';
import type { WeatherLocation } from '../types';

// Create a base atom for locations
export const baseLocationsAtom = atomWithStorage<WeatherLocation[]>(
  'locations',
  [], // Start with an empty array, no hardcoded location
  asyncStorage
);

// Create a loadable version of the atom to handle async loading
export const locationsAtom = loadable(baseLocationsAtom);

// Create a derived atom for the active location
export const activeLocationAtom = atom(
  (get) => {
    const locationsResult = get(locationsAtom);

    // Handle the loadable states
    if (locationsResult.state === 'hasData') {
      const locations = locationsResult.data;
      return locations.find((location) => location.isActive) || locations[0] || null;
    }

    // Return null during loading or error states
    return null;
  },
  (get, set, newActiveId: string) => {
    const locationsResult = get(locationsAtom);

    if (locationsResult.state === 'hasData') {
      const locations = locationsResult.data;
      const updatedLocations = locations.map((location) => ({
        ...location,
        isActive: location.id === newActiveId,
      }));
      set(baseLocationsAtom, updatedLocations);
    }
  }
);

// Create a search filter atom
export const searchQueryAtom = atom('');
