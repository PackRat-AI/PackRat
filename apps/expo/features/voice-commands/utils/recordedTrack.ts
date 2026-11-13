import type { TripLog } from '@packrat/schemas/trips';
import { encodePolyline } from 'expo-app/features/trip-stats/utils/polyline';
import {
  simplify,
  type TrackPoint,
  trackDistance,
} from 'expo-app/features/trip-stats/utils/trackGeometry';

/** One GPS fix on a recording. `time` is epoch milliseconds, so the track stores as plain JSON. */
export interface TrackSample {
  latitude: number;
  longitude: number;
  /** Metres above sea level, when the fix had a usable one. */
  altitude: number | null;
  time: number;
}

/**
 * A hike recorded on the phone: the path in stretches between pauses, with distance, climbing and
 * time moving kept as it grows. A pause ends a stretch, so a ride back to the trailhead between
 * pause and resume never counts as distance walked.
 */
export interface RecordedTrack {
  tripId: string;
  tripName: string;
  startedAt: number;
  stretches: TrackSample[][];
  isPaused: boolean;
  distanceMeters: number;
  elevationGainMeters: number;
  movingSeconds: number;
  /** Low point of the smoothed altitude that the next climb is measured from. */
  climbReference: number | null;
  /** The latest altitudes, averaged so GPS height noise doesn't count as climbing. */
  altitudeWindow?: number[];
}

/** Faster than this between fixes, in metres a second, counts as moving; slower is standing about. */
const MOVING_SPEED = 0.3;
/** A longer gap than this between fixes is the phone losing the sky, not the user walking. */
const LONGEST_MOVING_GAP_SECONDS = 120;
/**
 * GPS height swings 20 m standing still, so climbing counts from the average of the last few
 * fixes, and only once that average rises this far above its low point.
 */
const ALTITUDE_WINDOW = 5;
const CLIMB_THRESHOLD = 10;

export function newTrack({
  tripId,
  tripName,
  now = Date.now(),
}: {
  tripId: string;
  tripName: string;
  now?: number;
}): RecordedTrack {
  return {
    tripId,
    tripName,
    startedAt: now,
    stretches: [[]],
    isPaused: false,
    distanceMeters: 0,
    elevationGainMeters: 0,
    movingSeconds: 0,
    climbReference: null,
    altitudeWindow: [],
  };
}

function point(sample: TrackSample): TrackPoint {
  return { latitude: sample.latitude, longitude: sample.longitude, elevation: sample.altitude };
}

export function trackSamples(track: RecordedTrack): TrackSample[] {
  return track.stretches.flat();
}

export function lastSample(track: RecordedTrack): TrackSample | null {
  for (let i = track.stretches.length - 1; i >= 0; i -= 1) {
    const stretch = track.stretches[i];
    const last = stretch?.[stretch.length - 1];
    if (last) return last;
  }
  return null;
}

/** The track with these fixes added. Fixes arriving while paused, or out of order, are dropped. */
export function appendSamples({
  track,
  samples,
}: {
  track: RecordedTrack;
  samples: readonly TrackSample[];
}): RecordedTrack {
  if (track.isPaused || samples.length === 0) return track;
  const stretches = track.stretches.slice(0, -1);
  const current = [...(track.stretches[track.stretches.length - 1] ?? [])];
  let { distanceMeters, elevationGainMeters, movingSeconds, climbReference } = track;
  const altitudeWindow = [...(track.altitudeWindow ?? [])];
  for (const sample of samples) {
    const previous = current[current.length - 1];
    if (previous) {
      const seconds = (sample.time - previous.time) / 1_000;
      if (seconds < 0) continue;
      const step = trackDistance([point(previous), point(sample)]);
      distanceMeters += step;
      if (seconds > 0 && seconds <= LONGEST_MOVING_GAP_SECONDS && step / seconds >= MOVING_SPEED) {
        movingSeconds += seconds;
      }
    }
    if (sample.altitude != null) {
      altitudeWindow.push(sample.altitude);
      if (altitudeWindow.length > ALTITUDE_WINDOW) altitudeWindow.shift();
      if (altitudeWindow.length === ALTITUDE_WINDOW) {
        const altitude =
          altitudeWindow.reduce((total, height) => total + height, 0) / ALTITUDE_WINDOW;
        if (climbReference == null || altitude < climbReference) {
          climbReference = altitude;
        } else if (altitude - climbReference >= CLIMB_THRESHOLD) {
          elevationGainMeters += altitude - climbReference;
          climbReference = altitude;
        }
      }
    }
    current.push(sample);
  }
  return {
    ...track,
    stretches: [...stretches, current],
    distanceMeters,
    elevationGainMeters,
    movingSeconds,
    climbReference,
    altitudeWindow,
  };
}

export function pauseTrack(track: RecordedTrack): RecordedTrack {
  return track.isPaused ? track : { ...track, isPaused: true };
}

export function resumeTrack(track: RecordedTrack): RecordedTrack {
  if (!track.isPaused) return track;
  const last = track.stretches[track.stretches.length - 1];
  return {
    ...track,
    isPaused: false,
    stretches: last && last.length > 0 ? [...track.stretches, []] : track.stretches,
    // Climbing restarts from wherever the user is when they set off again.
    climbReference: null,
    altitudeWindow: [],
  };
}

/** The encoded line that goes into the trip log, or null when too little was recorded to draw one. */
export function trackLogRoute(track: RecordedTrack): string | null {
  const points = trackSamples(track).map(point);
  if (points.length < 2) return null;
  return encodePolyline(simplify({ points }));
}

/**
 * The trip's log with this recording's distance, climbing and route in it. Everything else the
 * user entered is kept.
 */
export function applyTrackToLog({
  track,
  log,
}: {
  track: RecordedTrack;
  log: TripLog | null | undefined;
}): TripLog {
  const base: TripLog = log ?? { activities: [] };
  const route = trackLogRoute(track);
  if (!route) return base;
  return {
    ...base,
    distanceMeters: track.distanceMeters,
    elevationGainMeters: track.elevationGainMeters,
    route,
    source: 'track',
  };
}
