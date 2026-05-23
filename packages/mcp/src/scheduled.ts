/**
 * U14 — KV purge cron handler.
 *
 * Extracted from `index.ts` so the loop logic is testable in a node-native
 * vitest run (importing `index.ts` would drag in `agents/mcp`, which
 * depends on `cloudflare:workers`). The exported handler is wired into
 * the default-export `scheduled()` arm in `index.ts`.
 *
 * Contract:
 *   - Calls `oauthProvider.purgeExpiredData(env, { batchSize: 100 })` in
 *     a loop until either `result.done === true` OR the safety cap
 *     `CRON_PURGE_MAX_ITERATIONS` fires, whichever comes first.
 *   - The cap is the load-bearing piece: a scheduled handler has ~30s of
 *     CPU budget. Each `purgeExpiredData` call does up to ~200 KV
 *     subrequests (100 keys × ~2 reads); we cap iterations so a
 *     pathological state can't burn the entire worker budget.
 *   - If we don't finish in one tick, the next day's tick picks up where
 *     we left off — `purgeExpiredData` is safe to call repeatedly per
 *     the library docstring: "deleted records disappear from KV, so
 *     subsequent invocations naturally process fresh records without
 *     needing a persisted cursor."
 *
 * Why batchSize 100 (vs. the library default of 50)? We have headroom in
 * a daily cron and want to drain backlog quickly. Cloudflare's
 * 1000-subrequest-per-invocation limit is the real ceiling; 100 keys ×
 * ~2 reads = ~200 subrequests/pass, comfortably under the cap.
 */

import type { OAuthProvider, PurgeResult } from '@cloudflare/workers-oauth-provider';
import type { Env } from './types';

/**
 * Iteration cap for the daily KV purge loop. See module docstring above
 * for the load-bearing rationale. Exposed for the scheduled-handler test
 * suite so the cap can be verified against a mocked `purgeExpiredData`
 * that never returns `done: true`.
 */
export const CRON_PURGE_MAX_ITERATIONS = 50;

/**
 * Per-call options passed to `purgeExpiredData`. Pulled into a constant
 * so the scheduled-handler test can assert the exact shape.
 */
export const PURGE_OPTIONS = { batchSize: 100 } as const;

/**
 * Drive the OAuthProvider's `purgeExpiredData` loop until done or the
 * iteration cap fires. Returns a summary the caller can log / test
 * against; production callers discard it.
 *
 * `provider` is the OAuthProvider instance (NOT `env.OAUTH_PROVIDER`,
 * which is the per-request helpers object and isn't available in a
 * scheduled handler). See
 * `@cloudflare/workers-oauth-provider/dist/oauth-provider.d.ts:1191`.
 */
export async function runScheduledPurge(
  provider: Pick<OAuthProvider<Env>, 'purgeExpiredData'>,
  env: Env,
): Promise<{ iterations: number; done: boolean; lastResult: PurgeResult | null }> {
  let iterations = 0;
  let done = false;
  let lastResult: PurgeResult | null = null;
  while (!done && iterations < CRON_PURGE_MAX_ITERATIONS) {
    iterations += 1;
    const result = await provider.purgeExpiredData(env, PURGE_OPTIONS);
    lastResult = result;
    done = result.done;
  }
  return { iterations, done, lastResult };
}
