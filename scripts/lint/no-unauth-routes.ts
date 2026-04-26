#!/usr/bin/env bun
//
// no-unauth-routes.ts — flags Elysia route handlers that are missing an auth macro.
//
// PackRat's API uses three auth macros in route options:
//   isAuthenticated: true   — requires a valid user JWT
//   isAdmin: true           — requires ADMIN role
//   isValidApiKey: true     — requires X-API-Key (cron / ETL routes)
//
// Any route definition (.get/.post/.put/.patch/.delete/.all) that omits all
// three is either accidentally public or needs a // public-route: annotation
// to explicitly declare it intentional.
//
// Annotation placement:
//   // public-route: reason
//   .post('/login', handler, { body: LoginSchema })
//
// Or inline on the options object's closing line.
//
// Exit code:
//   0 — all routes protected or annotated
//   1 — violations found

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..');
const ROUTES_ROOT = join(ROOT, 'packages', 'api', 'src', 'routes');

const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'build', '__tests__', 'admin']);

// Matches the start of an Elysia route definition: .get('/path'  .post(`/path`  etc.
// Requiring the path to start with '/' distinguishes from URLSearchParams.get('key') etc.
const ROUTE_START = /\.(get|post|put|patch|delete|all)\s*\(\s*['"`]\//g;

// Auth macros that indicate the route is protected.
const AUTH_MACRO = /\bisAuthenticated\s*:\s*true\b|\bisAdmin\s*:\s*true\b|\bisValidApiKey\s*:\s*true\b/;

// Explicit opt-out annotation for intentionally public routes.
const PUBLIC_ANNOTATION = /\/\/\s*public-route:/;

interface Violation {
  file: string;
  line: number;
  method: string;
  path: string;
}

function collectFiles(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (isDir) {
      collectFiles(full, out);
    } else if (/\.ts$/.test(entry) && !/\.(test|spec|d)\.ts$/.test(entry)) {
      out.push(full);
    }
  }
}

function extractRoutePath(content: string, afterOffset: number): string {
  // Extract the string literal that is the first argument of the route call.
  const slice = content.slice(afterOffset, afterOffset + 200);
  const m = slice.match(/^['"`]([^'"`\n]*)/);
  return m ? m[1] : '?';
}

function checkFile(filePath: string): Violation[] {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const violations: Violation[] = [];
  const lines = content.split('\n');
  const relPath = filePath.replace(`${ROOT}/`, '');

  // Reset and scan for all route starts.
  ROUTE_START.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ROUTE_START.exec(content)) !== null) {
    const method = match[1] ?? 'get';
    const callStart = match.index; // position of the '.'
    const parenOpen = content.indexOf('(', callStart + 1); // opening paren of the call

    // Walk forward tracking paren depth to find the end of the full route call.
    let depth = 0;
    let callEnd = -1;
    for (let i = parenOpen; i < content.length; i++) {
      const ch = content[i];
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          callEnd = i;
          break;
        }
      }
    }
    if (callEnd === -1) continue; // malformed — skip

    const span = content.slice(callStart, callEnd + 1);

    // Protected if any auth macro appears within the call.
    if (AUTH_MACRO.test(span)) continue;

    // Also OK if a // public-route: annotation appears anywhere in the span.
    if (PUBLIC_ANNOTATION.test(span)) continue;

    // Also check the run of comment lines immediately preceding the route call.
    const callLine = content.slice(0, callStart).split('\n').length - 1;
    let annotated = false;
    for (let j = callLine - 1; j >= 0 && j >= callLine - 10; j--) {
      const prev = lines[j] ?? '';
      if (PUBLIC_ANNOTATION.test(prev)) {
        annotated = true;
        break;
      }
      if (!/^\s*(\/\/|\*)/.test(prev)) break; // stop at non-comment
    }
    if (annotated) continue;

    const routePath = extractRoutePath(content, parenOpen + 1);
    violations.push({ file: relPath, line: callLine + 1, method, path: routePath });
  }

  return violations;
}

const files: string[] = [];
collectFiles(ROUTES_ROOT, files);

const allViolations: Violation[] = [];
for (const f of files.sort()) {
  allViolations.push(...checkFile(f));
}

if (allViolations.length === 0) {
  console.log('✓ All routes are protected or explicitly annotated as public.');
  process.exit(0);
}

console.log(
  `Found ${allViolations.length} route(s) with no auth macro and no // public-route: annotation:\n`,
);

let lastFile = '';
for (const v of allViolations) {
  if (v.file !== lastFile) {
    console.log(`  ${v.file}`);
    lastFile = v.file;
  }
  console.log(`    line ${v.line}: .${v.method}('${v.path}')`);
}

console.log(
  "\nFix: add isAuthenticated/isAdmin/isValidApiKey to the route options, or add a // public-route: <reason> comment above the route.",
);
process.exit(1);
