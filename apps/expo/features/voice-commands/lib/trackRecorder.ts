import { observable, syncState, when } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import * as Sentry from '@sentry/react-native';
import { hasLocationPermission } from 'expo-app/features/safety-check-in/lib/locationTracking';
import { persistPlugin } from 'expo-app/lib/persist-plugin';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import i18next from 'i18next';
import {
  appendSamples,
  newTrack,
  pauseTrack,
  type RecordedTrack,
  resumeTrack,
  type TrackSample,
} from '../utils/recordedTrack';

/**
 * Records the user's path with continuous GPS while a trip is underway, including with the screen
 * off and the phone in a pocket. Unlike the safety check-in's sparse positions, this keeps the GPS
 * on, so it only runs between start and stop. Android keeps it going through a foreground service,
 * which shows a notification while recording, and needs only while-in-use location because the
 * service is started from the open app.
 */
export const TRACK_LOCATION_TASK = 'world.packrat.voice-track';

/** Fixes less accurate than this wander under trees enough to add distance that was never walked. */
export const WORST_ACCURACY_METERS = 50;
/** Altitude this uncertain isn't counted toward climbing. */
const WORST_ALTITUDE_ACCURACY_METERS = 30;

/** The recording in progress, saved on the phone so a relaunch carries on with it. */
export const trackStore = observable<{ track: RecordedTrack | null }>({ track: null });

syncObservable(trackStore, {
  persist: { plugin: persistPlugin, name: 'voiceTrack' },
});

const trackSyncState = syncState(trackStore);

/** Resolves once a recording saved before PackRat closed is back in the store. */
export function whenTrackLoaded(): Promise<unknown> {
  return when(trackSyncState.isPersistLoaded);
}

function toSample(location: Location.LocationObject): TrackSample {
  const verticalAccuracy = location.coords.altitudeAccuracy;
  const usableAltitude =
    location.coords.altitude != null &&
    verticalAccuracy != null &&
    verticalAccuracy >= 0 &&
    verticalAccuracy <= WORST_ALTITUDE_ACCURACY_METERS;
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    altitude: usableAltitude ? location.coords.altitude : null,
    time: location.timestamp,
  };
}

// Defined at module scope so a headless relaunch finds the task before any UI mounts.
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  TRACK_LOCATION_TASK,
  async ({ data, error }) => {
    if (error || !data) return; // No fix for a while just leaves a gap.
    try {
      await when(trackSyncState.isPersistLoaded);
      const track = trackStore.track.peek();
      if (!track) return;
      const samples = data.locations
        .filter((l) => l.coords.accuracy != null && l.coords.accuracy <= WORST_ACCURACY_METERS)
        .map(toSample);
      trackStore.track.set(appendSamples({ track, samples }));
    } catch (taskError) {
      Sentry.captureException(taskError, {
        tags: { feature: 'voiceCommands', action: 'recordTrack' },
      });
    }
  },
);

export class TrackStartError extends Error {
  /** `unavailable`: Android refused the location service, e.g. started with the app in the background. */
  constructor(readonly reason: 'denied' | 'unavailable') {
    super(reason === 'denied' ? 'Location permission denied' : 'Location updates did not start');
    this.name = 'TrackStartError';
  }
}

export async function startRecording({
  tripId,
  tripName,
}: {
  tripId: string;
  tripName: string;
}): Promise<void> {
  await when(trackSyncState.isPersistLoaded);
  if (trackStore.track.peek()) return;
  if (!(await hasLocationPermission())) throw new TrackStartError('denied');
  trackStore.track.set(newTrack({ tripId, tripName }));
  breadcrumb({ message: 'Tracking started', tripId });
  await askToShowNotification();
  try {
    await startUpdates();
  } catch {
    trackStore.track.set(null);
    throw new TrackStartError('unavailable');
  }
}

export async function pauseRecording(): Promise<void> {
  const track = trackStore.track.peek();
  if (!track || track.isPaused) return;
  trackStore.track.set(pauseTrack(track));
  await stopUpdates();
}

export async function resumeRecording(): Promise<void> {
  const track = trackStore.track.peek();
  if (!track?.isPaused) return;
  trackStore.track.set(resumeTrack(track));
  try {
    await startUpdates();
  } catch {
    trackStore.track.set(track);
    throw new TrackStartError('unavailable');
  }
}

/** Ends the recording and hands it back for the trip log. */
export async function stopRecording(): Promise<RecordedTrack | null> {
  const finished = trackStore.track.peek();
  if (!finished) return null;
  trackStore.track.set(null);
  await stopUpdates();
  breadcrumb({ message: 'Tracking stopped', tripId: finished.tripId });
  return finished;
}

/** Set while signed out or with voice commands off: no location is collected, nothing resumes. */
let suspended = false;

/**
 * Signed out, or voice commands switched off: stops collecting location but keeps the recording,
 * so it carries on when they're back.
 */
export async function suspendRecording(): Promise<void> {
  suspended = true;
  await stopUpdates();
}

/** At launch: carries on a recording PackRat was closed in the middle of. */
export async function resumeRecordingIfNeeded(): Promise<void> {
  suspended = false;
  await when(trackSyncState.isPersistLoaded);
  // Suspended again while the recording loaded.
  if (suspended) return;
  const track = trackStore.track.peek();
  // A failure is already reported, and this runs again at the next launch.
  if (track && !track.isPaused) await startUpdates().catch(() => undefined);
  else await stopUpdates();
}

/**
 * Android 13 hides a foreground service's notification until notifications are allowed. Recording
 * runs either way, but the notification is how the user sees it's on and stops it from the shade.
 */
export async function askToShowNotification(): Promise<void> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (!current.granted && current.canAskAgain) await Notifications.requestPermissionsAsync();
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'voiceCommands', action: 'notificationPermission' },
    });
  }
}

async function startUpdates(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TRACK_LOCATION_TASK)) return;
    await Location.startLocationUpdatesAsync(TRACK_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 5,
      timeInterval: 3_000,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Fitness,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: i18next.t('voiceCommands.tracking.serviceTitle'),
        notificationBody: i18next.t('voiceCommands.tracking.serviceBody'),
        killServiceOnDestroy: false,
      },
    });
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: 'voiceCommands', action: 'startTrack' } });
    throw error;
  }
}

async function stopUpdates(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TRACK_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(TRACK_LOCATION_TASK);
    }
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: 'voiceCommands', action: 'stopTrack' } });
  }
}

function breadcrumb({ message, tripId }: { message: string; tripId: string }) {
  Sentry.addBreadcrumb({ category: 'voiceCommands', message, level: 'info', data: { tripId } });
}
