import type { WatchedLocation } from '@packrat/schemas/weatherMonitoring';
import type { SnackbarHandle } from '@packrat/ui/src/snackbar';
import { registerForPushIfNeeded } from 'expo-app/features/notifications/lib/pushRegistration';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { type RefObject, useCallback } from 'react';
import { Linking } from 'react-native';
import { useWatchMutations, type WatchablePlace } from './useWatchList';

/**
 * Watch and unwatch with Material feedback: every change confirms in a
 * snackbar with Undo, a failure says so and leaves the state as it was, and a
 * first watch with notifications blocked offers the way to system settings.
 */
export function useWatchFeedback(snackbar: RefObject<SnackbarHandle | null>) {
  const { t } = useTranslation();
  const { watch, unwatch } = useWatchMutations();

  const watchPlace = useCallback(
    async (place: WatchablePlace): Promise<void> => {
      let created: WatchedLocation;
      try {
        created = await watch.mutateAsync(place);
      } catch {
        snackbar.current?.show({ message: t('weather.watchFailed', { name: place.name }) });
        return;
      }

      const push = await registerForPushIfNeeded();
      if (push === 'blocked') {
        const result = await snackbar.current?.show({
          message: t('weather.notificationsOff'),
          actionLabel: t('weather.settings'),
        });
        if (result === 'actionPerformed') Linking.openSettings();
        return;
      }

      const result = await snackbar.current?.show({
        message: t('weather.watchingConfirmation', { name: place.name }),
        actionLabel: t('weather.undo'),
      });
      if (result === 'actionPerformed') {
        await unwatch.mutateAsync(created).catch(() => undefined);
      }
    },
    [snackbar, t, watch, unwatch],
  );

  const unwatchPlace = useCallback(
    async (watched: WatchedLocation): Promise<void> => {
      try {
        await unwatch.mutateAsync(watched);
      } catch {
        snackbar.current?.show({
          message: t('weather.unwatchFailed', { name: watched.locationName }),
        });
        return;
      }
      const result = await snackbar.current?.show({
        message: t('weather.unwatchedConfirmation', { name: watched.locationName }),
        actionLabel: t('weather.undo'),
      });
      if (result === 'actionPerformed') {
        await watch
          .mutateAsync({
            id: watched.weatherLocationId,
            name: watched.locationName,
            region: watched.region ?? undefined,
            country: watched.country ?? undefined,
            lat: watched.lat,
            lon: watched.lon,
          })
          .catch(() => undefined);
      }
    },
    [snackbar, t, watch, unwatch],
  );

  return {
    watchPlace,
    unwatchPlace,
    isUpdating: watch.isPending || unwatch.isPending,
  };
}
