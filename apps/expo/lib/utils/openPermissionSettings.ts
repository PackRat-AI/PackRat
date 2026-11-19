import * as Sentry from '@sentry/react-native';
import * as Application from 'expo-application';
import { Linking, Platform } from 'react-native';

/** Where an Open Settings button lands: the app's notification page, or its main settings page. */
export type PermissionSettingsTarget = 'notifications' | 'app';

/**
 * Opens the settings page that fixes the permission. Android has a public page for an app's
 * notifications; location, camera and photos only go as deep as the app's own settings page.
 */
export async function openPermissionSettings(target: PermissionSettingsTarget): Promise<void> {
  // The installed package, not the config's: a dev or preview build has its own id.
  const packageName = Application.applicationId;
  if (target === 'notifications' && Platform.OS === 'android' && packageName) {
    try {
      await Linking.sendIntent('android.settings.APP_NOTIFICATION_SETTINGS', [
        { key: 'android.provider.extra.APP_PACKAGE', value: packageName },
      ]);
      return;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: 'permissions', action: 'openNotificationSettings' },
      });
    }
  }
  await Linking.openSettings();
}
