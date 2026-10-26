import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useLocationRefresh } from './useLocationRefresh';
import { useLocations } from './useLocations';

/**
 * Refreshes every saved location's forecast when the app opens and each time
 * it returns to the foreground, so the "new alert" markers are right before
 * the user goes looking — not only after they visit Weather. Pull, not push:
 * the app opening is the one event guaranteed to precede seeing a marker.
 */
export function useWeatherAlertRefresh({ enabled }: { enabled: boolean }) {
  const { locationsState } = useLocations();
  const { refreshAllLocations } = useLocationRefresh();
  const refresh = useRef(refreshAllLocations);
  refresh.current = refreshAllLocations;
  const isReady = locationsState.state === 'hasData';

  useEffect(() => {
    if (enabled && isReady) refresh.current();
  }, [enabled, isReady]);

  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh.current();
    });
    return () => subscription.remove();
  }, [enabled]);
}
