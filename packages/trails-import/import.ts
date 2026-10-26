#!/usr/bin/env bun
/**
 * import.ts — Load named trails from Overture Maps into the trail database.
 *
 * Prerequisites:
 *   - duckdb and psql on PATH
 *   - OSM_DATABASE_URL set in the main checkout's .env.local (PostGIS + pg_trgm).
 *     Bun only reads .env from the cwd, so pass it explicitly from a worktree:
 *     bun --env-file="$(git rev-parse --git-common-dir)/../.env.local" import.ts ...
 *
 * Usage:
 *   bun run import --bbox=-124.48,32.53,-114.13,42.01      # California
 *   bun run import --bbox=... --release=2026-09-23.1
 *   bun run import --reconcile-only --release=2026-09-23.1 # segments already loaded
 *   bun run import --bbox=... --from-band=12                # resume a stopped run
 *
 * Steps: apply schema.sql, replace `trail_segments` with the release's named
 * path segments inside the bbox (DuckDB reads Overture's S3 parquet and writes
 * through its postgres extension, one longitude band at a time), then run
 * reconcile.sql, which carries `trails.id` forward so reports keep pointing at
 * the same trail.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { nodeEnv } from '@packrat/env/node';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_RELEASE = '2026-09-23.1';
const BAND_DEGREES = 10;
// A band retries for about an hour, so a dropped connection or a short
// internet outage pauses the run instead of ending it.
const BAND_ATTEMPTS = 12;
const BAND_RETRY_MS = 5 * 60 * 1000;
const TRAIL_CLASSES = ['path', 'footway', 'steps', 'track', 'bridleway', 'cycleway'];

const DB_URL = nodeEnv.OSM_DATABASE_URL;
if (!DB_URL) {
  console.error('Error: OSM_DATABASE_URL is not set — add it to the main checkout .env.local');
  process.exit(1);
}

const { values } = parseArgs({
  options: {
    bbox: { type: 'string' },
    release: { type: 'string', default: DEFAULT_RELEASE },
    'reconcile-only': { type: 'boolean', default: false },
    'from-band': { type: 'string', default: '1' },
  },
});

const release = values.release ?? DEFAULT_RELEASE;
if (!/^\d{4}-\d{2}-\d{2}\.\d+$/.test(release)) {
  console.error(`Error: release must look like ${DEFAULT_RELEASE}`);
  process.exit(1);
}

async function run({ cmd, stdin }: { cmd: string[]; stdin?: string }): Promise<void> {
  const proc = Bun.spawn(cmd, {
    stdin: stdin === undefined ? 'inherit' : new TextEncoder().encode(stdin),
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const code = await proc.exited;
  if (code !== 0) throw new Error(`${cmd.at(0)} exited with ${code}`);
}

const psql = (file: string) =>
  run({ cmd: ['psql', DB_URL, '-v', 'ON_ERROR_STOP=1', '-v', `release=${release}`, '-f', file] });

console.log('Applying schema...');
await psql(join(__dirname, 'schema.sql'));

if (!values['reconcile-only']) {
  const bbox = values.bbox?.split(',').map(Number);
  if (!bbox || bbox.length !== 4 || bbox.some((n) => !Number.isFinite(n))) {
    console.error('Error: --bbox=west,south,east,north is required');
    process.exit(1);
  }
  const [west, south, east, north] = bbox as [number, number, number, number];
  const classes = TRAIL_CLASSES.map((c) => `'${c}'`).join(', ');

  // DuckDB's postgres extension (libpq without SCRAM channel binding) refuses
  // Neon's `channel_binding=require`; TLS is still enforced by `sslmode`.
  const duckdbUrl = new URL(DB_URL);
  duckdbUrl.searchParams.delete('channel_binding');

  // Load in longitude bands straight from S3, no local copy, so a full disk on
  // this machine can't fail the run. Each band is read into memory before
  // connecting: a dense band downloads for up to an hour, and Neon drops a
  // connection held open that long. Overture's files are spatially sorted, so
  // a band reads only its own row groups. A segment crossing a band edge lands
  // once (ON CONFLICT DO NOTHING).
  // --from-band resumes a stopped run: earlier bands are already loaded, so
  // keep them (re-loading the partial band is safe, inserts skip duplicates).
  const fromBand = Number(values['from-band']);
  if (fromBand === 1) await run({ cmd: ['psql', DB_URL, '-c', 'TRUNCATE trail_segments'] });
  const bands: [number, number][] = [];
  for (let w = west; w < east; w += BAND_DEGREES) bands.push([w, Math.min(w + BAND_DEGREES, east)]);
  for (const [i, [bandWest, bandEast]] of bands.entries()) {
    if (i + 1 < fromBand) continue;
    console.log(`Loading ${release} band ${i + 1}/${bands.length} (${bandWest}..${bandEast})...`);
    const sql = `
.bail on
INSTALL spatial; LOAD spatial;
INSTALL httpfs; LOAD httpfs;
INSTALL postgres; LOAD postgres;
SET s3_region = 'us-west-2';
CREATE TABLE band AS
SELECT id AS overture_id, names.primary AS name, class, subtype, ST_AsHEXWKB(geometry) AS wkb
FROM read_parquet('s3://overturemaps-us-west-2/release/${release}/theme=transportation/type=segment/*', hive_partitioning = 1)
WHERE subtype = 'road'
  AND class IN (${classes})
  AND names.primary IS NOT NULL
  AND bbox.xmin <= ${bandEast} AND bbox.xmax >= ${bandWest}
  AND bbox.ymin <= ${north} AND bbox.ymax >= ${south};
ATTACH '${duckdbUrl}' AS pg (TYPE postgres);
CALL postgres_execute('pg', 'DROP TABLE IF EXISTS trail_segments_load');
CREATE TABLE pg.trail_segments_load AS SELECT * FROM band;
CALL postgres_execute('pg', 'INSERT INTO trail_segments SELECT overture_id, name, class, subtype, ST_SetSRID(ST_GeomFromWKB(decode(wkb, ''hex'')), 4326) FROM trail_segments_load ON CONFLICT DO NOTHING; DROP TABLE trail_segments_load;');
`;
    for (let attempt = 1; ; attempt++) {
      try {
        await run({ cmd: ['duckdb'], stdin: sql });
        break;
      } catch (error) {
        if (attempt === BAND_ATTEMPTS) throw error;
        console.log(`Band ${i + 1} failed (attempt ${attempt}), retrying in 5 min...`);
        await Bun.sleep(BAND_RETRY_MS);
      }
    }
  }
  await run({ cmd: ['psql', DB_URL, '-c', 'ANALYZE trail_segments'] });
}

console.log(`Reconciling trails for release ${release}...`);
await psql(join(__dirname, 'reconcile.sql'));
