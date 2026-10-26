import type { TripTrail } from '@packrat/schemas/trips';
import { type Coordinate, decodePolyline, distanceMeters, encodePolyline } from './polyline';
import { simplify } from './trackGeometry';
import type { FinishedTrip } from './tripStats';

/** One trip a trail was walked on. */
export interface TrailWalk {
  tripId: string;
  tripName: string;
  date: Date;
}

/** A registry trail and every trip it was walked on, newest first. */
export interface WalkedTrail {
  trail: TripTrail;
  walks: TrailWalk[];
  latest: Date;
}

export interface TripTrailsRecord {
  /** Most recently walked first. */
  trails: WalkedTrail[];
  /** Each trail's length counted once, however often it was walked. */
  totalLengthMeters: number;
  walkCount: number;
}

/**
 * The registry trails named in finished trips' logs. A trail logged on three trips is one trail
 * walked three times.
 */
export function computeTripTrails(finished: readonly FinishedTrip[]): TripTrailsRecord {
  const walks = new Map<string, TrailWalk[]>();
  const named = new Map<string, TripTrail>();
  // Oldest first, so the newest log's name wins if the registry renamed a trail.
  const oldestFirst = [...finished].sort((a, b) => a.start.getTime() - b.start.getTime());
  for (const item of oldestFirst) {
    for (const trail of item.trip.log?.trails ?? []) {
      named.set(trail.id, trail);
      const list = walks.get(trail.id) ?? [];
      if (list.some((walk) => walk.tripId === item.trip.id)) continue;
      list.push({ tripId: item.trip.id, tripName: item.trip.name, date: item.start });
      walks.set(trail.id, list);
    }
  }
  const trails = [...named.values()]
    .map((trail): WalkedTrail => {
      const newestFirst = [...(walks.get(trail.id) ?? [])].sort(
        (a, b) => b.date.getTime() - a.date.getTime(),
      );
      return { trail, walks: newestFirst, latest: newestFirst.at(0)?.date ?? new Date(0) };
    })
    .sort(
      (a, b) => b.latest.getTime() - a.latest.getTime() || a.trail.name.localeCompare(b.trail.name),
    );
  return {
    trails,
    totalLengthMeters: trails.reduce((sum, item) => sum + (item.trail.lengthMeters ?? 0), 0),
    walkCount: trails.reduce((sum, item) => sum + item.walks.length, 0),
  };
}

/**
 * Joins a registry trail's parts into one line, as a trip log holds a single route. Parts are
 * chained nearest end to nearest end, flipping any that run the wrong way, so the line doesn't
 * zigzag between them. It starts from the longest part: on a trail with a short spur, that's the
 * main line.
 */
export function joinTrailParts(parts: readonly (readonly Coordinate[])[]): Coordinate[] {
  const remaining = parts.filter((part) => part.length >= 2).map((part) => [...part]);
  if (remaining.length === 0) return [];
  let longest = 0;
  remaining.forEach((part, index) => {
    if (part.length > (remaining[longest]?.length ?? 0)) longest = index;
  });
  const line = remaining.splice(longest, 1)[0] ?? [];
  while (remaining.length > 0) {
    const tail = line.at(-1);
    if (!tail) break;
    let best = { index: 0, reversed: false, distance: Number.POSITIVE_INFINITY };
    remaining.forEach((part, index) => {
      const head = part.at(0);
      const end = part.at(-1);
      if (!head || !end) return;
      const toHead = distanceMeters({ from: tail, to: head });
      const toEnd = distanceMeters({ from: tail, to: end });
      if (toHead < best.distance) best = { index, reversed: false, distance: toHead };
      if (toEnd < best.distance) best = { index, reversed: true, distance: toEnd };
    });
    const next = remaining.splice(best.index, 1)[0] ?? [];
    line.push(...(best.reversed ? next.reverse() : next));
  }
  return line;
}

/** A registry trail's encoded parts as one trip-log route, simplified like an imported track. */
export function trailRoute(lines: readonly string[]): string | null {
  const joined = joinTrailParts(lines.map(decodePolyline));
  if (joined.length < 2) return null;
  return encodePolyline(
    simplify({ points: joined.map((point) => ({ ...point, elevation: null })) }),
  );
}
