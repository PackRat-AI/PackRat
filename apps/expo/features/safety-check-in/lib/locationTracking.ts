import { when } from '@legendapp/state';
import * as Sentry from '@sentry/react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import i18next from 'i18next';
import { addTrackPoints, safetyStore, safetySyncState } from '../store/safetyCheckIn';
import type { SafetyLocationFix } from '../types';
import { hasTrackingCheckIn } from '../utils/safetyQueue';

/**
 * Follows the user's progress during a check-in that allowed it. Android only delivers locations
 * to a backgrounded app through a foreground service, which shows a persistent notification while
 * tracking runs. Positions come in when the user has moved a meaningful distance, so a day on the
 * trail costs little battery, and are queued offline until there is signal.
 */
export const SAFETY_LOCATION_TASK = 'world.packrat.safety-location';

/** Metres between recorded positions. */
const DISTANCE_INTERVAL = 500;
/** A fix worse than this says little about where the user is. */
const MAX_ACCURACY_METERS = 1_000;

function toFix(location: Location.LocationObject): SafetyLocationFix {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy ?? null,
    recordedAt: new Date(location.timestamp),
  };
}

// Defined at module scope so a headless relaunch finds the task before any UI mounts.
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  SAFETY_LOCATION_TASK,
  async ({ data, error }) => {
    if (error || !data) return; // A missed fix is a gap in the path; the next one fills it.
    try {
      await when(safetySyncState.isPersistLoaded);
      const fixes = data.locations
        .filter((l) => l.coords.accuracy == null || l.coords.accuracy <= MAX_ACCURACY_METERS)
        .map(toFix);
      addTrackPoints(fixes);
    } catch (taskError) {
      Sentry.captureException(taskError, {
        tags: { feature: 'safetyCheckIn', action: 'trackLocation' },
      });
    }
  },
);

export async function hasBackgroundPermission(): Promise<boolean> {
  const permission = await Location.getBackgroundPermissionsAsync();
  return permission.granted;
}

/**
 * Asks for "Allow all the time". Android grants it only after while-in-use access, and opens the
 * app's location settings for the second step. Call only after showing the in-app disclosure.
 */
export async function requestBackgroundPermission(): Promise<boolean> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) return false;
  const background = await Location.requestBackgroundPermissionsAsync();
  return background.granted;
}

/**
 * Starts and stops run one after another, and a start checks there is still a check-in to track
 * once its turn comes. Callers don't await them, so otherwise an I'm Safe or sign-out during a
 * slow start could stop nothing and leave the start to switch sharing back on.
 */
let pending: Promise<void> = Promise.resolve();
function inOrder(change: () => Promise<void>): Promise<void> {
  pending = pending.then(change, change);
  return pending;
}

export function startTracking(): Promise<void> {
  return inOrder(startNow);
}

export function stopTracking(): Promise<void> {
  return inOrder(stopNow);
}

async function startNow(): Promise<void> {
  try {
    if (!hasTrackingCheckIn(safetyStore.peek())) return;
    if (!(await hasBackgroundPermission())) return;
    if (await Location.hasStartedLocationUpdatesAsync(SAFETY_LOCATION_TASK)) return;
    await Location.startLocationUpdatesAsync(SAFETY_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: DISTANCE_INTERVAL,
      deferredUpdatesDistance: DISTANCE_INTERVAL,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: i18next.t('safetyCheckIn.tracking.serviceTitle'),
        notificationBody: i18next.t('safetyCheckIn.tracking.serviceBody'),
        killServiceOnDestroy: false,
      },
    });
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: 'safetyCheckIn', action: 'startTracking' } });
  }
}

async function stopNow(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(SAFETY_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(SAFETY_LOCATION_TASK);
    }
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: 'safetyCheckIn', action: 'stopTracking' } });
  }
}

/** At launch: keeps tracking in step with the check-ins on the phone. */
export async function syncTracking(): Promise<void> {
  await when(safetySyncState.isPersistLoaded);
  await (hasTrackingCheckIn(safetyStore.peek()) ? startTracking() : stopTracking());
}

export class LocatorError extends Error {
  constructor(readonly reason: 'denied' | 'unavailable') {
    super(reason === 'denied' ? 'Location permission denied' : 'No location fix');
    this.name = 'LocatorError';
  }
}

const FIX_TIMEOUT_MS = 30_000;

/**
 * One accurate fix for a manual check-in, with a place name when the phone can look one up (it
 * can't offline; the coordinates are what matter).
 */
export async function currentFix(): Promise<SafetyLocationFix> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new LocatorError('denied');
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS));
  const location =
    (await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null),
      timeout,
    ])) ??
    (await Location.getLastKnownPositionAsync({
      maxAge: 5 * 60_000,
      requiredAccuracy: MAX_ACCURACY_METERS,
    }));
  if (!location) throw new LocatorError('unavailable');
  const fix = toFix(location);
  try {
    const [place] = await Location.reverseGeocodeAsync(location.coords);
    fix.placeName = place?.name ?? place?.district ?? place?.city ?? null;
  } catch {
    // Offline: the coordinates are enough.
  }
  return fix;
}
