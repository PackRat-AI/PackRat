#!/usr/bin/env bun

/**
 * Builds the bundled long-trail dataset behind Trip Stats' long-trail
 * progress, from each trail's official centerline: the PCTA's, the NPS and
 * Appalachian Trail Conservancy's, and the Forest Service's CDT primary route.
 * Lines are simplified to ~150 m and stored as encoded polylines (precision
 * 5, the same encoding trip routes use), which is plenty to tell which parts
 * of a trail a trip's route walked.
 *
 * Run from repo root:
 *   bun apps/swift/scripts/generate-long-trails.ts
 *
 * Output:
 *   apps/swift/Resources/LongTrails.json
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeJsonStringify } from '@packrat/utils';

const __dir = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dir, '../Resources/LongTrails.json');

interface Source {
  code: string;
  name: string;
  /** The length the trail's stewards publish, which the app shows as the total. */
  officialMiles: number;
  states: string[];
  layer: string;
  where: string;
}

const SOURCES: Source[] = [
  {
    code: 'PCT',
    name: 'Pacific Crest Trail',
    officialMiles: 2650,
    states: ['CA', 'OR', 'WA'],
    layer:
      'https://services5.arcgis.com/ZldHa25efPFpMmfB/arcgis/rest/services/PCTA_Centerline/FeatureServer/0',
    where: '1=1',
  },
  {
    code: 'AT',
    name: 'Appalachian Trail',
    officialMiles: 2198,
    states: ['GA', 'NC', 'TN', 'VA', 'WV', 'MD', 'PA', 'NJ', 'NY', 'CT', 'MA', 'VT', 'NH', 'ME'],
    layer:
      'https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/ANST_Centerline/FeatureServer/0',
    where: "Status = 'Official A.T. Route'",
  },
  {
    code: 'CDT',
    name: 'Continental Divide Trail',
    officialMiles: 3100,
    states: ['NM', 'CO', 'WY', 'ID', 'MT'],
    layer:
      'https://services1.arcgis.com/gGHDlz6USftL5Pau/arcgis/rest/services/ContinentalDivideNST/FeatureServer/0',
    where: "Label = 'CDT Primary Route'",
  },
];

/** ~150 m at these latitudes. */
const MAX_OFFSET_DEGREES = 0.0015;
const PAGE_SIZE = 1000;

interface Feature {
  geometry?: { paths: number[][][] };
}

async function fetchPaths(source: Source): Promise<number[][][]> {
  const paths: number[][][] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const params = new URLSearchParams({
      where: source.where,
      outFields: 'OBJECTID',
      outSR: '4326',
      maxAllowableOffset: String(MAX_OFFSET_DEGREES),
      geometryPrecision: '5',
      orderByFields: 'OBJECTID',
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE),
      f: 'json',
    });
    const response = await fetch(`${source.layer}/query?${params}`);
    if (!response.ok) throw new Error(`${source.code} service returned ${response.status}`);
    const body: { features?: Feature[]; exceededTransferLimit?: boolean; error?: unknown } =
      await response.json();
    if (!body.features) {
      throw new Error(`${source.code} service error: ${safeJsonStringify(body.error)}`);
    }
    for (const feature of body.features) paths.push(...(feature.geometry?.paths ?? []));
    if (!body.exceededTransferLimit && body.features.length < PAGE_SIZE) break;
  }
  return paths.filter((path) => path.length >= 2);
}

const key = ([lng, lat]: number[]) => `${lng?.toFixed(4)},${lat?.toFixed(4)}`;

/**
 * The AT arrives as ~3,000 short pieces. Joining pieces that share an end
 * point gives a few long lines, which encode smaller and draw faster.
 */
function joinPaths(input: number[][][]): number[][][] {
  const pending = input.map((path) => [...path]);
  const joined: number[][][] = [];
  while (pending.length > 0) {
    let chain = pending.pop() ?? [];
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = 0; i < pending.length; i++) {
        const piece = pending[i] ?? [];
        const head = chain[0] ?? [];
        const tail = chain[chain.length - 1] ?? [];
        const first = piece[0] ?? [];
        const last = piece[piece.length - 1] ?? [];
        if (key(tail) === key(first)) chain = [...chain, ...piece.slice(1)];
        else if (key(tail) === key(last)) chain = [...chain, ...piece.reverse().slice(1)];
        else if (key(head) === key(last)) chain = [...piece, ...chain.slice(1)];
        else if (key(head) === key(first)) chain = [...piece.reverse(), ...chain.slice(1)];
        else continue;
        pending.splice(i, 1);
        grew = true;
        break;
      }
    }
    joined.push(chain);
  }
  return joined.sort((a, b) => b.length - a.length);
}

/** Google's encoded polyline algorithm, precision 5. */
function encode(path: number[][]): string {
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

const trails = [];
for (const source of SOURCES) {
  const paths = joinPaths(await fetchPaths(source));
  const points = paths.reduce((sum, path) => sum + path.length, 0);
  if (points < 1000) throw new Error(`${source.code} came back with only ${points} points`);
  console.log(`${source.code}: ${paths.length} lines, ${points} points`);
  trails.push({
    code: source.code,
    name: source.name,
    officialMiles: source.officialMiles,
    states: source.states,
    lines: paths.map(encode),
  });
}

writeFileSync(outputPath, `${safeJsonStringify(trails)}\n`);
// Biome checks this file in the pre-commit hook; write it the way Biome would.
Bun.spawnSync(['bunx', 'biome', 'format', '--write', outputPath]);
console.log(`Wrote ${trails.length} trails to ${outputPath}`);
