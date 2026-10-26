import { encodePolyline } from './polyline';

/** One recorded point of a GPS track. */
export interface TrackPoint {
  latitude: number;
  longitude: number;
  /** Metres above sea level, when the recorder wrote one. */
  elevation: number | null;
}

/** What a track file adds to a trip log: how far, how much climbing, and the simplified line. */
export interface TrackSummary {
  distanceMeters: number;
  /** Null when the file carries no elevations, so the log keeps a typed-in figure. */
  elevationGainMeters: number | null;
  route: string;
}

export class GpxParseError extends Error {
  constructor(readonly reason: 'unreadable' | 'noPoints') {
    super(reason === 'unreadable' ? 'Not a readable GPX file' : 'GPX file has no track points');
    this.name = 'GpxParseError';
  }
}

const GPX_ROOT_PATTERN = /<(?:[\w-]+:)?gpx\b/;
const POINT_PATTERN = /<(?:[\w-]+:)?(trkpt|rtept)\b([^>]*?)(\/>|>([\s\S]*?)<\/(?:[\w-]+:)?\1>)/g;
const ELEVATION_PATTERN = /<(?:[\w-]+:)?ele>\s*([^<]*?)\s*<\/(?:[\w-]+:)?ele>/;

const LATITUDE_PATTERN = /\blat\s*=\s*["']([^"']+)["']/;
const LONGITUDE_PATTERN = /\blon\s*=\s*["']([^"']+)["']/;

function attribute({
  attributes,
  pattern,
}: {
  attributes: string;
  pattern: RegExp;
}): number | null {
  const match = pattern.exec(attributes);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

/**
 * Reads the points out of a GPX 1.0/1.1 file. Track points (`trkpt`) win; a file holding only a
 * planned route (`rtept`) falls back to that. Namespaced elements (`gpx:trkpt`) are read too.
 */
export function parseGpx(xml: string): TrackPoint[] {
  if (!GPX_ROOT_PATTERN.test(xml)) throw new GpxParseError('unreadable');
  const trackPoints: TrackPoint[] = [];
  const routePoints: TrackPoint[] = [];
  for (const match of xml.matchAll(POINT_PATTERN)) {
    const [, element, attributes = '', , body = ''] = match;
    const latitude = attribute({ attributes, pattern: LATITUDE_PATTERN });
    const longitude = attribute({ attributes, pattern: LONGITUDE_PATTERN });
    if (latitude == null || longitude == null) continue;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
    const elevationText = ELEVATION_PATTERN.exec(body)?.[1];
    const elevation = elevationText ? Number(elevationText) : Number.NaN;
    const point = {
      latitude,
      longitude,
      elevation: Number.isFinite(elevation) ? elevation : null,
    };
    (element === 'trkpt' ? trackPoints : routePoints).push(point);
  }
  const points = trackPoints.length ? trackPoints : routePoints;
  if (points.length === 0) throw new GpxParseError('noPoints');
  return points;
}

export function summarizeTrack(points: readonly TrackPoint[]): TrackSummary | null {
  if (points.length < 2) return null;
  return {
    distanceMeters: trackDistance(points),
    elevationGainMeters: elevationGain({ points }),
    route: encodePolyline(simplify({ points })),
  };
}

function haversine({ from: a, to: b }: { from: TrackPoint; to: TrackPoint }): number {
  const radius = 6_371_008.8;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Great-circle length of the line through every point. */
export function trackDistance(points: readonly TrackPoint[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (previous && current) total += haversine({ from: previous, to: current });
  }
  return total;
}

/**
 * Total climbing. GPS elevations jitter by several metres, so summing every rise inflates the
 * figure on a flat walk. A climb only counts once it rises `threshold` above the last low point,
 * the hysteresis most fitness apps apply.
 */
export function elevationGain({
  points,
  threshold = 3,
}: {
  points: readonly TrackPoint[];
  threshold?: number;
}): number | null {
  const elevations = points.flatMap((point) => point.elevation ?? []);
  const [first, ...rest] = elevations;
  if (first === undefined || rest.length === 0) return null;
  let reference = first;
  let gain = 0;
  for (const elevation of rest) {
    if (elevation - reference >= threshold) {
      gain += elevation - reference;
      reference = elevation;
    } else if (elevation < reference) {
      reference = elevation;
    }
  }
  return gain;
}

/** Douglas–Peucker, tightened until the line fits in `maxPoints`. */
export function simplify({
  points,
  tolerance = 5,
  maxPoints = 1_500,
}: {
  points: readonly TrackPoint[];
  tolerance?: number;
  maxPoints?: number;
}): TrackPoint[] {
  if (points.length <= 2) return [...points];
  let current = tolerance;
  let result = douglasPeucker({ points, tolerance: current });
  while (result.length > maxPoints) {
    current *= 2;
    result = douglasPeucker({ points, tolerance: current });
  }
  return result;
}

function douglasPeucker({
  points,
  tolerance,
}: {
  points: readonly TrackPoint[];
  tolerance: number;
}): TrackPoint[] {
  const origin = points[0];
  if (!origin || points.length <= 2) return [...points];
  // Project to local metres once; a single track spans too little of the globe for the
  // flat-earth error to matter at these tolerances.
  const perLat = 111_320;
  const perLon = perLat * Math.cos((origin.latitude * Math.PI) / 180);
  const xy = points.map((point) => ({
    x: (point.longitude - origin.longitude) * perLon,
    y: (point.latitude - origin.latitude) * perLat,
  }));
  const keep = points.map(() => false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop() ?? [0, 0];
    if (last <= first + 1) continue;
    let maxDistance = 0;
    let index = first;
    for (let i = first + 1; i < last; i += 1) {
      const distance = perpendicularDistance({ point: xy[i], from: xy[first], to: xy[last] });
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }
    if (maxDistance > tolerance) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

type XY = { x: number; y: number };

function perpendicularDistance({
  point: p,
  from: a,
  to: b,
}: {
  point?: XY;
  from?: XY;
  to?: XY;
}): number {
  if (!p || !a || !b) return 0;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
