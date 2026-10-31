import type { WeatherAlertItem } from '@packrat/schemas/weather';
import { useAtom } from 'jotai';
import { useCallback } from 'react';
import { seenAlertIdsAtom } from '../atoms/locationsAtoms';
import type { WeatherLocation } from '../types';
import { hasUnseenAlert, markAlertsSeen } from '../utils/alertState';

export function useSeenAlerts() {
  const [seen, setSeen] = useAtom(seenAlertIdsAtom);

  const isUnseen = useCallback(
    (location: Pick<WeatherLocation, 'id' | 'alertList'>) =>
      hasUnseenAlert({ locationId: location.id, alerts: location.alertList, seen }),
    [seen],
  );

  const markSeen = useCallback(
    (locationId: number, alerts: readonly WeatherAlertItem[]) => {
      setSeen(async (current) => markAlertsSeen({ locationId, alerts, seen: await current }));
    },
    [setSeen],
  );

  return { isUnseen, markSeen };
}

/** True when any saved location carries an alert the user has not opened. */
export function useHasAnyUnseenAlert(locations: readonly WeatherLocation[]): boolean {
  const { isUnseen } = useSeenAlerts();
  return locations.some(isUnseen);
}
