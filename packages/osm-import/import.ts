#!/usr/bin/env bun
/**
 * import.ts — Import OSM trail data into the dedicated OSM PostgreSQL database.
 *
 * Prerequisites:
 *   - osm2pgsql >= 1.9 installed (flex output)
 *   - OSM_DATABASE_URL set (postgresql://...)
 *   - packages/osm-db migrations already applied:
 *       OSM_DATABASE_URL=... bun run --cwd packages/osm-db db:migrate
 *
 * Usage:
 *   bun run import                          # downloads Utah extract
 *   bun run import [path/to/region.pbf]    # imports a specific PBF
 *   IMPORT_MODE=append bun run import [...] # append mode for subsequent regions
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ─────────────────────────────────────────────────────────────────

const DB_URL = process.env.OSM_DATABASE_URL ?? '';
if (!DB_URL) {
  console.error('Error: OSM_DATABASE_URL is not set');
  console.error('Run: OSM_DATABASE_URL=... bun run --cwd packages/osm-db db:migrate');
  process.exit(1);
}

const LUA_CONFIG = join(__dirname, 'routes.lua');
const IMPORT_MODE = process.env.IMPORT_MODE ?? 'create';
const UTAH_PBF_URL = 'https://download.geofabrik.de/north-america/us/utah-latest.osm.pbf';

// ── PBF file ────────────────────────────────────────────────────────────────

let pbfPath = process.argv[2];

if (!pbfPath) {
  pbfPath = join(__dirname, 'utah-latest.osm.pbf');
  if (!existsSync(pbfPath)) {
    console.log('Downloading Utah extract from Geofabrik (~150 MB)...');
    const res = await fetch(UTAH_PBF_URL);
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    await Bun.write(pbfPath, res);
    console.log(`Saved to ${pbfPath}`);
  }
} else if (!existsSync(pbfPath)) {
  console.error(`Error: file not found: ${pbfPath}`);
  process.exit(1);
}

console.log(`PBF file:   ${pbfPath}`);
console.log(`Lua config: ${LUA_CONFIG}`);
console.log(`Mode:       ${IMPORT_MODE}`);
console.log('');

// ── Import ──────────────────────────────────────────────────────────────────

const modeFlags = IMPORT_MODE === 'append' ? ['--append'] : ['--create', '--drop'];

const proc = Bun.spawn(
  ['osm2pgsql', '--slim', ...modeFlags, '-O', 'flex', '-S', LUA_CONFIG, '-d', DB_URL, pbfPath],
  { stdout: 'inherit', stderr: 'inherit' },
);

const exitCode = await proc.exited;
if (exitCode !== 0) {
  console.error(`osm2pgsql exited with code ${exitCode}`);
  process.exit(exitCode);
}

// ── Verify ──────────────────────────────────────────────────────────────────

console.log('\nRow counts:');
const client = new pg.Client({ connectionString: DB_URL });
await client.connect();

try {
  const ways = await client.query(
    `SELECT sport, count(*)::int AS n FROM osm_ways GROUP BY sport ORDER BY sport`,
  );
  const routes = await client.query(
    `SELECT sport, count(*)::int AS n FROM osm_routes GROUP BY sport ORDER BY sport`,
  );

  console.log('\nosm_ways:');
  console.table(ways.rows);
  console.log('\nosm_routes:');
  console.table(routes.rows);
} finally {
  await client.end();
}

console.log('\nImport complete.');
