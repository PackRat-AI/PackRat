import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import type { Coordinate } from '../utils/trails';

export interface ReportLocation {
  coordinate: Coordinate | null;
  /** The hiker declined location; the picker falls back to search by name. */
  isDenied: boolean;
}

/**
 * Where the device is, for "trails near you", the pin's starting point, and the place a trail
 * report was written from. Mirrors `TrailReportLocationProvider` in the Swift app. Declining
 * location is a supported way to use the feature, not an error.
 */
export function useReportLocation(enabled = true): ReportLocation {
  const [state, setState] = useState<ReportLocation>({ coordinate: null, isDenied: false });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const update = (position: Location.LocationObject | null) => {
      if (cancelled || !position) return;
      const { latitude, longitude } = position.coords;
      setState({ coordinate: { latitude, longitude }, isDenied: false });
    };

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        if (!cancelled) setState({ coordinate: null, isDenied: true });
        return;
      }
      update(await Location.getLastKnownPositionAsync());
      update(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    })().catch(() => {
      // No fix means searching by name, which is a normal outcome.
    });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return state;
}
