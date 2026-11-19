export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/**
 * Where the user stands against a planned route: how far along it, how far is left, and how far
 * off it they are.
 */
export interface RouteProgress {
  /** Metres from the user to the nearest point on the route. */
  offRouteMeters: number;
  /** Metres along the route to that nearest point. */
  alongMeters: number;
  /** Metres left from that point to the end of the route. */
  remainingMeters: number;
  /** Compass bearing (0 = north) from the user to the nearest point on the route. */
  bearingToRoute: number;
}

/**
 * Further than this from the line counts as off route. GPS on a phone under trees drifts 20–30 m,
 * so anything tighter cries wolf.
 */
export const OFF_ROUTE_THRESHOLD_METERS = 75;

export function isOnRoute(progress: Pick<RouteProgress, 'offRouteMeters'>): boolean {
  return progress.offRouteMeters <= OFF_ROUTE_THRESHOLD_METERS;
}

/**
 * Works on a local flat projection around each segment, which is accurate to well under a metre
 * over the few hundred metres between route points. Null for a route under two points.
 */
export function routeProgress({
  position,
  route,
}: {
  position: GeoPoint;
  route: readonly GeoPoint[];
}): RouteProgress | null {
  if (route.length < 2) return null;
  let best: { distance: number; along: number; point: GeoPoint } | null = null;
  let travelled = 0;
  for (let index = 1; index < route.length; index++) {
    const a = route[index - 1] as GeoPoint;
    const b = route[index] as GeoPoint;
    const length = geoDistance({ from: a, to: b });
    const { t, point } = projectOntoSegment({ p: position, a, b });
    const distance = geoDistance({ from: position, to: point });
    if (!best || distance < best.distance)
      best = { distance, along: travelled + t * length, point };
    travelled += length;
  }
  if (!best) return null;
  return {
    offRouteMeters: best.distance,
    alongMeters: best.along,
    remainingMeters: Math.max(0, travelled - best.along),
    bearingToRoute: geoBearing({ from: position, to: best.point }),
  };
}

const EARTH_RADIUS_METERS = 6_371_000;
const RAD = Math.PI / 180;

export function geoDistance({ from: a, to: b }: { from: GeoPoint; to: GeoPoint }): number {
  const dLat = (b.latitude - a.latitude) * RAD;
  const dLon = (b.longitude - a.longitude) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * RAD) * Math.cos(b.latitude * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing in degrees, 0 = north, clockwise. */
export function geoBearing({ from: a, to: b }: { from: GeoPoint; to: GeoPoint }): number {
  const lat1 = a.latitude * RAD;
  const lat2 = b.latitude * RAD;
  const dLon = (b.longitude - a.longitude) * RAD;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** The closest point to `p` on the segment a→b, and how far along it (0…1). */
function projectOntoSegment({ p, a, b }: { p: GeoPoint; a: GeoPoint; b: GeoPoint }): {
  t: number;
  point: GeoPoint;
} {
  const scale = Math.cos(a.latitude * RAD);
  const dx = (b.longitude - a.longitude) * scale;
  const dy = b.latitude - a.latitude;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return { t: 0, point: a };
  const px = (p.longitude - a.longitude) * scale;
  const py = p.latitude - a.latitude;
  const t = Math.min(1, Math.max(0, (px * dx + py * dy) / lengthSquared));
  return {
    t,
    point: {
      latitude: a.latitude + t * (b.latitude - a.latitude),
      longitude: a.longitude + t * (b.longitude - a.longitude),
    },
  };
}

const COMPASS_NAMES = Object.freeze([
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
] as const);

/** "north", "north-east"… for a bearing in degrees. */
export function compassName(bearing: number): string {
  const index = Math.floor((((bearing % 360) + 360 + 22.5) % 360) / 45) % 8;
  return COMPASS_NAMES[index] ?? 'north';
}
