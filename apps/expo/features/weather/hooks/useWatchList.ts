import type { WatchedLocation } from '@packrat/schemas/weatherMonitoring';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
import { useCallback } from 'react';
import { addWatchedLocation, fetchWatchList, removeWatchedLocation } from '../lib/watchListService';
import { formatWeatherData, getWeatherData } from '../lib/weatherService';
import type { LocationSearchResult, WeatherLocation } from '../types';
import { useLocations } from './useLocations';

export const WATCH_LIST_QUERY_KEY = ['weather', 'watch-list'] as const;

/** A place that can be watched: a saved location or a search result. */
export type WatchablePlace = Pick<WeatherLocation, 'id' | 'name' | 'lat' | 'lon'> &
  Partial<Pick<LocationSearchResult, 'region' | 'country'>>;

/** The server-side watch list. Empty, and never fetched, while monitoring is off. */
export function useWatchList() {
  const enabled = useFeatureFlag('enableWeatherMonitoring');
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  const query = useQuery({
    queryKey: WATCH_LIST_QUERY_KEY,
    enabled: enabled && isQueryEnabledWithAccessToken,
    queryFn: fetchWatchList,
    staleTime: 1000 * 60 * 5,
  });

  const watched = enabled ? (query.data ?? []) : [];
  const watchedFor = useCallback(
    (weatherLocationId: number) => watched.find((w) => w.weatherLocationId === weatherLocationId),
    [watched],
  );

  return { enabled, watched, watchedFor, isLoading: query.isLoading, refetch: query.refetch };
}

/**
 * Watch and unwatch. Watching saves the place first — a watched place is
 * always one of the user's locations. Callers follow a successful watch with
 * `registerForPushIfNeeded`, because that is the moment push earns its prompt.
 */
export function useWatchMutations() {
  const queryClient = useQueryClient();
  const { locationsState, addLocation } = useLocations();

  const watch = useMutation({
    mutationFn: async (place: WatchablePlace) => {
      const saved =
        locationsState.state === 'hasData' && locationsState.data.some((l) => l.id === place.id);
      if (!saved) addLocation(formatWeatherData(await getWeatherData(place.id)));
      return addWatchedLocation({
        weatherLocationId: place.id,
        locationName: place.name,
        region: place.region ?? null,
        country: place.country ?? null,
        lat: place.lat,
        lon: place.lon,
      });
    },
    onSuccess: (created) => {
      queryClient.setQueryData<WatchedLocation[]>(WATCH_LIST_QUERY_KEY, (current = []) =>
        current.some((w) => w.id === created.id) ? current : [...current, created],
      );
    },
  });

  // Optimistic: the row leaves at once and comes back if the server refuses.
  const unwatch = useMutation({
    mutationFn: async (watched: WatchedLocation) => {
      await removeWatchedLocation(watched.id);
      return watched;
    },
    onMutate: async (watched) => {
      await queryClient.cancelQueries({ queryKey: WATCH_LIST_QUERY_KEY });
      queryClient.setQueryData<WatchedLocation[]>(WATCH_LIST_QUERY_KEY, (current = []) =>
        current.filter((w) => w.id !== watched.id),
      );
    },
    onError: () => queryClient.invalidateQueries({ queryKey: WATCH_LIST_QUERY_KEY }),
  });

  return { watch, unwatch };
}
