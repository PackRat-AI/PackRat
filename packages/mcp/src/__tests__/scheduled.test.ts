/**
 * U14 — scheduled-handler tests for the daily KV purge cron.
 *
 * The cron-loop logic lives in `src/scheduled.ts` (extracted from
 * `index.ts` so it's reachable from node-native vitest without dragging
 * in `agents/mcp` → `cloudflare:workers`). The `scheduled()` arm of the
 * default export in `index.ts` is a one-liner that delegates here.
 *
 * Coverage:
 *   - The handler calls `purgeExpiredData(env, { batchSize: 100 })`.
 *   - The handler loops until `result.done === true` (mock returns
 *     `done: false` twice then `true` → exactly 3 calls).
 *   - The iteration cap fires even if the mock keeps returning
 *     `done: false` forever — no runaway loop.
 *   - Cron schedule in `wrangler.jsonc` is `0 4 * * *` (verified via
 *     filesystem read so the docs and code stay in lockstep).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CRON_PURGE_MAX_ITERATIONS, PURGE_OPTIONS, runScheduledPurge } from '../scheduled';
import type { Env } from '../types';

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    PackRatMCP: {} as Env['PackRatMCP'],
    PACKRAT_API_URL: 'https://api.test',
    OAUTH_KV: {} as Env['OAUTH_KV'],
    OAUTH_PROVIDER: {} as Env['OAUTH_PROVIDER'],
    ...overrides,
  };
}

/**
 * Build a minimal Pick<OAuthProvider, 'purgeExpiredData'> stub whose
 * `purgeExpiredData` returns `done: true` after a configurable number of
 * `done: false` results. Records every call so tests can assert the
 * args + invocation count.
 */
function makeProviderStub(doneAfter: number, neverDone = false) {
  let calls = 0;
  const purgeExpiredData = vi.fn(async (_env: Env, _opts?: unknown) => {
    calls += 1;
    return {
      grantsChecked: 10,
      grantsPurged: 1,
      tokensChecked: 10,
      tokensPurged: 1,
      done: !neverDone && calls >= doneAfter,
    };
  });
  return { purgeExpiredData };
}

describe('runScheduledPurge', () => {
  it('calls purgeExpiredData with the canonical batchSize: 100 options', async () => {
    const provider = makeProviderStub(1);
    const env = makeEnv();
    await runScheduledPurge(provider, env);
    expect(provider.purgeExpiredData).toHaveBeenCalledTimes(1);
    expect(provider.purgeExpiredData).toHaveBeenCalledWith(env, PURGE_OPTIONS);
    // Spell out the literal so a future refactor that changes the
    // constant has to update both this test and the doc.
    expect(PURGE_OPTIONS).toEqual({ batchSize: 100 });
  });

  it('loops until result.done is true (mock: false, false, true → exactly 3 calls)', async () => {
    const provider = makeProviderStub(3);
    const env = makeEnv();
    const summary = await runScheduledPurge(provider, env);
    expect(provider.purgeExpiredData).toHaveBeenCalledTimes(3);
    expect(summary.iterations).toBe(3);
    expect(summary.done).toBe(true);
    expect(summary.lastResult?.done).toBe(true);
  });

  it('terminates on the first done:true even if the loop would otherwise continue', async () => {
    const provider = makeProviderStub(1);
    const env = makeEnv();
    const summary = await runScheduledPurge(provider, env);
    expect(summary.iterations).toBe(1);
    expect(summary.done).toBe(true);
  });

  it('caps iterations at CRON_PURGE_MAX_ITERATIONS when the mock never reports done', async () => {
    const provider = makeProviderStub(Number.POSITIVE_INFINITY, /* neverDone */ true);
    const env = makeEnv();
    const summary = await runScheduledPurge(provider, env);
    // The safety cap MUST fire — otherwise a pathological state burns
    // the entire scheduled-handler CPU budget.
    expect(summary.iterations).toBe(CRON_PURGE_MAX_ITERATIONS);
    expect(summary.done).toBe(false);
    expect(provider.purgeExpiredData).toHaveBeenCalledTimes(CRON_PURGE_MAX_ITERATIONS);
  });

  it('exposes the cap at exactly 50 (load-bearing for the 30s cron CPU budget)', () => {
    // If we ever raise this, raise it deliberately — 50 × (~200 KV
    // subrequests) = ~10k subrequests, well inside Cloudflare's
    // per-invocation soft limit when combined with the rest of the
    // worker's load.
    expect(CRON_PURGE_MAX_ITERATIONS).toBe(50);
  });
});

describe('wrangler.jsonc cron schedule', () => {
  it('is set to "0 4 * * *" (04:00 UTC daily) in both top-level and env.prod blocks', () => {
    const wranglerPath = resolve(__dirname, '../../wrangler.jsonc');
    const raw = readFileSync(wranglerPath, 'utf8');
    // Crude but reliable: there are exactly 3 cron entries (top, prod, dev)
    // and all of them must read "0 4 * * *". A drift here means the cron
    // schedule and the docs are out of sync.
    const matches = raw.match(/"crons":\s*\[\s*"0 4 \* \* \*"\s*\]/g);
    expect(matches).not.toBeNull();
    expect(matches?.length).toBe(3);
  });
});
