#!/usr/bin/env bun
//
// no-raw-process-env.ts — flags raw `process.env` access outside of allowed files.
//
// Node/Bun scripts should import `nodeEnv` from `@packrat/env/node` instead of
// reading `process.env.*` directly. This script detects violations and lists
// them so they can be migrated.
//
// Allowed files (intentionally exempt — see packages/env/src/node.ts for rationale):
//   - packages/env/src/node.ts          — the Node shim itself
//   - packages/env/src/next.ts          — the Next.js shim itself
//   - .github/scripts/configure-deps.ts — preinstall hook, runs before node_modules
//   - .github/scripts/env.ts            — postinstall hook, runs before node_modules
//   - packages/api/src/utils/env-validation.ts — Cloudflare Worker runtime (uses c.env)
//   - apps/expo/env/**                  — Expo uses its own T3-style shim
//   - apps/expo/app.config.ts           — Expo config, build-time only
//
// Exit code:
//   0 — no violations
//   1 — violations found

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..', '..');

// Directories to scan
const SCAN_ROOTS = ['packages', 'apps', '.github/scripts'];

// Files / path prefixes that are explicitly exempt
const ALLOWED: string[] = [
  'packages/env/src/node.ts',
  'packages/env/src/next.ts',
  '.github/scripts/configure-deps.ts',
  '.github/scripts/env.ts',
  'packages/api/src/utils/env-validation.ts',
  'packages/api/container_src/server.ts',
  'packages/analytics/test/core/env.test.ts',
  'apps/expo/env/',
  'apps/expo/app.config.ts',
];

// Directories to skip entirely
const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'build', '.expo', '.next', '.wrangler']);

// Matches process.env.FOO or process.env["FOO"] or bare process.env
const PROCESS_ENV_RE = /\bprocess\.env\b/;

const TARGET_FILE_RE = /\.(ts|tsx|cts|mts|js|mjs|cjs)$/;

function isAllowed(relPath: string): boolean {
  return ALLOWED.some((allowed) =>
    allowed.endsWith('/') ? relPath.startsWith(allowed) : relPath === allowed,
  );
}

function isTargetFile(name: string): boolean {
  return TARGET_FILE_RE.test(name);
}

interface Violation {
  file: string;
  line: number;
  content: string;
}

const violations: Violation[] = [];

function walkDir(dir: string, relPath: string): void {
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
      walkDir(entryFull, entryRel);
    } else if (isTargetFile(entry)) {
      if (isAllowed(entryRel)) continue;

      let content: string;
      try {
        content = readFileSync(entryFull, 'utf-8');
      } catch {
        continue;
      }

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (PROCESS_ENV_RE.test(lines[i] ?? '')) {
          violations.push({ file: entryRel, line: i + 1, content: lines[i]?.trimEnd() ?? '' });
        }
      }
    }
  }
}

for (const root of SCAN_ROOTS) {
  const absRoot = join(ROOT, root);
  // For .github/scripts we use the relative path directly
  const relRoot = relative(ROOT, absRoot);
  walkDir(absRoot, relRoot);
}

if (violations.length > 0) {
  console.log(
    `Raw process.env access found (${violations.length} occurrence${violations.length === 1 ? '' : 's'}).\n` +
      `Migrate Node/Bun scripts to import nodeEnv from '@packrat/env/node'.\n` +
      `Other runtimes (Expo, Next.js, Cloudflare Worker) have separate shims.\n`,
  );
  for (const { file, line, content } of violations) {
    console.log(`  ${file}:${line}  ${content.trimStart()}`);
  }
  process.exit(1);
}

console.log('No raw process.env access found outside of allowed files.');
