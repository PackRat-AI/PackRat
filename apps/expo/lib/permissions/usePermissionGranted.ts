import * as Sentry from '@sentry/react-native';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

export async function notificationsGranted(): Promise<boolean> {
  const permission = await Notifications.getPermissionsAsync();
  return permission.granted;
}

export interface PermissionState {
  /** `null` until the first check answers, and while the check is not enabled. */
  granted: boolean | null;
  /** Checks again, e.g. once an in-app permission prompt has been answered. */
  refresh: () => Promise<void>;
}

/**
 * Whether a phone permission is granted, checked on mount and again each time the app returns to
 * the foreground, so turning it on in Settings and coming back updates the screen.
 */
export function usePermissionGranted({
  check,
  enabled = true,
  name,
}: {
  check: () => Promise<boolean>;
  enabled?: boolean;
  /** Names the permission in Sentry if the check itself fails. */
  name: string;
}): PermissionState {
  const [granted, setGranted] = useState<boolean | null>(null);
  const checkRef = useRef(check);
  checkRef.current = check;
  const live = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const refresh = useCallback(async () => {
    if (!enabledRef.current) return;
    try {
      const result = await checkRef.current();
      if (live.current && enabledRef.current) setGranted(result);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: 'permissions', action: 'checkPermission' },
        extra: { permission: name },
      });
    }
  }, [name]);

  useEffect(() => {
    live.current = true;
    if (!enabled) {
      setGranted(null);
      return;
    }
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      live.current = false;
      subscription.remove();
    };
  }, [enabled, refresh]);

  return { granted, refresh };
}

/** Whether PackRat may post notifications, kept current across trips to Settings. */
export function useNotificationsGranted(enabled = true): PermissionState {
  return usePermissionGranted({ check: notificationsGranted, enabled, name: 'notifications' });
}
