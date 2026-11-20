import * as Sentry from '@sentry/react-native';
import { openPermissionSettings } from 'expo-app/lib/utils/openPermissionSettings';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

/**
 * Whether PackRat may post notifications on this phone, reread whenever the
 * app returns to the foreground so a change made in system settings shows up
 * at once. `undefined` until the first read, and always on outside Android,
 * which this app doesn't ship notifications for.
 */
export function useNotificationPermission() {
  const [granted, setGranted] = useState<boolean | undefined>(
    Platform.OS === 'android' ? undefined : true,
  );

  const check = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    try {
      const permission = await Notifications.getPermissionsAsync();
      setGranted(permission.granted);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: 'notifications', action: 'readPermission' },
      });
    }
  }, []);

  useEffect(() => {
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => subscription.remove();
  }, [check]);

  const openSettings = useCallback(() => {
    Sentry.addBreadcrumb({
      category: 'notifications',
      message: 'Opened notification settings from the notifications-off notice',
      level: 'info',
    });
    void openPermissionSettings('notifications');
  }, []);

  return { granted, openSettings };
}
