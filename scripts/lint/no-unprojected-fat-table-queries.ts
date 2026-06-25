#!/usr/bin/env bun
//
// no-unprojected-fat-table-queries.ts — enforces explicit column projection
// on Drizzle queries that touch tables carrying a 1536-dim vector embedding
// and large JSONB content (catalogItems, packItems).
//
// Without projection, a single SELECT * row ships ~50-100KB across the
// Neon-to-Worker wire and costs both compute (Neon-side) and egress (billed).
// At list-endpoint scale (limit: 20-100) this is the dominant cost driver
// surfaced in the 2026-06-01 cost audit (docs/brainstorms/...).
//
// Patterns flagged (each works across whitespace/newlines):
//
//   1. `db.select().from(catalogItems|packItems)` — no projection map.
//   2. `db.query.(catalogItems|packItems).findFirst/findMany({...})` where
//      the arg object does NOT include a `columns:` key.
//   3. `.returning()` with no argument map (insert/update/upsert chain).
//      We don't try to verify the table — the no-arg form on these chains
//      is almost always wrong; allow-list the rare legitimate case.
//   4. `with: { catalogItem: true }` or `with: { packItems: true }` —
//      Drizzle relational shortcut that pulls every column of the joined
//      table including embedding + fat JSONB.
//
// Inline opt-out for genuinely-needed full rows (embedding regen text,
// detail endpoints, ETL writes that need everything back):
//
//   // lint:allow-unprojected-fat-table reason: <why>
//
// Place the comment on the SAME line as the violation; the scanner accepts
// the opt-out and emits a noted-skip line for visibility.
//
// Exit code:
//   0 — no violations (allow-listed entries are noted but don't fail)
//   1 — at least one un-allowed violation
//
// Wired into `.github/workflows/checks.yml`.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..');

// Scope: API package source only. Tests + scripts + db package itself stay
// out — schema files define the tables, test fixtures legitimately populate
// them, lint scripts grep for the patterns.
const SCAN_ROOTS = ['packages/api/src'];

// Tables whose rows carry the cost-bearing columns (embedding + fat JSONB).
// Add new tables here as cost analysis surfaces more candidates
// (invalidItemLogs.rawData, posts.images, trailConditionReports.photos
// are likely next per the 2026-06-01 audit).
const WATCHED_TABLES = Object.freeze(['catalogItems', 'packItems'] as const);

// Same names as keys in Drizzle relational `with: { x: true }` shortcuts.
// Drizzle conventionally singularises the relation key (catalogItem from
// catalogItems, etc.) — both forms scanned.
const WATCHED_RELATION_KEYS = Object.freeze([
  'catalogItem',
  'catalogItems',
  'packItems',
  'packItem',
] as const);

const ALLOW_COMMENT = 'lint:allow-unprojected-fat-table';

const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'build', '.wrangler']);

function isTargetFile(name: string): boolean {
  return /\.(ts|tsx|cts|mts)$/.test(name) && !/\.(test|spec)\.(ts|tsx|cts|mts)$/.test(name);
}

interface Violation {
  file: string;
  line: number;
  rule: string;
  content: string;
  allowListed: boolean;
}

function lineOf(source: string, index: number): number {
  // 1-based line number for byte offset.
  let count = 1;
  for (let i = 0; i < index; i++) {
    if (source.charCodeAt(i) === 10 /* \n */) count++;
  }
  return count;
}

function getLine(source: string, line: number): string {
  return source.split('\n')[line - 1] ?? '';
}

