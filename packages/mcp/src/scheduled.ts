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
import { createLogger, type Logger, syntheticCorrelationId } from './observability';
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
// biome-ignore lint/complexity/useMaxParams: the `logger` slot is the test seam — passing a pre-built Logger lets the scheduled-handler tests capture the cron emission inline. Folding it into an options object adds noise at every prod call site (which never wants to pass it).
export async function runScheduledPurge(
  provider: Pick<OAuthProvider<Env>, 'purgeExpiredData'>,
  env: Env,
  logger?: Logger,
): Promise<{ iterations: number; done: boolean; lastResult: PurgeResult | null }> {
  // U15: a scheduled handler has no inbound Request, so we synthesise a
  // correlation ID with a `cron:` prefix. Operators can filter Workers
  // Logs on `correlationId: cron:*` to see only purge-loop emissions.
  const log = logger ?? createLogger({ correlationId: syntheticCorrelationId('cron') });
  let iterations = 0;
  let done = false;
  let lastResult: PurgeResult | null = null;
  log.info('mcp.cron.purge.start', { cap: CRON_PURGE_MAX_ITERATIONS });
  while (!done && iterations < CRON_PURGE_MAX_ITERATIONS) {
    iterations += 1;
    const result = await provider.purgeExpiredData(env, PURGE_OPTIONS);
    lastResult = result;
    done = result.done;
    log.info('mcp.cron.purge.batch', {
      iteration: iterations,
      grantsChecked: result.grantsChecked,
      grantsPurged: result.grantsPurged,
      tokensChecked: result.tokensChecked,
      tokensPurged: result.tokensPurged,
      done: result.done,
    });
  }
  if (!done) {
    log.warn('mcp.cron.purge.cap_reached', {
      iterations,
      cap: CRON_PURGE_MAX_ITERATIONS,
    });
  }
  log.info('mcp.cron.purge.complete', { iterations, done });
  return { iterations, done, lastResult };
}
