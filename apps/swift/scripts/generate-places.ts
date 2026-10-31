#!/usr/bin/env bun

/**
 * Builds the bundled countries and states/provinces dataset behind Trip
 * Stats' "Countries & States" card, from Natural Earth's 1:10m Admin 0
 * countries and Admin 1 states/provinces (public domain). States and
 * provinces are kept for the United States, Canada and Australia, the three
 * the feature spec names.
 *
 * Offline point-in-polygon rather than reverse geocoding: CLGeocoder is
 * rate-limited per app (Apple's docs: "making too many requests in a short
 * period of time may cause some of the requests to fail"), needs a network,
 * and its answer can shift between OS releases. A bundled file gives the same
 * answer every time, offline, for every route point.
 *
 * Boundaries are simplified to ~500 m (Douglas-Peucker) and stored as encoded
 * polylines (precision 5, the encoding trip routes use). Islands smaller than
 * ~2 km across are dropped unless they are the unit's only land. A country
 * with states or provinces carries no boundary of its own: it is the union of
 * its regions, which saves storing the same coastline twice.
 *
 * Run from repo root:
 *   bun apps/swift/scripts/generate-places.ts
 *
 * Output:
 *   apps/swift/Resources/Places.json
 *   apps/expo/features/trip-stats/data/places.json
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeJsonParse, safeJsonStringify } from '@packrat/utils';

const __dir = dirname(fileURLToPath(import.meta.url));
const outputPaths = [
  resolve(__dir, '../Resources/Places.json'),
  resolve(__dir, '../../expo/features/trip-stats/data/places.json'),
];

const SOURCE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';
const COUNTRIES_FILE = 'ne_10m_admin_0_countries.geojson';
const REGIONS_FILE = 'ne_10m_admin_1_states_provinces.geojson';

/** Admin 0 codes whose states or provinces are listed. */
const REGION_COUNTRIES: Record<string, string> = { USA: 'US', CAN: 'CA', AUS: 'AU' };

/** ~500 m. */
const TOLERANCE = 0.005;
/** Rings smaller than this across (degrees, ~2 km) are dropped, unless a unit's only land. */
const MIN_RING_SPAN = 0.02;

type Ring = number[][];
type Geometry =
  | { type: 'Polygon'; coordinates: Ring[] }
  | { type: 'MultiPolygon'; coordinates: Ring[][] };
interface Feature {
  properties: Record<string, string | number | null>;
  geometry: Geometry | null;
}

async function load(file: string): Promise<Feature[]> {
  const cached = resolve(tmpdir(), file);
  if (!existsSync(cached)) {
    const response = await fetch(`${SOURCE}/${file}`);
    if (!response.ok) throw new Error(`${file}: Natural Earth returned ${response.status}`);
    writeFileSync(cached, await response.text());
  }
  return safeJsonParse<{ features: Feature[] }>(readFileSync(cached, 'utf8')).features;
}

function rings(geometry: Geometry | null): Ring[] {
  if (!geometry) return [];
  return geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat();
}