// Find every match of pattern in source; return [start, end] pairs.
function findAll(source: string, pattern: RegExp): Array<{ start: number; end: number }> {
  const matches: Array<{ start: number; end: number }> = [];
  const re = new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`);
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex.exec loop
  while ((m = re.exec(source)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length });
    if (m[0].length === 0) re.lastIndex++; // guard against zero-width
  }
  return matches;
}

// Skip the byte range [start, end] of `source` — used to mask out comment
// blocks and string literals before pattern-matching so we don't flag
// example code in docstrings (e.g., this script's own header).
function maskSpans(source: string, spans: Array<{ start: number; end: number }>): string {
  if (spans.length === 0) return source;
  // Sort by start ascending; replace with spaces (preserve line numbers).
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  let out = '';
  let pos = 0;
  for (const { start, end } of sorted) {
    if (start < pos) continue; // overlap
    out += source.slice(pos, start);
    out += source.slice(start, end).replace(/[^\n]/g, ' ');
    pos = end;
  }
  out += source.slice(pos);
  return out;
}

function findCommentAndStringSpans(source: string): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = [];
  // Block comments
  for (const m of findAll(source, /\/\*[\s\S]*?\*\//)) spans.push(m);
  // Line comments (but the allow-list marker line is meaningful — masking
  // is fine because the violation that triggers allow-list lookup happens
  // BEFORE masking; the post-detection allow-list scan reads raw line text).
  for (const m of findAll(source, /\/\/[^\n]*/)) spans.push(m);
  // Template, single, double-quoted strings (simple — won't catch tagged
  // templates with embedded code, but those don't appear in our patterns).
  for (const m of findAll(source, /`(?:\\.|[^`\\])*`/)) spans.push(m);
  for (const m of findAll(source, /'(?:\\.|[^'\\\n])*'/)) spans.push(m);
  for (const m of findAll(source, /"(?:\\.|[^"\\\n])*"/)) spans.push(m);
  return spans;
}

// Detect `.findFirst({...})` / `.findMany({...})` calls and return the byte
// range of the argument object so we can check whether `columns:` appears
// inside. Balances `{` and `}` to handle nested objects (where/with blocks).
function findFindFirstOrMany(
  source: string,
  table: string,
): Array<{ matchStart: number; argStart: number; argEnd: number }> {
  const callPattern = new RegExp(
    `\\bdb\\.query\\.${table}\\.(?:findFirst|findMany)\\s*\\(\\s*\\{`,
    'g',
  );
  const results: Array<{ matchStart: number; argStart: number; argEnd: number }> = [];
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex.exec loop
  while ((m = callPattern.exec(source)) !== null) {
    const openBrace = m.index + m[0].length - 1; // position of `{`
    // Walk forward, balancing braces.
    let depth = 0;
    let i = openBrace;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    if (depth === 0 && i < source.length) {
      results.push({ matchStart: m.index, argStart: openBrace, argEnd: i + 1 });
    }
  }
  return results;
}

function scanFile(relPath: string, source: string, violations: Violation[]): void {
  const masked = maskSpans(source, findCommentAndStringSpans(source));

  // Rule 1: db.select().from(<watched>)
  for (const table of WATCHED_TABLES) {
    const pattern = new RegExp(`\\.select\\(\\s*\\)\\s*\\.from\\(\\s*${table}\\b`, 'g');
    for (const { start } of findAll(masked, pattern)) {
      pushViolation(
        violations,
        relPath,
        source,
        start,
        'no-select-star',
        `db.select().from(${table})`,
      );
    }
  }

  // Rule 2: db.query.<watched>.findFirst/findMany({...}) without `columns:`
  for (const table of WATCHED_TABLES) {
    for (const { matchStart, argStart, argEnd } of findFindFirstOrMany(masked, table)) {
      const args = source.slice(argStart, argEnd);
      // Look for `columns:` anywhere in the args (handles nested `with:`).
      if (!/\bcolumns\s*:/.test(args)) {
        pushViolation(
          violations,
          relPath,
          source,
          matchStart,
          'no-relational-without-columns',
          `db.query.${table}.findFirst|findMany without columns: filter`,
        );
      }
    }
  }

  // Rule 3: `.returning()` no-arg on chains rooted at a WATCHED_TABLE.
  // Match an insert/update/delete on the watched table, then any chained
  // calls (limited to the same statement — non-greedy, terminated by `;`),
  // then a no-arg `.returning()`. Bounded look-ahead avoids matching
  // across unrelated chains in the same file.
  for (const table of WATCHED_TABLES) {
    const pattern = new RegExp(
      `\\.(insert|update|delete)\\(\\s*${table}\\b[\\s\\S]{0,2000}?\\.returning\\(\\s*\\)`,
      'g',
    );
    for (const { start, end } of findAll(masked, pattern)) {
      // Point the violation at the `.returning()` line, not the insert
      // line, so the fix location is obvious.
      const returningRelative = masked.slice(start, end).lastIndexOf('.returning(');
      const returningStart = start + (returningRelative === -1 ? 0 : returningRelative);
      pushViolation(
        violations,
        relPath,
        source,
        returningStart,
        'no-returning-star',
        `.returning() with no projection on ${table} chain`,
      );
    }
  }

  // Rule 4: `with: { <watchedRelation>: true }`
  for (const key of WATCHED_RELATION_KEYS) {
    // Match across newlines inside the `with: { ... }` block. Restrict to
    // the immediate sibling — i.e., `{ ..., key: true, ... }` — by looking
    // for the key followed by `: true` not inside another nested object.
    const pattern = new RegExp(`\\bwith\\s*:\\s*\\{[^{}]*\\b${key}\\s*:\\s*true\\b`, 'g');
    for (const { start } of findAll(masked, pattern)) {
      pushViolation(
        violations,
        relPath,
        source,
        start,
        'no-with-relation-true',
        `with: { ${key}: true } — pulls every column of joined table`,
      );
    }
  }
}

