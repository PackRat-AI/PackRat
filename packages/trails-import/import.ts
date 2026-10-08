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
 *
 * Steps: apply schema.sql, replace `trail_segments` with the release's named
 * path segments inside the bbox (DuckDB reads Overture's S3 parquet directly
 * and writes through its postgres extension), then run reconcile.sql, which
 * carries `trails.id` forward so reports keep pointing at the same trail.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { nodeEnv } from '@packrat/env/node';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_RELEASE = '2026-09-23.1';
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
  const [west, south, east, north] = bbox;
  const classes = TRAIL_CLASSES.map((c) => `'${c}'`).join(', ');

  console.log(`Loading Overture ${release} named trail segments in ${values.bbox}...`);
  await run({
    cmd: ['duckdb'],
    stdin: `
INSTALL spatial; LOAD spatial;
INSTALL httpfs; LOAD httpfs;
INSTALL postgres; LOAD postgres;
SET s3_region = 'us-west-2';
ATTACH '${DB_URL}' AS pg (TYPE postgres);
CALL postgres_execute('pg', 'TRUNCATE trail_segments');
CALL postgres_execute('pg', 'DROP TABLE IF EXISTS trail_segments_load');
CREATE TABLE pg.trail_segments_load AS
SELECT id AS overture_id, names.primary AS name, class, subtype, ST_AsHEXWKB(geometry) AS wkb
FROM read_parquet('s3://overturemaps-us-west-2/release/${release}/theme=transportation/type=segment/*', hive_partitioning = 1)
WHERE subtype = 'road'
  AND class IN (${classes})
  AND names.primary IS NOT NULL
  AND bbox.xmin <= ${east} AND bbox.xmax >= ${west}
  AND bbox.ymin <= ${north} AND bbox.ymax >= ${south};
CALL postgres_execute('pg', 'INSERT INTO trail_segments SELECT overture_id, name, class, subtype, ST_SetSRID(ST_GeomFromWKB(decode(wkb, ''hex'')), 4326) FROM trail_segments_load ON CONFLICT DO NOTHING; DROP TABLE trail_segments_load; ANALYZE trail_segments;');
`,
  });
}

console.log(`Reconciling trails for release ${release}...`);
await psql(join(__dirname, 'reconcile.sql'));
