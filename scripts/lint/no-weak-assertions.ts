#!/usr/bin/env bun
//
// no-weak-assertions.ts — catches coverage theater in test files.
//
// Walks every `.test.ts` / `.test.tsx` file under apps/* and packages/* and
// flags `it(...)` / `test(...)` blocks that contain one of the following:
//
//   • assertion-free-test    — zero `expect(` or `expect*(...)` calls in
//                              the block. Helper assertions whose names
//                              start with `expect` (e.g. `expectUnauthorized`,
//                              `expectJsonResponse`) count as assertions.
//   • only-tobedefined       — every direct `expect(...)` ends in a
//                              non-specific matcher (`.toBeDefined()`,
//                              `.toBeTruthy()`, `.toBeFalsy()`,
//                              `.not.toBeUndefined()`, or
//                              `.not.toBeNull()`) AND no expect-helper is
//                              called in the block. `.toBeUndefined()` and
//                              `.toBeNull()` alone are NOT flagged — they
//                              assert specific return values.
//   • bare-tohavebeencalled  — `.toHaveBeenCalled()` present without
//                              `.toHaveBeenCalledWith(...)` or
//                              `.toHaveBeenCalledTimes(...)` in the same
//                              block.
//   • large-snapshot         — `toMatchInlineSnapshot(...)` body > 50 lines.
//
// These patterns provably hide regressions and inflate coverage without
// proving behaviour. Tests should assert specific values, specific call
// shapes, or both.
//
// Escape hatch:
//   // no-weak-assertions: disable
// placed within the file's first 5 lines skips the file entirely. Use
// sparingly — grandfathered tests only.
//
// `it.todo(...)`, `it.skip(...)`, `it.each(...)` are not flagged (they
// either have no body or carry parameterised bodies that this rule does
// not analyse).
//
// Exit code:
//   0 — no violations
//   1 — violations found

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SCAN_ROOTS = ['apps', 'packages'];
const EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  '.expo',
  '.wrangler',
  'coverage',
]);

const LARGE_SNAPSHOT_THRESHOLD_LINES = 50;
const DISABLE_COMMENT = 'no-weak-assertions: disable';

// Matchers that assert *non-specific* shape — covered tests should usually
// assert a concrete value instead. `.toBeUndefined()` and `.toBeNull()` are
// intentionally NOT in this list: when the function under test is documented
// to return `undefined` / `null`, these are specific assertions, not weak.
const WEAK_MATCHER_PATTERN =
  /\.(?:toBeDefined|toBeTruthy|toBeFalsy)\s*\(\s*\)|\.not\.(?:toBeUndefined|toBeNull)\s*\(\s*\)/;

