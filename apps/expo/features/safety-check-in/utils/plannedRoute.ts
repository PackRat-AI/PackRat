import type { TripPlannedRoute } from '@packrat/schemas/trips';
import {
  GpxParseError,
  parseGpx,
  trackDistance,
} from 'expo-app/features/trip-stats/utils/trackGeometry';

/** Long recordings are thinned so the route stays small enough to sync. */
export const MAX_ROUTE_POINTS = 5_000;

/** Keeps evenly spaced points, always the first and last, so the shape survives. */
export function thinRoute<T>(points: readonly T[], limit = MAX_ROUTE_POINTS): T[] {
  if (points.length <= limit || limit < 2) return [...points];
  const stride = (points.length - 1) / (limit - 1);
  return Array.from({ length: limit }, (_, i) => points[Math.round(i * stride)]).filter(
    (point): point is T => point !== undefined,
  );
}

/** A GPX file's track (or route) as a trip's planned route. Throws `GpxParseError`. */
export function plannedRouteFromGpx(xml: string): TripPlannedRoute {
  const points = parseGpx(xml).map(({ latitude, longitude }) => ({ latitude, longitude }));
  // A single point is a place, not a route to stray from.
  if (points.length < 2) throw new GpxParseError('noPoints');
  return thinRoute(points, MAX_ROUTE_POINTS);
}

/** Total length in metres, for the summary under the route. */
export function plannedRouteLength(route: TripPlannedRoute): number {
  return trackDistance(route.map((point) => ({ ...point, elevation: null })));
}
