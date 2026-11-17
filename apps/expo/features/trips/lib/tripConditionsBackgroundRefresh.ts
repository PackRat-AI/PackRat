import { syncState, when } from '@legendapp/state';
import { safeJsonParse } from '@packrat/utils';
import * as Sentry from '@sentry/react-native';
import { normalizeFlags } from 'expo-app/atoms/featureFlagsAtom';
import { preferencesStore, preferencesSyncState } from 'expo-app/features/auth/store/preferences';
import { packItemsSyncState } from 'expo-app/features/packs/store/packItems';
import { packingModeStore } from 'expo-app/features/packs/store/packingMode';
import AsyncStorage from 'expo-app/lib/asyncStorage';
import { getDefaultTemperatureUnit } from 'expo-app/lib/unitDefaults';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { tripConditionsStore, tripReminderSettingsStore } from '../store/tripReminders';
import { tripsStore, tripsSyncState } from '../store/trips';
import { needsForecast } from '../utils/tripConditions';
import { refreshTripConditions, syncTripReminders } from './tripReminderScheduler';

/**
 * Keeps pre-trip reminders current when the app isn't opened for days: Android
 * wakes the app now and then, the destination forecast is refetched, and the
 * pending reminders are rewritten with the latest copy. Works from the
 * on-device cache — no UI is running.
 */
export const TRIP_CONDITIONS_TASK = 'world.packrat.trip-conditions';

/** Minutes. The OS treats this as a floor and picks the real time from usage. */
const INTERVAL_MINUTES = 4 * 60;

/** Same key `featureFlagsAtom` persists to; no React is running to read the atom. */
const FEATURE_FLAGS_STORAGE_KEY = 'featureFlags:v1';

async function isFeatureEnabled(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(FEATURE_FLAGS_STORAGE_KEY);
  return normalizeFlags(stored ? safeJsonParse(stored) : null).enableTripReminders;
}

async function run(): Promise<void> {
  await Promise.all([
    when(tripsSyncState.isPersistLoaded),
    when(packItemsSyncState.isPersistLoaded),
    when(preferencesSyncState.isPersistLoaded),
    when(syncState(packingModeStore).isPersistLoaded),
    when(syncState(tripConditionsStore).isPersistLoaded),
    when(syncState(tripReminderSettingsStore).isPersistLoaded),
  ]);
  if (!(await isFeatureEnabled())) return;
  const trips = Object.values(tripsStore.peek()).filter((trip) => !trip.deleted);
  if (!trips.some((trip) => needsForecast({ trip, now: new Date() }))) return;
  const unit = preferencesStore.temperatureUnit.peek() ?? getDefaultTemperatureUnit();
  await refreshTripConditions({ trips, force: true });
  await syncTripReminders({ trips, celsius: unit === 'C', featureEnabled: true });
}

// Defined at module scope so a headless launch finds the task before any UI mounts.
TaskManager.defineTask(TRIP_CONDITIONS_TASK, async () => {
  try {
    await run();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'tripReminders', action: 'backgroundRefresh' },
    });
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Registers the periodic refresh while the feature is on, and removes it when it isn't. */
export async function setTripConditionsRefreshEnabled(enabled: boolean): Promise<void> {
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(TRIP_CONDITIONS_TASK);
    if (enabled && !registered) {
      await BackgroundTask.registerTaskAsync(TRIP_CONDITIONS_TASK, {
        minimumInterval: INTERVAL_MINUTES,
      });
    } else if (!enabled && registered) {
      await BackgroundTask.unregisterTaskAsync(TRIP_CONDITIONS_TASK);
    }
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'tripReminders', action: 'registerBackgroundRefresh' },
      extra: { enabled },
    });
  }
}
