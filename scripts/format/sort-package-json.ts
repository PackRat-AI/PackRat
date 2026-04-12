#!/usr/bin/env bun
//
// sort-package-json.ts — sorts all package.json files in the monorepo using
// the `sort-package-json` library.
//
// Targets:
//   - package.json (root)
//   - apps/*/package.json
//   - packages/*/package.json
//
// Usage:
//   bun scripts/format/sort-package-json.ts           # sort in place
//   bun scripts/format/sort-package-json.ts --check   # dry-run for CI; exits 1 if any file would change
//
// Output:
//   ✓ package.json (unchanged)
//   ✓ apps/expo/package.json (sorted)
//   ✗ packages/api/package.json (out of order)
//
// Exit code:
//   0 — all files are sorted (or were sorted successfully)
//   1 — --check mode: at least one file is out of order

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import sortPackageJson from 'sort-package-json';

const ROOT = join(import.meta.dir, '..', '..');
const CHECK_MODE = process.argv.includes('--check');

// ---------------------------------------------------------------------------
// Collect package.json paths
// ---------------------------------------------------------------------------

function collectPackageJsonPaths(): string[] {
  const paths: string[] = [];

  // Root
  const rootPkg = join(ROOT, 'package.json');
  if (existsSync(rootPkg)) {
    paths.push(rootPkg);
  }

  // apps/* and packages/*
  for (const workspace of ['apps', 'packages']) {
    const workspaceDir = join(ROOT, workspace);
    if (!existsSync(workspaceDir)) continue;

    let entries: string[];
    try {
      entries = readdirSync(workspaceDir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry === 'node_modules') continue;

      const entryPath = join(workspaceDir, entry);
      let isDir = false;
      try {
        isDir = statSync(entryPath).isDirectory();
      } catch {
        continue;
      }
      if (!isDir) continue;

      const pkgPath = join(entryPath, 'package.json');
      if (existsSync(pkgPath)) {
        paths.push(pkgPath);
      }
    }
  }

  return paths;
}

// ---------------------------------------------------------------------------
// Sort a single file
// ---------------------------------------------------------------------------

function processFile(absPath: string): 'sorted' | 'unchanged' | 'error' {
  const relPath = relative(ROOT, absPath);
  let raw: string;
  try {
    raw = readFileSync(absPath, 'utf-8');
  } catch (err) {
    console.error(`  error reading ${relPath}: ${err}`);
    return 'error';
  }

  const sorted = sortPackageJson(raw);

  if (sorted === raw) {
    console.log(`✓ ${relPath} (unchanged)`);
    return 'unchanged';
  }

  if (CHECK_MODE) {
    console.log(`✗ ${relPath} (out of order)`);
    return 'sorted'; // signals "would change"
  }

  try {
    writeFileSync(absPath, sorted, 'utf-8');
  } catch (err) {
    console.error(`  error writing ${relPath}: ${err}`);
    return 'error';
  }

  console.log(`✓ ${relPath} (sorted)`);
  return 'sorted';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const paths = collectPackageJsonPaths();

if (CHECK_MODE) {
  console.log('Checking package.json ordering…\n');
} else {
  console.log('Sorting package.json files…\n');
}

let outOfOrder = 0;
let sorted = 0;
let unchanged = 0;

for (const p of paths) {
  const result = processFile(p);
  if (result === 'sorted') {
    if (CHECK_MODE) {
      outOfOrder++;
    } else {
      sorted++;
    }
  } else if (result === 'unchanged') {
    unchanged++;
  }
}

console.log('');

if (CHECK_MODE) {
  if (outOfOrder > 0) {
    console.log(`${outOfOrder} file(s) out of order. Run \`bun format:package-json\` to fix.`);
    process.exit(1);
  } else {
    console.log('All package.json files are sorted.');
    process.exit(0);
  }
} else {
  console.log(`Done. ${sorted} file(s) sorted, ${unchanged} already in order.`);
  process.exit(0);
}
