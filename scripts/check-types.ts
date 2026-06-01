#!/usr/bin/env bun
//
// check-types.ts — whole-repo type check.
//
// Defaults to `tsc` (the source of truth). Pass `--tsgo` to run the check with
// the native-preview Go compiler (`tsgo`), which is dramatically faster and
// lighter — useful on machines that struggle to run the full `tsc` pass.
//
// Any extra args are forwarded to the underlying compiler, e.g.
//   bun scripts/check-types.ts --tsgo --pretty
//
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const useTsgo = argv.includes('--tsgo');
const forwarded = argv.filter((arg) => arg !== '--tsgo');

const bin = useTsgo ? 'tsgo' : 'tsc';
const label = useTsgo ? 'tsgo (native-preview)' : 'tsc';
console.log(`▸ check-types via ${label}`);

const { status, error } = spawnSync(bin, ['--noEmit', ...forwarded], {
  stdio: 'inherit',
  // `bun run` puts node_modules/.bin on PATH; resolve from there.
  env: process.env,
});

if (error) {
  console.error(`Failed to spawn ${bin}: ${error.message}`);
  process.exit(1);
}

process.exit(status ?? 1);
