import { use$ } from '@legendapp/state/react';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useMemo } from 'react';
import { tripConditionsStore } from '../store/tripReminders';
import { hasUnreadTripAlert, tripWeatherAlertReadsStore } from '../store/tripWeatherAlertReads';

/**
 * Trips carrying a destination alert the user hasn't seen on the trip yet, so
 * the trip list can mark them. Opening the trip clears it.
 */
export function useUnreadTripWeatherAlerts(): Set<string> {
  const enabled = useFeatureFlag('enableTripWeather');
  const conditions = use$(tripConditionsStore);
  const reads = use$(tripWeatherAlertReadsStore);
  return useMemo(() => {
    if (!enabled) return new Set<string>();
    return new Set(
      Object.values(conditions ?? {})
        .filter((entry) =>
          hasUnreadTripAlert({
            seen: reads?.[entry.tripId],
            alertIds: entry.alerts.map((alert) => alert.id),
          }),
        )
        .map((entry) => entry.tripId),
    );
  }, [enabled, conditions, reads]);
}
