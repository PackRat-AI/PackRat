#!/usr/bin/env bun
//
// no-direct-wrapped-imports.ts — enforces the lib/ wrapper convention.
//
// Some external modules are wrapped in `apps/expo/lib/` so callers get a single
// import that works across platforms (the `.web` variant handles browser
// behaviour). Once a module is wrapped, it must be imported from the wrapper
// everywhere else — importing the raw dependency directly bypasses the web
// shim and reintroduces platform branches.
//
// To wrap a new module, add it to WRAPPED below and create lib/<name>.ts
// (+ lib/<name>.web.ts as needed).
//
// Exit code:
//   0 — no violations
//   1 — violations found (details printed to stdout)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..');
const ROOTS = ['apps', 'packages'];
const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'build', '.wrangler', '.expo']);

// Raw module specifier → the wrapper module that owns it. Only the wrapper file
// (and its platform variants) may import the raw module.
const WRAPPED: Record<string, string> = {
  'expo-secure-store': 'apps/expo/lib/secureStore',
  'expo-apple-authentication': 'apps/expo/lib/appleAuthentication',
  'expo-updates': 'apps/expo/lib/updates',
};

const VARIANT = /\.(web|native|ios|android)$/;

function ownsModule(relPathNoExt: string, wrapper: string): boolean {
  return relPathNoExt === wrapper || relPathNoExt.replace(VARIANT, '') === wrapper;
}

function isTargetFile(name: string): boolean {
  return /\.(ts|tsx|cts|mts)$/.test(name);
}

interface Violation {
  file: string;
  line: number;
  module: string;
  wrapper: string;
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
      continue;
    }
    if (!isTargetFile(entry)) continue;

    const relNoExt = entryRel.replace(/\.(ts|tsx|cts|mts)$/, '');
    let content: string;
    try {
      content = readFileSync(entryFull, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      for (const [mod, wrapper] of Object.entries(WRAPPED)) {
        // import ... from 'mod'  /  require('mod')  /  import('mod')
        const re = new RegExp(`(from|require\\(|import\\()\\s*['"]${mod}['"]`);
        if (re.test(line) && !ownsModule(relNoExt, wrapper)) {
          violations.push({ file: entryRel, line: i + 1, module: mod, wrapper });
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
    `Direct imports of wrapped modules found (${violations.length}) — import from the lib/ wrapper instead:\n`,
  );
  for (const { file, line, module, wrapper } of violations) {
    console.log(`${file}:${line}: import '${module}' → use '${wrapper}'`);
  }
  process.exit(1);
}

console.log('No direct imports of wrapped modules.');
