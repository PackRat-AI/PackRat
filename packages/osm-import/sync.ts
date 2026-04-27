#!/usr/bin/env bun
/**
 * sync.ts — Push local OSM output tables to a managed PostgreSQL database.
 *
 * Dumps osm_ways + osm_routes from the local PostGIS instance and restores
 * them into a managed database (Supabase, Neon, RDS, etc.). Run after a
 * successful import to promote local data to production.
 *
 * Prerequisites:
 *   - pg_dump / pg_restore installed (postgresql-client)
 *   - Managed DB has the PostGIS extension enabled
 *
 * Usage (standalone):
 *   OSM_DATABASE_URL=postgresql://... MANAGED_DB_URL=postgresql://... bun run sync
 *
 * When MANAGED_DB_URL is set, `bun run import` calls this automatically.
 */

import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LOCAL_URL = process.env.OSM_DATABASE_URL ?? '';
const MANAGED_URL = process.env.MANAGED_DB_URL ?? '';

if (!LOCAL_URL) {
  console.error('Error: OSM_DATABASE_URL is not set');
  process.exit(1);
}
if (!MANAGED_URL) {
  console.error('Error: MANAGED_DB_URL is not set');
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

console.log('\nRestoring to managed DB...');
console.log('  (--clean will drop existing tables before recreating them)');

const restore = Bun.spawn(
  [
    'pg_restore',
    '--clean',
    '--if-exists', // safe against empty managed DB on first run
    '--no-owner',
    '--no-privileges',
    '-d',
    MANAGED_URL,
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

console.log('\nSync complete — managed DB is up to date.');
