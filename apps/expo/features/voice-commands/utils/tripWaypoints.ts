import type { TripLog } from '@packrat/schemas/trips';

export type TripWaypoint = NonNullable<TripLog['waypoints']>[number];

/**
 * The server's limits (`TripWaypointSchema`); anything over them would stop the whole trip from
 * syncing.
 */
export const WAYPOINT_LIMITS = Object.freeze({
  perTrip: 500,
  nameLength: 200,
  noteLength: 2_000,
} as const);

/** Cut to a length the server counts in UTF-16 units, never mid-character. */
export function clipUtf16({ text, limit }: { text: string; limit: number }): string {
  if (text.length <= limit) return text;
  let result = '';
  for (const character of text) {
    if (result.length + character.length > limit) break;
    result += character;
  }
  return result;
}

/** "Waypoint 2:14 PM" when the user didn't name it. */
export function namedWaypoint({
  id,
  name,
  note,
  latitude,
  longitude,
  elevation,
  at,
  timeLabel,
}: {
  id: string;
  name: string | null;
  note?: string | null;
  latitude: number;
  longitude: number;
  elevation: number | null;
  at: Date;
  /** The time on the phone's clock, for the default name. */
  timeLabel: string;
}): TripWaypoint {
  const trimmed = name?.trim();
  return {
    id,
    name: clipUtf16({
      text: trimmed || `Waypoint ${timeLabel}`,
      limit: WAYPOINT_LIMITS.nameLength,
    }),
    note: note ? clipUtf16({ text: note, limit: WAYPOINT_LIMITS.noteLength }) : null,
    latitude,
    longitude,
    elevationMeters: elevation,
    createdAt: at.toISOString(),
  };
}

/** The log with the waypoint added, or null when the trip already has as many as it can sync. */
export function addWaypointToLog({
  log,
  waypoint,
}: {
  log: TripLog | null | undefined;
  waypoint: TripWaypoint;
}): TripLog | null {
  const base: TripLog = log ?? { activities: [] };
  const waypoints = base.waypoints ?? [];
  if (waypoints.length >= WAYPOINT_LIMITS.perTrip) return null;
  return { ...base, waypoints: [...waypoints, waypoint] };
}

export function removeWaypointFromLog({ log, id }: { log: TripLog; id: string }): TripLog {
  return { ...log, waypoints: (log.waypoints ?? []).filter((w) => w.id !== id) };
}