/** Distance from point p to the segment [a, b]. */
function perpendicular({ p, a, b }: { p: number[]; a: number[]; b: number[] }): number {
  const [px = 0, py = 0] = p;
  const [ax = 0, ay = 0] = a;
  const [bx = 0, by = 0] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Iterative Douglas-Peucker, keeping both ends. */
function simplify({ points, tolerance }: { points: Ring; tolerance: number }): Ring {
  if (points.length <= 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    let worst = -1;
    let worstDistance = tolerance;
    for (let i = first + 1; i < last; i++) {
      const d = perpendicular({
        p: points[i] ?? [],
        a: points[first] ?? [],
        b: points[last] ?? [],
      });
      if (d > worstDistance) {
        worst = i;
        worstDistance = d;
      }
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push([first, worst], [worst, last]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

function span(ring: Ring): number {
  const lngs = ring.map(([lng = 0]) => lng);
  const lats = ring.map(([, lat = 0]) => lat);
  return Math.max(Math.max(...lngs) - Math.min(...lngs), Math.max(...lats) - Math.min(...lats));
}

/** A closed ring needs four points; tiny rings get a finer tolerance rather than vanishing. */
function simplifyRing(ring: Ring): Ring {
  // A degree of longitude shrinks toward the poles; simplify in ground units
  // so the Arctic isn't kept at several times the detail of the tropics.
  const meanLat = ring.reduce((sum, [, lat = 0]) => sum + lat, 0) / ring.length;
  const scale = Math.max(Math.cos((meanLat * Math.PI) / 180), 0.05);
  const scaled = ring.map(([lng = 0, lat = 0]) => [lng * scale, lat]);
  for (const tolerance of [TOLERANCE, TOLERANCE / 4, 0]) {
    const kept = new Set(tolerance === 0 ? scaled : simplify({ points: scaled, tolerance }));
    const out = ring.filter((_, i) => kept.has(scaled[i] as number[]));
    if (out.length >= 4) return out;
  }
  return ring;
}

function boundary(geometry: Geometry | null): string[] {
  const all = rings(geometry).filter((ring) => ring.length >= 4);
  const largest = all.reduce<Ring | undefined>(
    (best, ring) => (!best || span(ring) > span(best) ? ring : best),
    undefined,
  );
  return all
    .filter((ring) => ring === largest || span(ring) >= MIN_RING_SPAN)
    .map((ring) => encode(simplifyRing(ring)));
}

/** Google's encoded polyline algorithm, precision 5. */
function encode(path: Ring): string {
  let output = '';
  let previousLat = 0;
  let previousLng = 0;
  const encodeValue = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    while (v >= 0x20) {
      output += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    output += String.fromCharCode(v + 63);
  };
  for (const [lng = 0, lat = 0] of path) {
    const latE5 = Math.round(lat * 1e5);
    const lngE5 = Math.round(lng * 1e5);
    encodeValue(latE5 - previousLat);
    encodeValue(lngE5 - previousLng);
    previousLat = latE5;
    previousLng = lngE5;
  }
  return output;
}

const ISO_ALPHA_2 = /^[A-Z]{2}$/;

const text = (value: string | number | null | undefined) => (value == null ? '' : String(value));

/**
 * The ISO 3166-1 alpha-2 code, which drives the flag and the localized name.
 * Natural Earth's ISO_A2_EH fills the gaps ISO_A2 leaves (France, Norway);
 * the few units with neither (Northern Cyprus, Somaliland) keep their A3 code.
 */
function countryCode(p: Feature['properties']): string {
  for (const key of ['ISO_A2_EH', 'ISO_A2']) {
    const code = text(p[key]);
    if (ISO_ALPHA_2.test(code)) return code;
  }
  return text(p.ADM0_A3);
}

/**
 * Small dependencies and leases that share their country's ISO code (Baikonur,
 * Clipperton, Coral Sea Islands) fold into that country: one code, one entry.
 */
const byCode = new Map<string, { code: string; name: string; rings: string[] }>();
for (const feature of await load(COUNTRIES_FILE)) {
  const code = countryCode(feature.properties);
  const rings = boundary(feature.geometry);
  const own = !['Dependency', 'Lease', 'Indeterminate'].includes(text(feature.properties.TYPE));
  const existing = byCode.get(code);
  if (!existing) {
    byCode.set(code, { code, name: text(feature.properties.NAME), rings });
  } else {
    existing.rings.push(...rings);
    if (own) existing.name = text(feature.properties.NAME);
  }
}
const countries = [...byCode.values()]
  .filter((country) => country.rings.length > 0)
  .sort((a, b) => a.name.localeCompare(b.name));

if (countries.length < 230) throw new Error(`Only ${countries.length} countries`);

/** Lord Howe Island ships as a second "AU-NSW"; one code, one entry. */
const regionsByCode = new Map<
  string,
  { code: string; country: string; name: string; rings: string[] }
>();
for (const feature of await load(REGIONS_FILE)) {
  const country = REGION_COUNTRIES[text(feature.properties.adm0_a3)];
  if (!country) continue;
  // Jervis Bay and Macquarie Island have no ISO code ("AU-X02~"); keep a stable one anyway.
  const code = text(feature.properties.iso_3166_2).replace('~', '');
  const rings = boundary(feature.geometry);
  const existing = regionsByCode.get(code);
  if (existing) existing.rings.push(...rings);
  else regionsByCode.set(code, { code, country, name: text(feature.properties.name), rings });
}
const regions = [...regionsByCode.values()]
  .filter((region) => region.rings.length > 0)
  .sort((a, b) => a.code.localeCompare(b.code));
for (const country of countries) {
  if (Object.values(REGION_COUNTRIES).includes(country.code)) country.rings = [];
}

const perCountry = Object.values(REGION_COUNTRIES).map((code) => [
  code,
  regions.filter((r) => r.country === code).length,
]);
// 50 states + DC; 13 provinces and territories; 6 states + 2 mainland territories (+ Jervis Bay in NE).
for (const [code, count] of perCountry) {
  if (Number(count) < 8) throw new Error(`Only ${count} regions for ${code}`);
}

for (const outputPath of outputPaths) {
  writeFileSync(outputPath, `${safeJsonStringify({ countries, regions })}\n`);
  Bun.spawnSync(['bunx', 'biome', 'format', '--write', outputPath]);
  console.log(
    `Wrote ${countries.length} countries and ${regions.length} regions (${perCountry.map((p) => p.join(' ')).join(', ')}) to ${outputPath}`,
  );
}
