#!/usr/bin/env bun
//
// check-all.ts — master orchestrator for all custom PackRat check scripts.
//
// Runs the following checks in parallel and prints a unified summary table:
//   - scripts/lint/no-raw-regex.ts
//   - scripts/lint/no-raw-typeof.ts
//   - scripts/lint/no-circular-deps.ts
//   - scripts/lint/no-duplicate-deps.ts  (skipped if file doesn't exist)
//   - packages/checks/src/check-magic-strings.ts
//   - scripts/format/sort-package-json.ts --check
//
// Output example:
//
//   PackRat Custom Checks
//   ─────────────────────────────────────────
//   ✅  no-raw-regex          (0.4s)
//   ✅  no-raw-typeof         (0.3s)
//   ❌  no-circular-deps      (1.2s)  — 8 cycles found
//   ✅  no-duplicate-deps     (0.6s)
//   ✅  sort-package-json     (0.2s)
//   ─────────────────────────────────────────
//   4 passed · 1 failed
//
// Exit code:
//   0 — all checks passed
//   1 — one or more checks failed

import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');

// Top-level regex constants for extractSummary patterns
const RE_FOUND_N = /found \d+/i;
const RE_N_CYCLE = /\d+ cycle/i;
const RE_N_VIOLATION = /\d+ violation/i;
const RE_N_FILE_OUT_OF_ORDER = /\d+ file.*out of order/i;
const RE_N_ERROR = /\d+ error/i;

// ---------------------------------------------------------------------------
// Check definitions
// ---------------------------------------------------------------------------

interface CheckDef {
  name: string;
  script: string;
  args?: string[];
}

const ALL_CHECKS: CheckDef[] = [
  {
    name: 'no-raw-regex',
    script: join(ROOT, 'scripts', 'lint', 'no-raw-regex.ts'),
  },
  {
    name: 'no-raw-typeof',
    script: join(ROOT, 'scripts', 'lint', 'no-raw-typeof.ts'),
  },
  {
    name: 'no-circular-deps',
    script: join(ROOT, 'scripts', 'lint', 'no-circular-deps.ts'),
  },
  {
    name: 'no-duplicate-deps',
    script: join(ROOT, 'scripts', 'lint', 'no-duplicate-deps.ts'),
  },
  {
    name: 'check-magic-strings',
    script: join(ROOT, 'packages', 'checks', 'src', 'check-magic-strings.ts'),
  },
  {
    name: 'sort-package-json',
    script: join(ROOT, 'scripts', 'format', 'sort-package-json.ts'),
    args: ['--check'],
  },
];

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

interface CheckResult {
  name: string;
  passed: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
  skipped?: boolean;
  skipReason?: string;
}

// ---------------------------------------------------------------------------
// Extract a short summary from a failed check's output
// ---------------------------------------------------------------------------

function extractSummary(stdout: string, stderr: string): string {
  const combined = `${stdout}\n${stderr}`.trim();
  if (!combined) return '';

  // Look for lines that have useful counts/summaries
  const lines = combined.split('\n').filter((l) => l.trim());

  // Patterns that often appear as the key summary line
  for (const line of lines) {
    const l = line.trim();
    if (RE_FOUND_N.test(l)) return l;
    if (RE_N_CYCLE.test(l)) return l;
    if (RE_N_VIOLATION.test(l)) return l;
    if (RE_N_FILE_OUT_OF_ORDER.test(l)) return l;
    if (RE_N_ERROR.test(l)) return l;
  }

  // Fall back to first non-empty line, truncated
  const first = lines[0] ?? '';
  return first.length > 60 ? `${first.slice(0, 57)}…` : first;
}

// ---------------------------------------------------------------------------
// Run a single check
// ---------------------------------------------------------------------------

async function runCheck(def: CheckDef): Promise<CheckResult> {
  // Skip if script doesn't exist
  if (!existsSync(def.script)) {
    return {
      name: def.name,
      passed: true,
      durationMs: 0,
      stdout: '',
      stderr: '',
      skipped: true,
      skipReason: 'script not found',
    };
  }

  const start = performance.now();

  const proc = Bun.spawn(['bun', def.script, ...(def.args ?? [])], {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [stdoutBuf, stderrBuf, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  const durationMs = performance.now() - start;

  return {
    name: def.name,
    passed: exitCode === 0,
    durationMs,
    stdout: stdoutBuf,
    stderr: stderrBuf,
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const DIVIDER = '─'.repeat(41);

function padRight(str: string, width: number): string {
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function renderRow(result: CheckResult): string {
  const icon = result.skipped ? '⏭ ' : result.passed ? '✅' : '❌';
  const nameCol = padRight(result.name, 22);
  const durCol = result.skipped ? '(skipped)' : `(${formatDuration(result.durationMs)})`;

  let row = `${icon}  ${nameCol} ${durCol}`;

  if (result.skipped && result.skipReason) {
    row += `  — ${result.skipReason}`;
  } else if (!result.passed) {
    const summary = extractSummary(result.stdout, result.stderr);
    if (summary) row += `  — ${summary}`;
  }

  return row;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('\nPackRat Custom Checks');
console.log(DIVIDER);

// Print live "starting" lines
for (const check of ALL_CHECKS) {
  if (!existsSync(check.script)) {
    process.stdout.write(`⏭   ${check.name} (script not found — skipping)\n`);
  } else {
    process.stdout.write(`⏳  ${check.name}…\n`);
  }
}

// Move cursor back up to overwrite the spinner lines once results arrive
// (We'll just reprint the full table after all finish — simpler and
//  works correctly in CI environments that buffer stdout.)

// Run all checks in parallel
const results = await Promise.all(ALL_CHECKS.map(runCheck));

// Overwrite the ⏳ lines with the real table (clear + reprint)
// Use ANSI escape to move up N lines and clear to end of screen
const linesToErase = ALL_CHECKS.length + 2; // header + divider + check lines
process.stdout.write(`\x1b[${linesToErase}A\x1b[0J`);

// Print summary table
console.log('\nPackRat Custom Checks');
console.log(DIVIDER);
for (const result of results) {
  console.log(renderRow(result));
}
console.log(DIVIDER);

const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed && !r.skipped).length;
const skipped = results.filter((r) => r.skipped).length;

const parts: string[] = [`${passed} passed`];
if (failed > 0) parts.push(`${failed} failed`);
if (skipped > 0) parts.push(`${skipped} skipped`);
console.log(parts.join(' · '));

// Print full output for failed checks
const failedResults = results.filter((r) => !r.passed && !r.skipped);
if (failedResults.length > 0) {
  console.log('');
  for (const result of failedResults) {
    const dividerLong = '─'.repeat(60);
    console.log(`\n${dividerLong}`);
    console.log(`Output from: ${result.name}`);
    console.log(dividerLong);
    const output = (result.stdout + result.stderr).trim();
    if (output) {
      console.log(output);
    } else {
      console.log('(no output)');
    }
  }
}

process.exit(failed > 0 ? 1 : 0);
