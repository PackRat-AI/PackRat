import type { WatchedLocation } from '@packrat/schemas/weatherMonitoring';
import type { SnackbarHandle } from '@packrat/ui/src/snackbar';
import { registerForPushIfNeeded } from 'expo-app/features/notifications/lib/pushRegistration';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { openPermissionSettings } from 'expo-app/lib/utils/openPermissionSettings';
import { useAtom } from 'jotai';
import { type RefObject, useCallback, useEffect } from 'react';
import { notificationsBlockedNoticeAtom } from '../atoms/watchNoticeAtoms';
import { useWatchMutations, type WatchablePlace } from './useWatchList';

/**
 * Watch and unwatch with Material feedback: every change confirms in a
 * snackbar with Undo, a failure says so and leaves the state as it was, and a
 * first watch with notifications blocked offers the way to system settings.
 */
export function useWatchFeedback(
  snackbar: RefObject<SnackbarHandle | null>,
  {
    showsNoticeFromSearch = false,
  }: {
    /** The screen search returns to after a watch shows search's blocked-notifications notice. */
    showsNoticeFromSearch?: boolean;
  } = {},
) {
  const { t } = useTranslation();
  const { watch, unwatch } = useWatchMutations();
  const [noticePending, setNoticePending] = useAtom(notificationsBlockedNoticeAtom);

  const showNotificationsBlocked = useCallback(async (): Promise<void> => {
    const result = await snackbar.current?.show({
      message: t('weather.notificationsOff'),
      actionLabel: t('weather.settings'),
    });
    if (result === 'actionPerformed') void openPermissionSettings('notifications');
  }, [snackbar, t]);

  // A watch made from search lands here after search has closed.
  useEffect(() => {
    if (!showsNoticeFromSearch || !noticePending) return;
    setNoticePending(false);
    void showNotificationsBlocked();
  }, [showsNoticeFromSearch, noticePending, setNoticePending, showNotificationsBlocked]);

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
        await showNotificationsBlocked();
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
    [snackbar, t, watch, unwatch, showNotificationsBlocked],
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
