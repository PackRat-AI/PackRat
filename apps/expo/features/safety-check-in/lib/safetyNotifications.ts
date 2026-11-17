import * as Sentry from '@sentry/react-native';
import { format } from 'date-fns';
import * as Notifications from 'expo-notifications';
import i18next from 'i18next';
import { Platform } from 'react-native';
import type { LocalSafetyCheckIn } from '../types';
import { plannedNotifications, SAFETY_NOTIFICATION_PREFIX } from '../utils/safetyCheckIn';
import { capitalizeFirst, contactSummary } from './copy';

/** Its own channel, so a user who quiets trip reminders still hears that they're overdue. */
export const SAFETY_CHANNEL_ID = 'safety-check-in';

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(SAFETY_CHANNEL_ID, {
    name: i18next.t('safetyCheckIn.notifications.channelName'),
    description: i18next.t('safetyCheckIn.notifications.channelDescription'),
    importance: Notifications.AndroidImportance.HIGH,
  });
}

function content({ checkIn, kind }: { checkIn: LocalSafetyCheckIn; kind: 'reminder' | 'overdue' }) {
  const t = i18next.t;
  if (kind === 'reminder') {
    return {
      title: t('safetyCheckIn.notifications.reminderTitle'),
      body: t('safetyCheckIn.notifications.reminderBody', {
        trip: checkIn.tripName,
        time: format(new Date(checkIn.expectedReturnAt), 'p'),
      }),
    };
  }
  return {
    title: t('safetyCheckIn.notifications.overdueTitle'),
    body: t('safetyCheckIn.notifications.overdueBody', {
      who: capitalizeFirst(contactSummary({ names: checkIn.contactNames, t })),
      count: checkIn.contactNames.length,
      trip: checkIn.tripName,
    }),
  };
}

/**
 * Notification changes run one after another. Callers don't await them, so without this an end
 * could finish before the schedule it follows, leaving a reminder for a trip that's over, and two
 * quick extensions could land in the wrong order.
 */
let pending: Promise<void> = Promise.resolve();
function inOrder(change: () => Promise<void>): Promise<void> {
  pending = pending.then(change, change);
  return pending;
}

async function cancelNow(checkInId: string): Promise<void> {
  await Promise.all(
    [`reminder-${checkInId}`, `overdue-${checkInId}`].map((suffix) =>
      Notifications.cancelScheduledNotificationAsync(`${SAFETY_NOTIFICATION_PREFIX}${suffix}`),
    ),
  );
}

/** Clears a check-in's pending notifications. */
export function cancelSafetyNotifications(checkInId: string): Promise<void> {
  return inOrder(() => cancelNow(checkInId));
}

/**
 * Schedules the hour-before reminder and the "alert sent" notice as local notifications, so they
 * arrive on time with no signal. Replaces anything already scheduled for this check-in.
 */
export function scheduleSafetyNotifications(checkIn: LocalSafetyCheckIn): Promise<void> {
  return inOrder(() => scheduleNow(checkIn));
}

async function scheduleNow(checkIn: LocalSafetyCheckIn): Promise<void> {
  try {
    await cancelNow(checkIn.id);
    // Android 13 shows the notification permission prompt only once a channel exists.
    await ensureChannel();
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) {
      permission = await Notifications.requestPermissionsAsync();
    }
    if (!permission.granted) return;
    for (const planned of plannedNotifications({ checkIn, now: new Date() })) {
      await Notifications.scheduleNotificationAsync({
        identifier: planned.identifier,
        content: {
          ...content({ checkIn, kind: planned.kind }),
          sound: true,
          data: { tripId: checkIn.tripId },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: planned.fireAt,
          channelId: SAFETY_CHANNEL_ID,
        },
      });
    }
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'safetyCheckIn', action: 'scheduleNotifications' },
      extra: { checkInId: checkIn.id },
    });
  }
}

/** Clears every safety notification, e.g. on sign-out. */
export function cancelAllSafetyNotifications(): Promise<void> {
  return inOrder(cancelAllNow);
}

async function cancelAllNow(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => request.identifier.startsWith(SAFETY_NOTIFICATION_PREFIX))
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );
}
