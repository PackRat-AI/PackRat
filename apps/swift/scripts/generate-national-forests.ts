#!/usr/bin/env bun

/**
 * Builds the bundled US National Forests dataset behind saving an offline
 * map by forest name, from the Forest Service's National Forest common-name
 * boundaries (public domain). Boundaries are the administrative extent, so
 * they take in private inholdings: fine as a download frame, never a
 * statement of what is public land. Simplified to ~600 m, like the parks.
 *
 * States come from the bundled Places.json, by which US states (and
 * territories, filed there as countries) a forest's outline touches.
 *
 * Run from repo root:
 *   bun apps/swift/scripts/generate-national-forests.ts
 *
 * Output:
 *   apps/swift/Resources/NationalForests.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeJsonStringify } from '@packrat/utils';

const __dir = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dir, '../Resources/NationalForests.json');
const placesPath = resolve(__dir, '../Resources/Places.json');

const SERVICE =
  'https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_ForestCommonNames_01/MapServer/0/query';

// Units the Forest Service manages that aren't places people go to camp or hike.
const EXCLUDED = new Set(['Savannah River Site']);
const US_PREFIX = /^US-/;
const TERRITORIES = new Set(['PR', 'VI', 'GU']);
// The service lists 148 named units; a big drop means the query broke.
const MINIMUM_COUNT = 140;

interface Feature {
  attributes: { cnid: number; commonname: string };
  geometry?: { rings: number[][][] };
}

interface Forest {
  code: string;
  name: string;
  states: string[];
  /** Outer and inner rings, each a flat [lng, lat, lng, lat, …] list. */
  rings: number[][];
}

async function query(
  params: Record<string, string>,
): Promise<{ features?: Feature[]; objectIds?: number[] }> {
  const response = await fetch(`${SERVICE}?${new URLSearchParams({ ...params, f: 'json' })}`);
  if (!response.ok) throw new Error(`Forest Service returned ${response.status}`);
  const body: { features?: Feature[]; objectIds?: number[]; error?: unknown } =
    await response.json();
  if (body.error) throw new Error(`Forest Service error: ${safeJsonStringify(body.error)}`);
  return body;
}

/** Geometry in small pages: whole forests at once overrun the service's response size. */
async function fetchFeatures(): Promise<Feature[]> {
  const { objectIds = [] } = await query({ where: '1=1', returnIdsOnly: 'true' });
  const features: Feature[] = [];
  for (let i = 0; i < objectIds.length; i += 10) {
    const page = await query({
      objectIds: objectIds.slice(i, i + 10).join(','),
      outFields: 'cnid,commonname',
      outSR: '4326',
      maxAllowableOffset: '0.006',
      geometryPrecision: '3',
    });
    features.push(...(page.features ?? []));
  }
  return features;
}

/** Google encoded polyline, precision 5, as [lat, lng] pairs. */
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    lat += next();
    lng += next();
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

interface State {
  code: string;
  rings: [number, number][][];
}

function loadStates(): State[] {
  type Row = { code: string; country?: string; rings: string[] };
  const places: { countries: Row[]; regions: Row[] } = JSON.parse(readFileSync(placesPath, 'utf8'));
  return [
    ...places.regions.filter((region) => region.country === 'US'),
    ...places.countries.filter((country) => TERRITORIES.has(country.code)),
  ].map((row) => ({ code: row.code.replace(US_PREFIX, ''), rings: row.rings.map(decodePolyline) }));
}

/** Even-odd ray casting over every ring. */
function contains(rings: [number, number][][], [lat, lng]: [number, number]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [aLat, aLng] = ring[i] ?? [0, 0];
      const [bLat, bLng] = ring[j] ?? [0, 0];
      if (
        aLat > lat !== bLat > lat &&
        lng < ((bLng - aLng) * (lat - aLat)) / (bLat - aLat) + aLng
      ) {
        inside = !inside;
      }
    }
  }
  return inside;
}

/** States holding a fair share of the outline's points, so a boundary that grazes a state line doesn't list it. */
function statesTouched(rings: number[][], states: State[]): string[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i += 2) {
      const lng = ring[i] ?? 0;
      const lat = ring[i + 1] ?? 0;
      const state = states.find((s) => contains(s.rings, [lat, lng]));
      if (!state) continue;
      total++;
      counts.set(state.code, (counts.get(state.code) ?? 0) + 1);
    }
  }
  return [...counts]
    .filter(([, count]) => count >= total * 0.05)
    .sort((a, b) => b[1] - a[1])
    .map(([code]) => code);
}

const states = loadStates();
const byName = new Map<string, Forest>();
for (const feature of await fetchFeatures()) {
  const { cnid, commonname } = feature.attributes;
  if (EXCLUDED.has(commonname)) continue;
  const rings = (feature.geometry?.rings ?? [])
    .filter((ring) => ring.length >= 4)
    .map((ring) => ring.flatMap(([lng, lat]) => [lng ?? 0, lat ?? 0]));
  const forest = byName.get(commonname) ?? {
    code: String(cnid),
    name: commonname,
    states: [],
    rings: [],
  };
  forest.rings.push(...rings);
  byName.set(commonname, forest);
}

const forests = [...byName.values()]
  .map((forest) => ({ ...forest, states: statesTouched(forest.rings, states) }))
  .sort((a, b) => a.name.localeCompare(b.name));
if (forests.length < MINIMUM_COUNT)
  throw new Error(`Expected at least ${MINIMUM_COUNT} forests, got ${forests.length}`);
const empty = forests.filter((f) => f.rings.length === 0).map((f) => f.name);
if (empty.length > 0) throw new Error(`Forests without a boundary: ${empty.join(', ')}`);

writeFileSync(outputPath, `${safeJsonStringify(forests)}\n`);
console.log(`Wrote ${forests.length} forests to ${outputPath}`);