// Match `it(`, `test(`, `it.only(`, `test.only(`. Skip `.todo`, `.skip`,
// `.each`, `.concurrent`, `.failing` since they don't carry a runnable body
// the rule applies to.
const TEST_OPENER_PATTERN = /\b(?:it|test)(?:\.only)?\s*\(/g;

export type WeakAssertionRule =
  | 'assertion-free-test'
  | 'only-tobedefined'
  | 'bare-tohavebeencalled'
  | 'large-snapshot';

export interface Violation {
  file: string;
  line: number;
  rule: WeakAssertionRule;
  message: string;
}

export function isFileDisabled(src: string): boolean {
  const head = src.split('\n').slice(0, 5).join('\n');
  return head.includes(DISABLE_COMMENT);
}

// Locate the matching closing paren / brace, starting from `start` (the
// index of the opening character in `src`). Returns the index of the close,
// or -1 if not found (unbalanced).
function findMatchingClose(src: string, start: number, open: string, close: string): number {
  let depth = 0;
  let inString: '"' | "'" | '`' | null = null;
  let inLineComment = false;
  let inBlockComment = false;
  let inRegex = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i] ?? '';
    const prev = src[i - 1] ?? '';
    const next = src[i + 1] ?? '';

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }
    if (inRegex) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === '/') inRegex = false;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch as '"' | "'" | '`';
      continue;
    }
    if (ch === '/' && /[(,=:!&|?+\-*%~^[{;]/.test(prev)) {
      inRegex = true;
      continue;
    }

    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function lineNumberOf(src: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (src[i] === '\n') line++;
  }
  return line;
}

function pushIfNew(violations: Violation[], v: Violation): void {
  // Avoid duplicate (file, line, rule) entries when a block contains both
  // a snapshot violation and a block-level violation on the same line.
  if (violations.some((x) => x.file === v.file && x.line === v.line && x.rule === v.rule)) return;
  violations.push(v);
}

function checkInlineSnapshots(src: string, file: string, violations: Violation[]): void {
  const pattern = /\.toMatchInlineSnapshot\s*\(/g;
  let match: RegExpExecArray | null = pattern.exec(src);
  while (match !== null) {
    const openIdx = match.index + match[0].length - 1;
    const closeIdx = findMatchingClose(src, openIdx, '(', ')');
    if (closeIdx !== -1) {
      const snippet = src.slice(openIdx + 1, closeIdx);
      const lineCount = snippet.split('\n').length;
      if (lineCount > LARGE_SNAPSHOT_THRESHOLD_LINES) {
        pushIfNew(violations, {
          file,
          line: lineNumberOf(src, match.index),
          rule: 'large-snapshot',
          message: `inline snapshot is ${lineCount} lines (limit ${LARGE_SNAPSHOT_THRESHOLD_LINES})`,
        });
      }
    }
    match = pattern.exec(src);
  }
}

function checkTestBlocks(src: string, file: string, violations: Violation[]): void {
  TEST_OPENER_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null = TEST_OPENER_PATTERN.exec(src);
  while (match !== null) {
    const openParenIdx = match.index + match[0].length - 1;
    const closeParenIdx = findMatchingClose(src, openParenIdx, '(', ')');
    if (closeParenIdx === -1) {
      match = TEST_OPENER_PATTERN.exec(src);
      continue;
    }

    const head = src.slice(openParenIdx, closeParenIdx + 1);
    const bodyBraceMatch = /=>\s*\{|function[^(]*\([^)]*\)\s*\{|async\s*\([^)]*\)\s*=>\s*\{/.exec(
      head,
    );
    if (!bodyBraceMatch) {
      match = TEST_OPENER_PATTERN.exec(src);
      continue;
    }
    const bodyBraceIdx = openParenIdx + bodyBraceMatch.index + bodyBraceMatch[0].length - 1;
    const bodyCloseIdx = findMatchingClose(src, bodyBraceIdx, '{', '}');
    if (bodyCloseIdx === -1) {
      match = TEST_OPENER_PATTERN.exec(src);
      continue;
    }
    const body = src.slice(bodyBraceIdx + 1, bodyCloseIdx);
    const startLine = lineNumberOf(src, match.index);

    // Count any function call whose name starts with `expect` — covers both
    // bare `expect(` and convention-based helpers like `expectUnauthorized(`,
    // `expectJsonResponse(`, `expectForbidden(`, etc., which encapsulate
    // assertion logic inside a named helper.
    const expectLikeCalls = (body.match(/\bexpect[A-Za-z0-9]*\s*\(/g) ?? []).length;

    if (expectLikeCalls === 0) {
      pushIfNew(violations, {
        file,
        line: startLine,
        rule: 'assertion-free-test',
        message: 'test block has no expect() or expect-helper calls',
      });
      match = TEST_OPENER_PATTERN.exec(src);
      continue;
    }

    // only-tobedefined: every direct `expect(...)` ends in a weak matcher AND
    // there are no expect-helper calls (helpers like expectUnauthorized are
    // assumed to assert specific shape internally).
    const bareExpectSites = [...body.matchAll(/\bexpect\s*\(/g)];
    const helperExpectSites = expectLikeCalls - bareExpectSites.length;
    let weakCount = 0;
    for (const m of bareExpectSites) {
      const after = body.slice(m.index ?? 0, (m.index ?? 0) + 200);
      if (WEAK_MATCHER_PATTERN.test(after)) weakCount++;
    }
    if (
      helperExpectSites === 0 &&
      bareExpectSites.length > 0 &&
      weakCount === bareExpectSites.length
    ) {
      pushIfNew(violations, {
        file,
        line: startLine,
        rule: 'only-tobedefined',
        message:
          'every expect() uses a non-specific matcher (toBeDefined / toBeTruthy / toBeFalsy / .not.toBeUndefined / .not.toBeNull) — assert specific values',
      });
    }

    // bare-tohavebeencalled: `.toHaveBeenCalled()` present without
    // `.toHaveBeenCalledWith(` or `.toHaveBeenCalledTimes(` in the same block.
    const hasBareCalled = /\.toHaveBeenCalled\s*\(\s*\)/.test(body);
    const hasArgMatcher = /\.toHaveBeenCalledWith\s*\(|\.toHaveBeenCalledTimes\s*\(/.test(body);
    if (hasBareCalled && !hasArgMatcher) {
      pushIfNew(violations, {
        file,
        line: startLine,
        rule: 'bare-tohavebeencalled',
        message:
          '.toHaveBeenCalled() without .toHaveBeenCalledWith(...) or .toHaveBeenCalledTimes(N) — assert the call shape',
      });
    }

    match = TEST_OPENER_PATTERN.exec(src);
  }
}

// Analyse a single source string and return the violations it contains.
// `file` is used purely as a label in the returned violations; this function
// does not read from disk and is safe to call from tests with inline source.
export function analyzeSource(file: string, src: string): Violation[] {
  if (isFileDisabled(src)) return [];
  const violations: Violation[] = [];
  checkInlineSnapshots(src, file, violations);
  checkTestBlocks(src, file, violations);
  return violations;
}

function isTestFile(name: string): boolean {
  return /\.(test|spec)\.(ts|tsx|cts|mts)$/.test(name);
}

function walkDir(dir: string, relPath: string, files: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const rel = `${relPath}/${entry}`;
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (isDir) {
      walkDir(full, rel, files);
    } else if (isTestFile(entry)) {
      files.push(rel);
    }
  }
}

if (import.meta.main) {
  const ROOT = join(import.meta.dir, '..', '..');
  const files: string[] = [];
  for (const root of SCAN_ROOTS) {
    walkDir(join(ROOT, root), root, files);
  }

  const violations: Violation[] = [];
  for (const file of files) {
    let src: string;
    try {
      src = readFileSync(join(ROOT, file), 'utf-8');
    } catch {
      continue;
    }
    for (const v of analyzeSource(file, src)) violations.push(v);
  }

  if (violations.length > 0) {
    console.log(`Weak assertion patterns found (${violations.length} violations):\n`);
    for (const v of violations) {
      console.log(`${v.file}:${v.line}:${v.rule}: ${v.message}`);
    }
    console.log(
      '\nFix by asserting specific values, specific call shapes, or both. See docs/testing.md.',
    );
    process.exit(1);
  }

  console.log('No weak-assertion patterns found.');
}
