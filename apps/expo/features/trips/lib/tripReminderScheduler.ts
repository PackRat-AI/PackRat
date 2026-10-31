import * as Sentry from '@sentry/react-native';
import { registerForPushIfNeeded } from 'expo-app/features/notifications/lib/pushRegistration';
import { getPackItems } from 'expo-app/features/packs/store/packItems';
import { packingModeStore } from 'expo-app/features/packs/store/packingMode';
import { apiClient } from 'expo-app/lib/api/packrat';
import { obs } from 'expo-app/lib/store';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { tripConditionsStore, tripReminderSettingsStore } from '../store/tripReminders';
import type { Trip } from '../types';
import {
  isConditionsFresh,
  makeTripConditions,
  needsForecast,
  reminderLine,
} from '../utils/tripConditions';
import {
  packedIdsFrom,
  TRIP_REMINDER_ID_PREFIX,
  type TripReminder,
  tripReminders,
} from '../utils/tripReminderPlanner';

/** Reminders post here, apart from server-pushed alerts, so a user can quiet one without the other. */
export const TRIP_REMINDERS_CHANNEL_ID = 'trip-reminders';

/** Ceiling on pending reminders; the soonest win. */
const MAX_PENDING = 48;

async function ensureRemindersChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(TRIP_REMINDERS_CHANNEL_ID, {
    name: 'Trip Reminders',
    description: 'Packing and weather in the days before a trip',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

function itemsForTrip(trip: Trip) {
  return trip.packId ? getPackItems(trip.packId) : null;
}

/**
 * Fetches the destination forecast for every trip inside the forecast window
 * and drops entries for trips that no longer need one. Throttled per trip, so
 * calling it on every foreground costs nothing until a forecast is an hour old.
 * On failure the last forecast stays.
 */
export async function refreshTripConditions({
  trips,
  now = new Date(),
}: {
  trips: Trip[];
  now?: Date;
}): Promise<void> {
  const due = trips.filter((trip) => needsForecast({ trip, now }));
  const dueIds = new Set(due.map((trip) => trip.id));
  for (const id of Object.keys(tripConditionsStore.peek())) {
    if (!dueIds.has(id)) obs({ store: tripConditionsStore, id }).delete();
  }

  for (const trip of due) {
    const existing = tripConditionsStore.peek()[trip.id];
    if (isConditionsFresh({ existing, trip, now }) || !trip.location) continue;
    const { latitude, longitude } = trip.location;
    try {
      const { data, error } = await apiClient.weather['by-name'].get({
        query: { q: `${latitude},${longitude}` },
      });
      if (error || !data) {
        Sentry.captureException(error?.value ?? error, {
          tags: { feature: 'tripReminders', action: 'fetchConditions' },
          extra: { tripId: trip.id, httpStatus: error?.status },
        });
        continue;
      }
      const summary = makeTripConditions({ trip, forecast: data, now });
      // Moved out of the forecast's reach: drop the old destination's weather.
      const entry = obs({ store: tripConditionsStore, id: trip.id });
      if (summary) entry.set(summary);
      else entry.delete();
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: 'tripReminders', action: 'fetchConditions' },
        extra: { tripId: trip.id },
      });
    }
  }
}

/**
 * Brings the device's pending trip reminders in step with the user's trips.
 * Clears every pending trip reminder and schedules afresh from current state:
 * that one rule covers new trips, moved dates, deleted trips and packing
 * progress without tracking any of them individually. Reminders are local
 * notifications, so they fire with no signal.
 */
export async function syncTripReminders({
  trips,
  celsius,
  featureEnabled,
  now = new Date(),
}: {
  trips: Trip[];
  celsius: boolean;
  featureEnabled: boolean;
  now?: Date;
}): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => request.identifier.startsWith(TRIP_REMINDER_ID_PREFIX))
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );

  const settings = tripReminderSettingsStore.peek();
  if (!featureEnabled || !settings.enabled) return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;
  await ensureRemindersChannel();

  const conditions = tripConditionsStore.peek();
  const packing = packingModeStore.peek();
  const reminders = trips
    .filter((trip) => !settings.mutedTripIds[trip.id])
    .flatMap((trip) => {
      const tripConditions = conditions[trip.id];
      return tripReminders({
        trip,
        items: itemsForTrip(trip),
        packedItemIds: packedIdsFrom(trip.packId ? packing[trip.packId] : null),
        now,
        conditionsLine: tripConditions
          ? reminderLine({ conditions: tripConditions, celsius })
          : null,
      });
    })
    .sort((a, b) => a.fireDate.getTime() - b.fireDate.getTime())
    .slice(0, MAX_PENDING);

  for (const reminder of reminders) {
    try {
      await schedule(reminder);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: 'tripReminders', action: 'schedule' },
        extra: { tripId: reminder.tripId, moment: reminder.moment },
      });
    }
  }
}

function schedule(reminder: TripReminder): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    identifier: reminder.identifier,
    content: {
      title: reminder.title,
      body: reminder.body,
      sound: true,
      data: { tripId: reminder.tripId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminder.fireDate,
      channelId: TRIP_REMINDERS_CHANNEL_ID,
    },
  });
}

/**
 * Asks for notification permission at the moment it makes sense: the user just
 * turned a trip's reminders on. Also registers this device for the
 * trip-destination weather alert the server pushes.
 */
export async function requestTripReminderPermission(): Promise<void> {
  if (!tripReminderSettingsStore.enabled.peek()) return;
  await registerForPushIfNeeded();
}
