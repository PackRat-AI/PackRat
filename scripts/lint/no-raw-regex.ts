#!/usr/bin/env bun
//
// no-raw-regex.ts — enforces using magic-regexp instead of raw regex literals
// or `new RegExp(...)` in non-test production code.
//
// The reference implementation lives in packages/analytics/src/core/enrichment.ts.
// Raw regex literals are easy to get wrong (missing escapes, unintended group
// captures, poor readability) and magic-regexp gives us a typed, composable
// builder that's easier to review.
//
// What gets flagged:
//   - `new RegExp(...)` anywhere in apps/ or packages/ (excluding tests)
//   - Any `.replace(/.../)`, `.match(/.../)`, `.test(/.../)`, `.split(/.../)`,
//     `.search(/.../)`, `.replaceAll(/.../)` call — a strong signal of a raw
//     literal being used against a string method.
//
// Note: this is an intentionally coarse check — it will miss regex literals
// assigned to variables, and it will over-flag a handful of call sites. That's
// fine for a nudge-style rule. Biome's `performance/useTopLevelRegex` covers
// the stricter AST check.
//
// Exit code:
//   0 — no violations
//   1 — violations found (details printed to stdout)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..');

const ROOTS = ['apps', 'packages'];

// Matches: new RegExp(...) or string method calls with a regex literal argument.
// `\(\/` reliably identifies a regex literal start (opening paren + forward slash),
// since division expressions like `.test(x/2)` would not begin with `(/`. This
// check is intentionally coarse — it may over-flag a handful of call sites, which
// is acceptable for a nudge-style rule. Biome's `performance/useTopLevelRegex`
// covers the stricter AST-level check.
const REGEX_PATTERN =
  /(new\s+RegExp\s*\()|(\.(replace|replaceAll|match|matchAll|test|split|search)\(\/)/;

const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'build', '.wrangler']);

// Files explicitly allowed to use raw regex.
// alltrails.ts: builds regex from a dynamic `property` argument — can't be a static constant.
const EXCLUDED_FILES = new Set([
  'packages/analytics/src/core/enrichment.ts',
  'packages/api/src/routes/alltrails.ts',
]);

function isTargetFile(name: string): boolean {
  return /\.(ts|tsx|cts|mts)$/.test(name) && !/\.(test|spec)\.(ts|tsx|cts|mts)$/.test(name);
}

interface Violation {
  file: string;
  line: number;
  content: string;
}

function walkDir(dir: string, relPath: string, violations: Violation[]): void {
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
      if (EXCLUDED_FILES.has(entryRel)) continue;

      let content: string;
      try {
        content = readFileSync(entryFull, 'utf-8');
      } catch {
        continue;
      }

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (REGEX_PATTERN.test(lines[i] ?? '')) {
          violations.push({ file: entryRel, line: i + 1, content: lines[i]?.trimEnd() ?? '' });
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
    `Raw regex literals found (${violations.length}) — prefer magic-regexp (see packages/analytics/src/core/enrichment.ts for a reference):\n`,
  );
  for (const { file, line, content } of violations) {
    console.log(`${file}:${line}:${content}`);
  }
  process.exit(1);
}

console.log('No raw regex literals in non-test production code.');
