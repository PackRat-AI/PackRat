#!/usr/bin/env bun
/**
 * import.ts — Import OSM trail data into the dedicated OSM PostgreSQL database.
 *
 * Prerequisites:
 *   - osm2pgsql >= 1.9 installed (flex output)
 *   - OSM_DATABASE_URL_LOCAL set in root .env (see .env.example)
 *
 * Usage:
 *   bun run import                        # downloads Utah extract
 *   bun run import [path/to/region.pbf]  # imports a specific PBF
 *
 * Set OSM_DATABASE_URL in .env to auto-sync to production after import.
 * Set IMPORT_MODE=append for incremental .osc diff imports.
 *
 * Index lifecycle:
 *   osm2pgsql --create drops and recreates the output tables, so any indexes
 *   applied beforehand are lost. This script runs a post-import step that
 *   re-applies all custom indexes (geography GiST, trigram, sport/network
 *   B-tree) with IF NOT EXISTS so it is safe to re-run on append imports too.
 *   Running `db:migrate` separately is not required.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeEnv } from '@packrat/env/node';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ─────────────────────────────────────────────────────────────────

const DB_URL = nodeEnv.OSM_DATABASE_URL_LOCAL;
if (!DB_URL) {
  console.error('Error: OSM_DATABASE_URL_LOCAL is not set — add it to your root .env');
  process.exit(1);
}

const LUA_CONFIG = join(__dirname, 'routes.lua');
const IMPORT_MODE = process.env.IMPORT_MODE ?? 'create';
// Node cache in MB. Default (800) is fine for small extracts; use 4000-8000 for
// continent-scale imports to avoid extreme disk I/O during the way-processing pass.
const CACHE_MB = process.env.OSM_CACHE_MB ?? '800';
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
console.log(`Cache:      ${CACHE_MB} MB`);
console.log('');

// ── Import ──────────────────────────────────────────────────────────────────

const modeFlags = IMPORT_MODE === 'append' ? ['--append'] : ['--create', '--drop'];

const proc = Bun.spawn(
  [
    'osm2pgsql',
    '--slim',
    `--cache=${CACHE_MB}`,
    ...modeFlags,
    '-O',
    'flex',
    '-S',
    LUA_CONFIG,
    '-d',
    DB_URL,
    pbfPath,
  ],
  { stdout: 'inherit', stderr: 'inherit' },
);

const exitCode = await proc.exited;
if (exitCode !== 0) {
  console.error(`osm2pgsql exited with code ${exitCode}`);
  process.exit(exitCode);
}

// ── Post-import migrations ───────────────────────────────────────────────────
// osm2pgsql --create drops and recreates output tables, losing any pre-existing
// indexes. Clear the migration journal so osm-db migrations re-run and restore
// the full index set. The SQL uses IF NOT EXISTS so it is safe on both first
// imports and re-imports.

console.log('\nRe-applying migrations to restore indexes...');
const journalClient = new pg.Client({ connectionString: DB_URL });
await journalClient.connect();
try {
  await journalClient.query(`DELETE FROM drizzle.__drizzle_migrations`);
} catch {
  // Journal table doesn't exist yet on a brand-new database — that's fine.
} finally {
  await journalClient.end();
}

const migrateProc = Bun.spawn(['bun', 'run', './migrate.ts'], {
  cwd: join(__dirname, '../osm-db'),
  env: { ...process.env, OSM_DATABASE_URL_LOCAL: DB_URL },
  stdout: 'inherit',
  stderr: 'inherit',
});
if ((await migrateProc.exited) !== 0) {
  console.error('Migration failed after import');
  process.exit(1);
}
console.log('Migrations applied.');

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

// ── Sync to production (optional) ───────────────────────────────────────────
// Set OSM_DATABASE_URL in .env to automatically promote the local
// output tables to the managed PostgreSQL instance after every import.

if (nodeEnv.OSM_DATABASE_URL) {
  console.log('\nOSM_DATABASE_URL detected — syncing to production...');
  const syncProc = Bun.spawn(['bun', 'run', './sync.ts'], {
    cwd: __dirname,
    env: { ...process.env },
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if ((await syncProc.exited) !== 0) {
    console.error('Sync to production failed — local import succeeded, re-run: bun run sync');
    process.exit(1);
  }
}
