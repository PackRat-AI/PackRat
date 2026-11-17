import type { TripTrail } from '@packrat/schemas/trips';
import type { Coordinate } from './polyline';
import { trackDistance } from './trackGeometry';

/** Pure geometry behind drawing a route by hand and the trail distances offered under Distance. */

/** Metres along the drawn line. */
export function drawnDistance(points: readonly Coordinate[]): number {
  return trackDistance(points.map((point) => ({ ...point, elevation: null })));
}

/** The line walked out and then back the same way. */
export function outAndBack(points: readonly Coordinate[]): Coordinate[] {
  if (points.length < 2) return [...points];
  return [...points, ...points.slice(0, -1).reverse()];
}

/** The trails' combined length; trails without a length add nothing. */
export function totalTrailLength(trails: readonly Pick<TripTrail, 'lengthMeters'>[]): number {
  return trails.reduce((sum, trail) => sum + (trail.lengthMeters ?? 0), 0);
}

export type TrailDistanceKind = 'oneWay' | 'thereAndBack';

/** The trails' length walked one way and there and back, offered under Distance. */
export function trailDistances(length: number): { kind: TrailDistanceKind; metres: number }[] {
  return [
    { kind: 'oneWay', metres: length },
    { kind: 'thereAndBack', metres: length * 2 },
  ];
}
