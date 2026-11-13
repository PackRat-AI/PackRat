import { observable, syncState, when } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import * as Sentry from '@sentry/react-native';
import { persistPlugin } from 'expo-app/lib/persist-plugin';
import * as Location from 'expo-location';
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
  constructor() {
    super('Location permission denied');
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
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new TrackStartError();
  trackStore.track.set(newTrack({ tripId, tripName }));
  breadcrumb({ message: 'Tracking started', tripId });
  await startUpdates();
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
  await startUpdates();
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

/** At launch: carries on a recording PackRat was closed in the middle of. */
export async function resumeRecordingIfNeeded(): Promise<void> {
  await when(trackSyncState.isPersistLoaded);
  const track = trackStore.track.peek();
  if (track && !track.isPaused) await startUpdates();
  else await stopUpdates();
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
