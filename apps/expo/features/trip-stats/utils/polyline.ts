export interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Google's encoded polyline format at precision 5 — what `TripLog.route` holds and what the
 * Swift app and the API's PostGIS `ST_AsEncodedPolyline(geom, 5)` both read and write. Returns an
 * empty array for a malformed string rather than a partial line.
 */
export function decodePolyline(encoded: string): Coordinate[] {
  const points: Coordinate[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  while (index < encoded.length) {
    const lat = readValue({ encoded, start: index });
    const lng = lat ? readValue({ encoded, start: lat.next }) : null;
    if (!lat || !lng) return [];
    index = lng.next;
    latitude += lat.value;
    longitude += lng.value;
    points.push({ latitude: latitude / 1e5, longitude: longitude / 1e5 });
  }
  return points;
}

function readValue({
  encoded,
  start,
}: {
  encoded: string;
  start: number;
}): { value: number; next: number } | null {
  let result = 0;
  let shift = 0;
  let index = start;
  while (index < encoded.length) {
    const byte = encoded.charCodeAt(index) - 63;
    index += 1;
    result |= (byte & 0x1f) << shift;
    shift += 5;
    if (byte < 0x20) {
      return { value: result & 1 ? ~(result >> 1) : result >> 1, next: index };
    }
  }
  return null;
}

export function encodePolyline(points: readonly Coordinate[]): string {
  let output = '';
  let previousLat = 0;
  let previousLng = 0;
  for (const point of points) {
    const lat = roundHalfAway(point.latitude * 1e5);
    const lng = roundHalfAway(point.longitude * 1e5);
    output += encodeValue(lat - previousLat) + encodeValue(lng - previousLng);
    previousLat = lat;
    previousLng = lng;
  }
  return output;
}

/** Swift's `.rounded()`: halves round away from zero, where `Math.round` rounds them up. */
function roundHalfAway(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

function encodeValue(value: number): string {
  let rest = value < 0 ? ~(value << 1) : value << 1;
  let output = '';
  while (rest >= 0x20) {
    output += String.fromCharCode((0x20 | (rest & 0x1f)) + 63);
    rest >>= 5;
  }
  return output + String.fromCharCode(rest + 63);
}

const EARTH_RADIUS_METERS = 6_371_000;

/** Great-circle distance in metres. */
export function distanceMeters({ from: a, to: b }: { from: Coordinate; to: Coordinate }): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** About `limit` evenly spaced points, so a long route is checked cheaply end to end. */
export function sampleRoute<T>({ route, limit }: { route: readonly T[]; limit: number }): T[] {
  const step = Math.max(Math.floor(route.length / limit), 1);
  const samples: T[] = [];
  for (let index = 0; index < route.length; index += step) {
    const point = route[index];
    if (point !== undefined) samples.push(point);
  }
  return samples;
}