function pushViolation(
  violations: Violation[],
  relPath: string,
  source: string,
  byteOffset: number,
  rule: string,
  description: string,
): void {
  const line = lineOf(source, byteOffset);
  const lineText = getLine(source, line);
  // Accept the allow-list comment on the violation's line OR the immediately
  // adjacent lines. Biome's formatter splits long single-line calls
  // (e.g., `findFirst({ // comment`) onto multiple lines, pushing the
  // trailing comment off the violation line — accepting ±1 is tolerant of
  // that without losing intent.
  const allowListed =
    lineText.includes(ALLOW_COMMENT) ||
    getLine(source, line + 1).includes(ALLOW_COMMENT) ||
    getLine(source, line - 1).includes(ALLOW_COMMENT);
  violations.push({
    file: relPath,
    line,
    rule: `${rule}: ${description}`,
    content: lineText.trimEnd(),
    allowListed,
  });
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
    const entryRel = relPath ? `${relPath}/${entry}` : entry;
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
      scanFile(entryRel, content, violations);
    }
  }
}

const all: Violation[] = [];
for (const scanRoot of SCAN_ROOTS) {
  walkDir(join(ROOT, scanRoot), scanRoot, all);
}

const failing = all.filter((v) => !v.allowListed);
const allowed = all.filter((v) => v.allowListed);

if (allowed.length > 0) {
  console.log(`\nAllow-listed (${allowed.length}, no failure):`);
  for (const { file, line, rule } of allowed) {
    console.log(`  ${file}:${line} — ${rule}`);
  }
}

if (failing.length > 0) {
  console.log(
    `\nUnprojected fat-table queries found (${failing.length}). Each ships every column ` +
      `of catalog_items / pack_items (incl. 1536-dim embedding + multi-KB JSONB) from Neon ` +
      `to the Worker on every call — see CLAUDE.md "DB query projection discipline".\n`,
  );
  for (const { file, line, rule, content } of failing) {
    console.log(`${file}:${line}: ${rule}`);
    console.log(`  ${content}`);
  }
  console.log(
    `\nFix: add an explicit \`columns:\` whitelist, a \`select({...})\` projection map, ` +
      `or a typed \`.returning({...})\`. For genuine full-row cases (embedding regen, ` +
      `detail endpoints) add inline opt-out: // ${ALLOW_COMMENT} reason: <why>`,
  );
  process.exit(1);
}

console.log(
  `No unprojected queries against ${WATCHED_TABLES.join(', ')} found in ${SCAN_ROOTS.join(', ')}.`,
);
