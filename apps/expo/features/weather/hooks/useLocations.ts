import { useAtom, useSetAtom } from 'jotai';
import { useCallback } from 'react';
import { baseLocationsAtom, locationsAtom } from '../atoms/locationsAtoms';
import type { WeatherLocation } from '../types';

type Updater = (locations: WeatherLocation[]) => WeatherLocation[];

/**
 * Saved locations. Every write is a functional update against the stored
 * list, never against this render's snapshot — a refresh loop updates
 * locations one after another, and snapshot writes overwrote each other so
 * only the last location kept its fresh forecast.
 */
export function useLocations() {
  const [locationsState] = useAtom(locationsAtom);
  const setBaseLocations = useSetAtom(baseLocationsAtom);

  // Synchronous once storage has loaded: handing the atom a promise puts the
  // list back into its loading state, which left a swiped card stuck on screen.
  const update = useCallback(
    (updater: Updater) =>
      setBaseLocations((current) =>
        current instanceof Promise ? current.then(updater) : updater(current),
      ),
    [setBaseLocations],
  );

  const addLocation = useCallback(
    (location: WeatherLocation) =>
      update((locations) =>
        locations.some((loc) => loc.id === location.id) ? locations : [...locations, location],
      ),
    [update],
  );

  const removeLocation = useCallback(
    (locationId: number) => update((locations) => locations.filter((loc) => loc.id !== locationId)),
    [update],
  );

  const updateLocation = useCallback(
    ({ locationId, updates }: { locationId: number; updates: Partial<WeatherLocation> }) =>
      update((locations) =>
        locations.map((loc) => (loc.id === locationId ? { ...loc, ...updates } : loc)),
      ),
    [update],
  );

  // Puts a just-removed location back where it was (snackbar Undo).
  const restoreLocation = useCallback(
    ({ location, index }: { location: WeatherLocation; index: number }) =>
      update((locations) => {
        const rest = locations.filter((loc) => loc.id !== location.id);
        return [...rest.slice(0, index), location, ...rest.slice(index)];
      }),
    [update],
  );

  const resetLocations = useCallback(() => setBaseLocations([]), [setBaseLocations]);

  return {
    locationsState,
    addLocation,
    removeLocation,
    updateLocation,
    restoreLocation,
    resetLocations,
  };
}
