import * as Sentry from '@sentry/react-native';
import { registerDeviceToken } from 'expo-app/features/weather/lib/watchListService';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Must match FCM_ALERTS_CHANNEL_ID in packages/api/src/services/push/fcmClient.ts. */
export const ALERTS_CHANNEL_ID = 'alerts';

/**
 * Creates the channel alert pushes post to. High importance so a hazard
 * alert heads up over the current app; users can still lower it per channel
 * in system settings. Idempotent — Android ignores re-creation.
 */
export async function ensureAlertsChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ALERTS_CHANNEL_ID, {
    name: 'Alerts',
    description: 'Weather hazards and trip updates',
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

async function sendToken(): Promise<void> {
  const token = await Notifications.getDevicePushTokenAsync();
  await registerDeviceToken(String(token.data));
}

/** Where push stands for this device after a registration attempt. */
export type PushRegistrationStatus = 'registered' | 'blocked' | 'unavailable';

/**
 * Asks for notification permission at the moment it is earned — right after
 * the user chooses to watch a place — then registers this device for push.
 * Never asks again once the user has declined for good; reports `blocked` so
 * the caller can point them to system settings instead.
 */
export async function registerForPushIfNeeded(): Promise<PushRegistrationStatus> {
  if (Platform.OS !== 'android' || !Device.isDevice) return 'unavailable';
  try {
    await ensureAlertsChannel();
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) {
      permission = await Notifications.requestPermissionsAsync();
    }
    if (!permission.granted) return 'blocked';
    await sendToken();
    return 'registered';
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'weatherMonitoring', action: 'registerForPush' },
    });
    return 'unavailable';
  }
}

/**
 * Re-sends the token on launch when permission is already granted, so a
 * rotated FCM token reaches the server without the user doing anything.
 * Never prompts.
 */
export async function refreshPushRegistration(): Promise<void> {
  if (Platform.OS !== 'android' || !Device.isDevice) return;
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;
    await ensureAlertsChannel();
    await sendToken();
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'weatherMonitoring', action: 'refreshPushRegistration' },
    });
  }
}
