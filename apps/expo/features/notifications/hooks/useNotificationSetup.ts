import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { refreshPushRegistration } from '../lib/pushRegistration';
import { notificationRoute } from '../utils/notificationRoute';

// Show pushes that arrive while the app is open, as the system would otherwise
// drop them silently.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Mount once inside the signed-in app. Keeps this device's push token current
 * and opens the right screen when the user taps a notification, including the
 * one that cold-started the app.
 */
export function useNotificationSetup({ isAuthed }: { isAuthed: boolean }) {
  const monitoringEnabled = useFeatureFlag('enableWeatherMonitoring');
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!isAuthed || !monitoringEnabled) return;
    refreshPushRegistration();
    const subscription = Notifications.addPushTokenListener(() => {
      refreshPushRegistration();
    });
    return () => subscription.remove();
  }, [isAuthed, monitoringEnabled]);

  useEffect(() => {
    if (!isAuthed || !lastResponse) return;
    if (lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const route = notificationRoute(lastResponse.notification.request.content.data);
    if (route) router.push(route);
    Notifications.clearLastNotificationResponseAsync();
  }, [isAuthed, lastResponse]);
}
