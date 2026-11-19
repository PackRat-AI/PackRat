import type { TripLog } from '@packrat/schemas/trips';
import { tripsStore } from 'expo-app/features/trips/store/trips';
import { obs } from 'expo-app/lib/store';
import { applyTrackToLog, type RecordedTrack, trackLogRoute } from '../utils/recordedTrack';
import { addWaypointToLog, removeWaypointFromLog, type TripWaypoint } from '../utils/tripWaypoints';

/**
 * Waypoints and recorded tracks land in the trip's log, so they sync like any other log edit and
 * work with no signal.
 */
function updateLog({
  tripId,
  change,
}: {
  tripId: string;
  change: (log: TripLog) => TripLog | null;
}): boolean {
  const trip = obs({ store: tripsStore, id: tripId });
  const current = trip.peek();
  if (!current) return false;
  const log = change(current.log ?? { activities: [] });
  if (!log) return false;
  trip.set({ ...current, log, localUpdatedAt: new Date().toISOString() });
  return true;
}

/** False when the trip already has as many waypoints as it can sync. */
export function addWaypoint({ tripId, waypoint }: { tripId: string; waypoint: TripWaypoint }) {
  return updateLog({ tripId, change: (log) => addWaypointToLog({ log, waypoint }) });
}

export function removeWaypoint({ tripId, id }: { tripId: string; id: string }) {
  updateLog({ tripId, change: (log) => removeWaypointFromLog({ log, id }) });
}

/**
 * Puts a finished recording's distance, climbing and route in the trip log. False when the trip is
 * gone, so the recording had nowhere to go; a recording too short to keep counts as saved.
 */
export function saveRecording(track: RecordedTrack): boolean {
  if (!trackLogRoute(track)) return true;
  return updateLog({ tripId: track.tripId, change: (log) => applyTrackToLog({ track, log }) });
}
