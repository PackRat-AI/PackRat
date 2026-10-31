import { type Coordinate, decodePolyline, sampleRoute } from './polyline';
import type { StatsTrip } from './tripStats';

/**
 * Countries, and states and provinces, from the bundled `places.json` (built by
 * `apps/swift/scripts/generate-places.ts` from Natural Earth's 1:10m boundaries, simplified to
 * about 500 m). Matching is offline point-in-polygon, so a trip gets the same answer every time,
 * with no network and no geocoder quota. Ported from the Swift app's `Places.swift`.
 */

/** A row of `places.json`: rings are encoded polylines, precision 5. */
export interface PlaceRow {
  code: string;
  name: string;
  country?: string | null;
  rings: string[];
}

export interface PlacesFile {
  countries: PlaceRow[];
  regions: PlaceRow[];
}

export interface PlaceBoundary {
  /** ISO 3166-1 alpha-2 for a country ("US"), ISO 3166-2 for a region ("US-WA"). */
  code: string;
  name: string;
  /** The country a region belongs to; null for a country. */
  countryCode: string | null;
  /**
   * Outer boundaries and holes alike; the even-odd rule sorts them out. Empty for a country that
   * is the union of its regions (US, Canada, Australia).
   */
  rings: Coordinate[][];
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

/** Where a point is: always a country, and a state or province where the dataset holds them. */
export interface PlaceHit {
  country: string;
  region: string | null;
}

export interface PlaceAtlas {
  countries: PlaceBoundary[];
  regions: PlaceBoundary[];
  countriesByCode: Map<string, PlaceBoundary>;
  regionsByCode: Map<string, PlaceBoundary>;
}

/** A point this close to a coast or a simplified border still counts: a beach camp isn't at sea. */
export const COASTAL_SLACK_KM = 5;
const KM_PER_DEGREE = 111.32;
/** Routes are sampled to about this many points, plenty against 500 m boundaries. */
const ROUTE_SAMPLES = 300;
const ISO_ALPHA_2 = /^[A-Za-z]{2}$/;

export function placeBoundary({
  code,
  name,
  countryCode = null,
  rings,
}: {
  code: string;
  name: string;
  countryCode?: string | null;
  rings: Coordinate[][];
}): PlaceBoundary {
  let minLatitude = 90;
  let maxLatitude = -90;
  let minLongitude = 180;
  let maxLongitude = -180;
  for (const ring of rings) {
    for (const point of ring) {
      minLatitude = Math.min(minLatitude, point.latitude);
      maxLatitude = Math.max(maxLatitude, point.latitude);
      minLongitude = Math.min(minLongitude, point.longitude);
      maxLongitude = Math.max(maxLongitude, point.longitude);
    }
  }
  return {
    code,
    name,
    countryCode,
    rings,
    minLatitude,
    maxLatitude,
    minLongitude,
    maxLongitude,
  };
}

export function makeAtlas({
  countries,
  regions,
}: {
  countries: PlaceBoundary[];
  regions: PlaceBoundary[];
}): PlaceAtlas {
  const byCode = (boundaries: PlaceBoundary[]) => {
    const map = new Map<string, PlaceBoundary>();
    for (const boundary of boundaries)
      if (!map.has(boundary.code)) map.set(boundary.code, boundary);
    return map;
  };
  return {
    countries,
    regions,
    countriesByCode: byCode(countries),
    regionsByCode: byCode(regions),
  };
}

export function atlasFromFile(file: PlacesFile): PlaceAtlas {
  const boundary = (row: PlaceRow) =>
    placeBoundary({
      code: row.code,
      name: row.name,
      countryCode: row.country ?? null,
      rings: row.rings.map(decodePolyline),
    });
  return makeAtlas({
    countries: file.countries.map(boundary),
    regions: file.regions.map(boundary),
  });
}

function boxContains({
  boundary,
  point,
  margin = 0,
}: {
  boundary: PlaceBoundary;
  point: Coordinate;
  margin?: number;
}): boolean {
  return (
    point.latitude >= boundary.minLatitude - margin &&
    point.latitude <= boundary.maxLatitude + margin &&
    point.longitude >= boundary.minLongitude - margin &&
    point.longitude <= boundary.maxLongitude + margin
  );
}

/** Even-odd ray casting over every ring, after a bounding-box check. */
export function boundaryContains({
  boundary,
  point,
}: {
  boundary: PlaceBoundary;
  point: Coordinate;
}): boolean {
  if (!boxContains({ boundary, point })) return false;
  let inside = false;
  for (const ring of boundary.rings) {
    if (ring.length < 3) continue;
    let j = ring.length - 1;
    for (let i = 0; i < ring.length; i += 1) {
      const a = ring[i];
      const b = ring[j];
      if (a && b && a.latitude > point.latitude !== b.latitude > point.latitude) {
        const crossing =
          ((b.longitude - a.longitude) * (point.latitude - a.latitude)) /
            (b.latitude - a.latitude) +
          a.longitude;
        if (point.longitude < crossing) inside = !inside;
      }
      j = i;
    }
  }
  return inside;
}

/**
 * Kilometres from the point to the nearest edge, on a local flat projection. Only used for points
 * that fall just off a simplified coast.
 */
export function distanceToBoundaryKm({
  boundary,
  point,
}: {
  boundary: PlaceBoundary;
  point: Coordinate;
}): number {
  const scale = Math.cos((point.latitude * Math.PI) / 180);
  const xy = (c: Coordinate): [number, number] => [
    (c.longitude - point.longitude) * scale * KM_PER_DEGREE,
    (c.latitude - point.latitude) * KM_PER_DEGREE,
  ];
  let best = Number.POSITIVE_INFINITY;
  for (const ring of boundary.rings) {
    const start = ring[0];
    if (!start || ring.length < 2) continue;
    let previous = xy(start);
    for (const coordinate of ring.slice(1)) {
      const next = xy(coordinate);
      const dx = next[0] - previous[0];
      const dy = next[1] - previous[1];
      const length = dx * dx + dy * dy;
      const t =
        length === 0
          ? 0
          : Math.max(0, Math.min(1, -(previous[0] * dx + previous[1] * dy) / length));
      best = Math.min(best, Math.hypot(previous[0] + t * dx, previous[1] + t * dy));
      previous = next;
    }
  }
  return best;
}

function hitFor(boundary: PlaceBoundary): PlaceHit {
  return boundary.countryCode
    ? { country: boundary.countryCode, region: boundary.code }
    : { country: boundary.code, region: null };
}

/**
 * The country (and region) holding the point, or the nearest within `COASTAL_SLACK_KM`; null out
 * at sea. Consecutive route points almost always share a place, so the hint is tried first.
 */
export function locatePoint({
  atlas,
  point,
  hint = null,
}: {
  atlas: PlaceAtlas;
  point: Coordinate;
  hint?: PlaceHit | null;
}): PlaceHit | null {
  if (hint) {
    const boundary = hint.region
      ? atlas.regionsByCode.get(hint.region)
      : atlas.countriesByCode.get(hint.country);
    if (boundary && boundaryContains({ boundary, point })) return hint;
  }
  const region = atlas.regions.find((boundary) => boundaryContains({ boundary, point }));
  if (region?.countryCode) return hitFor(region);
  const country = atlas.countries.find(
    (boundary) => boundary.rings.length > 0 && boundaryContains({ boundary, point }),
  );
  if (country) return hitFor(country);

  // Off a simplified coast: the nearest boundary, if it's close.
  const margin =
    COASTAL_SLACK_KM / KM_PER_DEGREE / Math.max(Math.cos((point.latitude * Math.PI) / 180), 0.1);
  let nearest: { boundary: PlaceBoundary; km: number } | null = null;
  for (const boundary of [...atlas.regions, ...atlas.countries]) {
    if (boundary.rings.length === 0 || !boxContains({ boundary, point, margin })) continue;
    const km = distanceToBoundaryKm({ boundary, point });
    if (!nearest || km < nearest.km) nearest = { boundary, km };
  }
  return nearest && nearest.km <= COASTAL_SLACK_KM ? hitFor(nearest.boundary) : null;
}

/** Stable key for a hit, for sets. */
export function hitKey(hit: PlaceHit): string {
  return `${hit.country}|${hit.region ?? ''}`;
}

/** Every place a trip's location or route touches, once each. */
export function placesVisitedBy({
  atlas,
  trip,
}: {
  atlas: PlaceAtlas;
  trip: Pick<StatsTrip, 'location' | 'log'>;
}): PlaceHit[] {
  const points: Coordinate[] = [];
  if (trip.location) points.push(trip.location);
  const encoded = trip.log?.route;
  if (encoded) {
    const route = decodePolyline(encoded);
    points.push(...sampleRoute({ route, limit: ROUTE_SAMPLES }));
    const last = route.at(-1);
    if (last) points.push(last);
  }
  const hits = new Map<string, PlaceHit>();
  let hint: PlaceHit | null = null;
  for (const point of points) {
    const hit = locatePoint({ atlas, point, hint });
    if (!hit) continue;
    hits.set(hitKey(hit), hit);
    hint = hit;
  }
  return [...hits.values()];
}

/** The flag emoji for an ISO alpha-2 code; null for the few units without one. */
export function flagEmoji(code: string): string | null {
  if (!ISO_ALPHA_2.test(code)) return null;
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 127_397 + c.charCodeAt(0)));
}

/** What a country's regions are called. */
export type RegionNoun = 'states' | 'provinces' | 'statesAndTerritories' | 'statesAndProvinces';

export function regionNoun(country: string): RegionNoun {
  if (country === 'US') return 'states';
  if (country === 'CA') return 'provinces';
  return 'statesAndTerritories';
}
