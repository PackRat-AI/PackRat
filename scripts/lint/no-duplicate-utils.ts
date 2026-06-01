#!/usr/bin/env bun
//
// no-duplicate-utils.ts — flags re-implementations of helpers that are already
// exported from @packrat/utils.
//
// The utils package (packages/utils/) is the single source of truth for the
// curated general-utility surface (array / async / fn / json / math / object /
// string / predicates). Duplicating those helpers in app code leads to subtle
// behavioural divergence and defeats the "one import path" policy.
//
// The banned-name set is DERIVED from the @packrat/utils provenance manifest
// (packages/utils/src/provenance.ts), whose keys ARE the canonical export
// names. The check therefore auto-syncs as the facade grows — adding a row to
// the manifest extends coverage with no edit here.
//
// A "re-implementation" is any top-level function declaration or arrow-function
// assignment whose name matches one of the manifest names, found outside
// packages/utils/ and packages/checks/ (the check scripts themselves).
// Re-exports (`export { x } from ...`, `import { x } from ...`) and comments
// are NOT flagged — only home-grown re-IMPLEMENTATIONS.
//
// Matching precision: this flags only *callable* declarations — a `function`
// declaration, or a `const`/`let` whose value is a function (arrow `=>` or
// `function`). It does NOT flag method calls, object keys, property accesses,
// or data-valued locals. This matters because several manifest names are
// generic (sort, min, max, group, pipe, round, chunk, sum, list, once, assign,
// title); a naive name match flags innocent locals like `const list = await
// bucket.list()` or `const title = 'Open up the code'`. Requiring a function
// value eliminates that whole class of false positive while still catching any
// home-grown re-implementation (a re-implementation is, by definition, a
// function). Verified clean against the current repo (a naive declaration
// match flagged 9 data-valued locals; the function-value scope flags 0).
//
// Exit code:
//   0 — no violations
//   1 — violations found

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { provenance } from '@packrat/utils/provenance';

const SCAN_ROOTS = ['apps', 'packages'];

// Names exported from @packrat/utils that should not be re-implemented
// elsewhere — derived from the provenance manifest keys so this auto-syncs.
export const UTIL_NAMES = new Set(Object.keys(provenance));

// Excluded source roots (the canonical definitions live here).
// Mirrors no-duplicate-guards: utils is the source of truth, and the checks
// package houses the analyzers themselves.
const EXCLUDED_ROOTS = ['packages/utils', 'packages/checks'];

const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'build', '.next', '.expo', 'drizzle']);

// Matches a function *declaration* — always a re-implementation:
//   export function unique(...)
//   function unique(...)
const FUNCTION_DECL_PATTERN = /(?:export\s+)?function\s*\*?\s*([A-Za-z][A-Za-z0-9_]*)\s*[(<]/g;

// Matches a const/let bound to a function value — also a re-implementation:
//   const unique = (...) => ...
//   export const unique = async (a, b) => ...
//   const unique = function (...) { ... }
//   export const unique = <T>(x: T) => ...
//   const unique = (a: number): number => ...
// The trailing lookahead requires the right-hand side to begin a function:
// an arrow's param list `(`, a generic `<`, a single bare param + `=>`, or the
// `function`/`async` keyword. A data-valued `const list = await bucket.list()`
// does NOT match (its RHS is `await ...`, not a function literal).
const FUNCTION_CONST_PATTERN =
  /(?:export\s+)?(?:const|let)\s+([A-Za-z][A-Za-z0-9_]*)\s*=\s*(?:async\s+)?(?:function\b|\(|<|[A-Za-z_$][\w$]*\s*=>)/g;

// Matches a const/let whose TYPE ANNOTATION is a function type — a function-
// typed binding is still a re-implementation:
//   const isString: (v: unknown) => boolean = (v) => ...
//   export const clamp: (n: number) => number = clampImpl;
// The `=>` inside the annotation (before the value `=`) is the signal. This is
// kept separate from FUNCTION_CONST_PATTERN because the annotation can itself
// contain `=>`, which a single combined regex cannot cleanly span.
const FUNCTION_TYPED_CONST_PATTERN =
  /(?:export\s+)?(?:const|let)\s+([A-Za-z][A-Za-z0-9_]*)\s*:[^=]*=>/g;

export interface Violation {
  file: string;
  line: number;
  name: string;
  source: string;
}

/**
 * Scan a single file's source text for home-grown re-implementations of
 * @packrat/utils helpers. Pure (no filesystem) so it is unit-testable.
 */
export function analyzeSource(file: string, content: string): Violation[] {
  const violations: Violation[] = [];
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

    const seen = new Set<string>();
    for (const pattern of [
      FUNCTION_DECL_PATTERN,
      FUNCTION_CONST_PATTERN,
      FUNCTION_TYPED_CONST_PATTERN,
    ]) {
      pattern.lastIndex = 0;
      for (let m = pattern.exec(line); m !== null; m = pattern.exec(line)) {
        const name = m[1];
        // A function-typed const can match both const patterns; dedupe per line.
        if (name && UTIL_NAMES.has(name) && !seen.has(name)) {
          seen.add(name);
          violations.push({ file, line: i + 1, name, source: line.trimEnd() });
        }
      }
    }
  }

  return violations;
}

function isTargetFile(name: string): boolean {
  return (
    /\.(ts|tsx|cts|mts)$/.test(name) && !/\.(test|spec|stories|d)\.(ts|tsx|cts|mts)$/.test(name)
  );
}

/** True for paths under a canonical-source root that must never be flagged. */
export function isExcluded(relPath: string): boolean {
  return EXCLUDED_ROOTS.some((p) => relPath === p || relPath.startsWith(`${p}/`));
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

      violations.push(...analyzeSource(entryRel, content));
    }
  }
}

function main(): void {
  const root = join(import.meta.dir, '..', '..');
  const violations: Violation[] = [];
  for (const scanRoot of SCAN_ROOTS) {
    walkDir(join(root, scanRoot), scanRoot, violations);
  }

  if (violations.length === 0) {
    console.log('No duplicate @packrat/utils implementations found.');
    process.exit(0);
  }

  console.log(
    `Found ${violations.length} util re-implementation(s) outside @packrat/utils — import from '@packrat/utils' instead:\n`,
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

  console.log("\nFix: remove the local copy and import from '@packrat/utils'.");
  process.exit(1);
}

if (import.meta.main) {
  main();
}
