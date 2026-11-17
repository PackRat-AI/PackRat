import * as Sentry from '@sentry/react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchTripAlertsEnabled,
  setTripAlertsEnabled,
} from 'expo-app/features/weather/lib/watchListService';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
import { useCallback } from 'react';
import type { Trip } from '../types';
import { useUpdateTrip } from './useUpdateTrip';

export const tripAlertsSettingQueryKey = ['weather', 'trip-alerts-setting'] as const;

/**
 * The account-level Trip Weather Alerts switch, held on the server. `enabled`
 * is undefined until it has loaded, or while trip weather is off.
 */
export function useTripAlertsSetting() {
  const flagOn = useFeatureFlag('enableTripWeather');
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();
  const active = flagOn && isQueryEnabledWithAccessToken;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: tripAlertsSettingQueryKey,
    queryFn: fetchTripAlertsEnabled,
    enabled: active,
  });
  const mutation = useMutation({
    mutationFn: setTripAlertsEnabled,
    // One scope runs quick toggles in order, so the last tap is the one the server keeps.
    scope: { id: 'trip-alerts-setting' },
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: tripAlertsSettingQueryKey });
      queryClient.setQueryData(tripAlertsSettingQueryKey, enabled);
    },
    // A save that failed flips the switch back, then reloads what the server holds.
    onError: (_error, enabled) => {
      Sentry.addBreadcrumb({
        category: 'tripWeather',
        message: 'Trip Weather Alerts setting failed to save; reloading',
        level: 'warning',
      });
      queryClient.setQueryData(tripAlertsSettingQueryKey, !enabled);
      queryClient.invalidateQueries({ queryKey: tripAlertsSettingQueryKey });
    },
  });
  return {
    active,
    enabled: active ? query.data : undefined,
    isError: query.isError,
    refetch: query.refetch,
    setEnabled: mutation.mutate,
    setEnabledAsync: mutation.mutateAsync,
  };
}

/** Whether a trip pushes weather alerts; a trip that never set it does. */
export function tripSendsWeatherAlerts(trip: Pick<Trip, 'weatherAlerts'>): boolean {
  return trip.weatherAlerts !== false;
}

/** Turns one trip's weather alert pushes off or back on. Synced like any trip edit. */
export function useSetTripWeatherAlerts() {
  const updateTrip = useUpdateTrip();
  return useCallback(
    (trip: Trip, on: boolean) => updateTrip({ ...trip, weatherAlerts: on }),
    [updateTrip],
  );
}
