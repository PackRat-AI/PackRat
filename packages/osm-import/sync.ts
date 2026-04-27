#!/usr/bin/env bun
/**
 * sync.ts — Push local OSM output tables to the managed production database.
 *
 * Dumps osm_ways + osm_routes from the local PostGIS instance (OSM_DATABASE_URL)
 * and restores them into the managed database (OSM_PRODUCTION_DATABASE_URL).
 * Run after a successful import to promote local data to production.
 *
 * Prerequisites:
 *   - pg_dump / pg_restore installed (postgresql-client)
 *   - Managed DB has the PostGIS extension enabled
 *   - Both OSM_DATABASE_URL and OSM_PRODUCTION_DATABASE_URL set in root .env
 *
 * Usage (standalone):
 *   bun run sync
 *
 * When OSM_PRODUCTION_DATABASE_URL is set, `bun run import` calls this automatically.
 */

import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nodeEnv } from '@packrat/env/node';

const LOCAL_URL = nodeEnv.OSM_DATABASE_URL;
const PRODUCTION_URL = nodeEnv.OSM_PRODUCTION_DATABASE_URL;

if (!LOCAL_URL) {
  console.error('Error: OSM_DATABASE_URL is not set — add it to your root .env');
  process.exit(1);
}
if (!PRODUCTION_URL) {
  console.error('Error: OSM_PRODUCTION_DATABASE_URL is not set — add it to your root .env');
  process.exit(1);
}

const OUTPUT_TABLES = ['osm_ways', 'osm_routes'];
const dumpPath = join(tmpdir(), `osm-sync-${Date.now()}.dump`);

// ── Dump ────────────────────────────────────────────────────────────────────

console.log(`\nDumping ${OUTPUT_TABLES.join(', ')} from local DB...`);
console.log(`  Dump file: ${dumpPath}`);

const dump = Bun.spawn(
  [
    'pg_dump',
    '--format=custom', // compressed, supports parallel restore
    '--no-owner',
    '--no-privileges',
    ...OUTPUT_TABLES.flatMap((t) => ['--table', t]),
    '--file',
    dumpPath,
    LOCAL_URL,
  ],
  { stdout: 'inherit', stderr: 'inherit' },
);

if ((await dump.exited) !== 0) {
  console.error('\npg_dump failed — local DB may still be importing.');
  process.exit(1);
}

// ── Restore ─────────────────────────────────────────────────────────────────

console.log('\nRestoring to production DB...');
console.log('  (--clean will drop existing tables before recreating them)');

const restore = Bun.spawn(
  [
    'pg_restore',
    '--clean',
    '--if-exists', // safe against empty managed DB on first run
    '--no-owner',
    '--no-privileges',
    '-d',
    PRODUCTION_URL,
    dumpPath,
  ],
  { stdout: 'inherit', stderr: 'inherit' },
);

const restoreCode = await restore.exited;

try {
  rmSync(dumpPath);
} catch {}

if (restoreCode !== 0) {
  console.error('\npg_restore failed — dump file has been cleaned up.');
  process.exit(1);
}

console.log('\nSync complete — production DB is up to date.');
