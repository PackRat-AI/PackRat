#!/usr/bin/env bun
//
// no-raw-ast-grep.ts — runs the ast-grep structural lint suite and propagates
// its exit code.
//
// This replaces the former regex-based scripts no-raw-typeof.ts and
// no-raw-regex.ts. They were ported to AST-accurate ast-grep rules (under
// ast-grep-rules/) which catch every pattern the regex versions did — plus the
// optional-chaining / bracket / member-expression cases the regex versions
// silently missed (e.g. `typeof options?.md5 === 'string'`). Parity is proven
// by the ast-grep rule tests (`ast-grep test`); see ast-grep-rules/PARITY.md.
//
// Rules enforced (error → fails CI):
//   - no-raw-typeof    → use @packrat/guards predicates instead of raw typeof
//   - no-raw-regex     → use magic-regexp instead of raw regex literals
// Rules at warning level (do NOT fail CI yet):
//   - no-raw-json*     → use @packrat/utils safeParse/safeStringify
//                        (the repo-wide JSON migration flips these to error)
//
// Exit code mirrors ast-grep: 0 — clean; 1 — error-level diagnostics found.

import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..');

const proc = Bun.spawn(['bunx', 'ast-grep', 'scan', '-c', join(ROOT, 'sgconfig.yml')], {
  cwd: ROOT,
  stdout: 'inherit',
  stderr: 'inherit',
});

process.exit(await proc.exited);
