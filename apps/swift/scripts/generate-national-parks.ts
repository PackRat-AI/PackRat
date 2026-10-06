#!/usr/bin/env bun

/**
 * Builds the bundled US National Parks dataset behind the Trip Stats parks
 * checklist, from the NPS Land Resources Division boundary service (public
 * domain). Boundaries are simplified to ~600 m, which is plenty to tell
 * whether a trip's location or route falls inside a park.
 *
 * Run from repo root:
 *   bun apps/swift/scripts/generate-national-parks.ts
 *
 * Output:
 *   apps/swift/Resources/NationalParks.json
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dir, '../Resources/NationalParks.json');

const SERVICE =
  'https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/NPS_Land_Resources_Division_Boundary_and_Tract_Data_Service/FeatureServer/2/query';

// New River Gorge is filed as a preserve; every other park as "National Parks".
const WHERE = "UNIT_TYPE = 'National Parks' OR UNIT_CODE = 'NERI'";
const EXPECTED_PARK_COUNT = 63;

interface Feature {
  attributes: { UNIT_CODE: string; UNIT_NAME: string; STATE: string | null };
  geometry?: { rings: number[][][] };
}

interface Park {
  code: string;
  name: string;
  states: string[];
  /** Outer and inner rings, each a flat [lng, lat, lng, lat, …] list. */
  rings: number[][];
}

async function fetchFeatures(): Promise<Feature[]> {
  const params = new URLSearchParams({
    where: WHERE,
    outFields: 'UNIT_CODE,UNIT_NAME,STATE',
    outSR: '4326',
    maxAllowableOffset: '0.006',
    geometryPrecision: '3',
    f: 'json',
  });
  const response = await fetch(`${SERVICE}?${params}`);
  if (!response.ok) throw new Error(`NPS service returned ${response.status}`);
  const body: { features?: Feature[]; error?: unknown } = await response.json();
  if (!body.features) throw new Error(`NPS service error: ${JSON.stringify(body.error)}`);
  return body.features;
}

const PARK_SUFFIX = / National Park( and Preserve)?$/;
const PARK_PREFIX = /^National Park of /;
const STATE_CODE = /^[A-Z]{2}$/;

function displayName(unitName: string): string {
  return unitName.replace(PARK_SUFFIX, '').replace(PARK_PREFIX, '');
}

function toPark(feature: Feature): Park {
  const { UNIT_CODE, UNIT_NAME, STATE } = feature.attributes;
  const rings = (feature.geometry?.rings ?? [])
    .filter((ring) => ring.length >= 4)
    .map((ring) => ring.flatMap(([lng, lat]) => [lng ?? 0, lat ?? 0]));
  return {
    code: UNIT_CODE,
    name: displayName(UNIT_NAME),
    // The service writes American Samoa as "SAMOA" and has stray trailing text on some rows.
    states: (STATE ?? '')
      .split('-')
      .map((s) => s.trim().slice(0, 2).toUpperCase())
      .map((s) => (s === 'SA' ? 'AS' : s))
      .filter((s) => STATE_CODE.test(s)),
    rings,
  };
}

const parks = (await fetchFeatures()).map(toPark).sort((a, b) => a.name.localeCompare(b.name));
const codes = new Set(parks.map((p) => p.code));
if (codes.size !== EXPECTED_PARK_COUNT) {
  throw new Error(`Expected ${EXPECTED_PARK_COUNT} parks, got ${codes.size}`);
}
const empty = parks.filter((p) => p.rings.length === 0).map((p) => p.code);
if (empty.length > 0) throw new Error(`Parks without a boundary: ${empty.join(', ')}`);

writeFileSync(outputPath, `${JSON.stringify(parks)}\n`);
console.log(`Wrote ${parks.length} parks to ${outputPath}`);
