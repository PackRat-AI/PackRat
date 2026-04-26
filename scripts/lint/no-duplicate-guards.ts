#!/usr/bin/env bun
//
// no-duplicate-guards.ts — flags re-implementations of guards that are already
// exported from @packrat/guards.
//
// The guards package (packages/guards/) is the single source of truth for all
// type narrowing and assertion helpers. Duplicating them in app code leads to
// subtle behavioural divergence and breaks the "use guards, not casts" policy.
//
// Flags:
//   - assertDefined / assertNonNull / assertPresent / assertIsString /
//     assertIsNumber / assertIsBoolean / assertAllDefined
//   - isString / isNumber / isBoolean / isFunction / isArray / isObject /
//     isDate / isDefined / isPresent (re-implementations, not re-exports)
//   - makeEnumGuard / makeTypeGuard / assertError / assertNever
//
// A "re-implementation" is any function declaration or arrow-function
// assignment whose name matches one of the guard names above, found outside
// packages/guards/ and packages/checks/ (the check scripts themselves).
//
// Exit code:
//   0 — no violations
//   1 — violations found
//
// Wired into check-all.ts and CI via checks.yml.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..');

const SCAN_ROOTS = ['apps', 'packages'];

// Names exported from @packrat/guards that should not be re-implemented elsewhere.
const GUARD_NAMES = new Set([
  // assertions.ts
  'assertDefined',
  'assertNonNull',
  'assertPresent',
  'assertIsString',
  'assertIsNumber',
  'assertIsBoolean',
  'assertAllDefined',
  // re-exported from ts-extras — flag if home-grown
  'assertError',
  'assertNever',
  'isDefined',
  'isPresent',
  // re-exported from radash — flag if home-grown
  'isString',
  'isNumber',
  'isBoolean',
  'isFunction',
  'isArray',
  'isObject',
  'isDate',
  'isFloat',
  'isInt',
  'isSymbol',
  'isPrimitive',
  'isPromise',
  // custom guards/parsers
  'makeEnumGuard',
  'makeTypeGuard',
]);

// Excluded source roots (the canonical definitions live here).
const EXCLUDED_PREFIXES = ['packages/guards/', 'packages/checks/'];

const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'build', '.next', '.expo', 'drizzle']);

// Matches:
//   export function assertDefined(...)
//   function assertDefined(...)
//   const assertDefined = (...)
//   export const assertDefined = (...)
//   export const assertDefined: (...) =>
const IMPL_PATTERN =
  /(?:export\s+)?(?:function\s+|const\s+|let\s+)([A-Za-z][A-Za-z0-9_]*)\s*(?:[=(:<])/g;

interface Violation {
  file: string;
  line: number;
  name: string;
  source: string;
}

function isTargetFile(name: string): boolean {
  return (
    /\.(ts|tsx|cts|mts)$/.test(name) && !/\.(test|spec|stories|d)\.(ts|tsx|cts|mts)$/.test(name)
  );
}

function isExcluded(relPath: string): boolean {
  return EXCLUDED_PREFIXES.some((p) => relPath.startsWith(p));
}

function walkDir(dir: string, relPath: string, violations: Violation[]): void {
  if (isExcluded(relPath)) return;

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry)) continue;

    const fullPath = join(dir, entry);
    const entryRel = `${relPath}/${entry}`;

    let isDir = false;
    try {
      isDir = statSync(fullPath).isDirectory();
    } catch {
      continue;
    }

    if (isDir) {
      walkDir(fullPath, entryRel, violations);
    } else if (isTargetFile(entry)) {
      let content: string;
      try {
        content = readFileSync(fullPath, 'utf8');
      } catch {
        continue;
      }

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        const trimmed = line.trimStart();

        // Skip comment lines and import/export-from lines
        if (
          trimmed.startsWith('//') ||
          trimmed.startsWith('*') ||
          trimmed.startsWith('/*') ||
          /^\s*export\s*\{/.test(line) ||
          /^\s*(import|export)\s+.*\s+from\s+['"]/.test(line)
        ) {
          continue;
        }

        IMPL_PATTERN.lastIndex = 0;
        for (let m = IMPL_PATTERN.exec(line); m !== null; m = IMPL_PATTERN.exec(line)) {
          const name = m[1];
          if (name && GUARD_NAMES.has(name)) {
            violations.push({ file: entryRel, line: i + 1, name, source: line.trimEnd() });
          }
        }
      }
    }
  }
}

const violations: Violation[] = [];
for (const root of SCAN_ROOTS) {
  walkDir(join(ROOT, root), root, violations);
}

if (violations.length === 0) {
  console.log('No duplicate guard implementations found.');
  process.exit(0);
}

console.log(
  `Found ${violations.length} guard re-implementation(s) outside @packrat/guards — import from '@packrat/guards' instead:\n`,
);

let lastFile = '';
for (const v of violations) {
  if (v.file !== lastFile) {
    console.log(`  ${v.file}`);
    lastFile = v.file;
  }
  console.log(`    line ${v.line}: ${v.name}`);
  console.log(`      ${v.source}`);
}

console.log("\nFix: remove the local copy and import from '@packrat/guards'.");
process.exit(1);
