#!/usr/bin/env bun
//
// check-duplication.ts — runs jscpd (copy-paste detector) over apps/ + packages/
// and propagates its exit code. Config lives in .jscpd.json (threshold, ignores,
// formats). Fails when duplication exceeds the threshold.
//
// Baseline at introduction: ~5.2% duplicated lines (ts + tsx). The gate is set
// to 7% to block NEW duplication while leaving headroom; ratchet the threshold
// down in follow-ups as clones are collapsed into @packrat/utils.
//
// Exit code mirrors jscpd: 0 — under threshold; 1 — over threshold.

import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..');

const proc = Bun.spawn(['bunx', 'jscpd', 'apps', 'packages'], {
  cwd: ROOT,
  stdout: 'inherit',
  stderr: 'inherit',
});

process.exit(await proc.exited);
