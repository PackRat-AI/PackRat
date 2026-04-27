#!/usr/bin/env bun
//
// no-raw-typeof.ts — enforces using @packrat/guards instead of raw typeof checks.
//
// Flags any code outside of @packrat/guards itself that uses
//   typeof x === 'string' | 'number' | 'boolean' | 'function' | 'object' |
//              'undefined' | 'symbol' | 'bigint'
// (or the !== counterpart). The guard package is the canonical place for
// primitive narrowing — everything else should import isString/isNumber/etc.
//
// Exit code:
//   0 — no violations
//   1 — violations found (details printed to stdout)
//
// Wired into `bun lint:strict`. Not yet in default CI while the backlog
// is worked down.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..');

const ROOTS = ['apps', 'packages'];

// Matches: typeof x === 'string' (and !== counterpart, all primitive types).
// Uses a backreference (\3) to ensure the opening and closing quotes match.
// Group 1 captures the identifier being checked.
const TYPEOF_PATTERN =
  /typeof\s+([A-Za-z_][A-Za-z0-9_.]*)\s*(===|!==)\s*(['"])(string|number|boolean|object|function|undefined|symbol|bigint)\3/;

// Globally-available identifiers used for SSR/environment availability checks.
// `typeof window !== 'undefined'` cannot be replaced with `isDefined(window)`
// because accessing an undeclared global throws a ReferenceError. These are
// intentionally exempted from the no-raw-typeof rule.
const GLOBAL_IDENTIFIERS = new Set([
  'window',
  'document',
  'globalThis',
  'Bun',
  'navigator',
  'process',
]);

const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'build']);

function isExcludedPath(relPath: string): boolean {
  return relPath === 'packages/guards' || relPath.startsWith('packages/guards/');
}

function isTargetFile(name: string): boolean {
  return /\.(ts|tsx|cts|mts)$/.test(name) && !/\.(test|spec)\.(ts|tsx|cts|mts)$/.test(name);
}

interface Violation {
  file: string;
  line: number;
  content: string;
}

function walkDir(dir: string, relPath: string, violations: Violation[]): void {
  if (isExcludedPath(relPath)) return;

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry)) continue;

    const entryFull = join(dir, entry);
    const entryRel = `${relPath}/${entry}`;

    let isDir = false;
    try {
      isDir = statSync(entryFull).isDirectory();
    } catch {
      continue;
    }

    if (isDir) {
      walkDir(entryFull, entryRel, violations);
    } else if (isTargetFile(entry)) {
      let content: string;
      try {
        content = readFileSync(entryFull, 'utf-8');
      } catch {
        continue;
      }

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        const match = TYPEOF_PATTERN.exec(line);
        if (match) {
          const identifier = match[1] ?? '';
          if (GLOBAL_IDENTIFIERS.has(identifier)) continue;
          violations.push({ file: entryRel, line: i + 1, content: line.trimEnd() });
        }
      }
    }
  }
}

const violations: Violation[] = [];

for (const root of ROOTS) {
  walkDir(join(ROOT, root), root, violations);
}

if (violations.length > 0) {
  console.log(
    `Raw typeof checks found (${violations.length}) — use @packrat/guards (isString, isNumber, isBoolean, isFunction, isObject) instead:\n`,
  );
  for (const { file, line, content } of violations) {
    console.log(`${file}:${line}:${content}`);
  }
  process.exit(1);
}

console.log('No raw typeof checks in non-test code.');
