export interface LatLon {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_METERS = 6_371_000;

/** How far from the planned route counts as "well away from it". */
export const OFF_ROUTE_THRESHOLD_METERS = 1_000;

/**
 * Positions that must all be off-route before contacts are told, so a single
 * noisy fix or a short side trip to a viewpoint doesn't send an alert.
 */
export const OFF_ROUTE_CONSECUTIVE_FIXES = 2;

const toRadians = (deg: number) => (deg * Math.PI) / 180;

/**
 * Distance in metres from a point to the nearest point of a polyline.
 *
 * Projects each segment onto a local equirectangular plane centred on the
 * point. Over the few kilometres that matter for "off route" the error is
 * well under a percent, and it avoids spherical cross-track maths per segment.
 */
export function distanceToRouteMeters(point: LatLon, route: LatLon[]): number {
  const [first, ...rest] = route;
  if (!first) return Number.POSITIVE_INFINITY;

  const cosLat = Math.cos(toRadians(point.latitude));
  const project = (p: LatLon) => ({
    x: toRadians(p.longitude - point.longitude) * cosLat * EARTH_RADIUS_METERS,
    y: toRadians(p.latitude - point.latitude) * EARTH_RADIUS_METERS,
  });

  let previous = project(first);
  let best = Math.hypot(previous.x, previous.y);

  for (const vertex of rest) {
    const current = project(vertex);
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    const lengthSquared = dx * dx + dy * dy;
    // The point is the origin, so project (0,0) onto the segment.
    const t =
      lengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, -(previous.x * dx + previous.y * dy) / lengthSquared));
    const distance = Math.hypot(previous.x + t * dx, previous.y + t * dy);
    if (distance < best) best = distance;
    previous = current;
  }

  return best;
}

/**
 * Whether the most recent positions show the user has left the route and
 * stayed away. Returns the latest distance when they have, otherwise null.
 * `recent` must be ordered oldest first.
 */
export function detectOffRoute(recent: LatLon[], route: LatLon[]): number | null {
  if (route.length < 2) return null;
  if (recent.length < OFF_ROUTE_CONSECUTIVE_FIXES) return null;

  const window = recent.slice(-OFF_ROUTE_CONSECUTIVE_FIXES);
  const distances = window.map((p) => distanceToRouteMeters(p, route));
  if (distances.every((d) => d > OFF_ROUTE_THRESHOLD_METERS)) {
    return distances[distances.length - 1] ?? null;
  }
  return null;
}
