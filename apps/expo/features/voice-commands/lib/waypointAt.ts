import { format } from 'date-fns';
import { nanoid } from 'nanoid';
import { namedWaypoint, type TripWaypoint } from '../utils/tripWaypoints';

/** A waypoint where the user is now, named by the time on the phone's clock unless they named it. */
export function waypointAt({
  fix,
  name = null,
  note = null,
  at = new Date(),
}: {
  fix: { latitude: number; longitude: number; altitude?: number | null };
  name?: string | null;
  note?: string | null;
  at?: Date;
}): TripWaypoint {
  return namedWaypoint({
    id: nanoid(24),
    name,
    note,
    latitude: fix.latitude,
    longitude: fix.longitude,
    elevation: fix.altitude ?? null,
    at,
    timeLabel: format(at, 'p'),
  });
}
