/**
 * PackRat MCP operational endpoints.
 *
 * After the U3+U4 cutover this module hosts only the non-OAuth surface:
 *
 *   GET  /            → real health probe (also /health); 200 when the API
 *                       `/health` succeeds, 503 when it's down; isolate-local
 *                       10s cache so reviewer probes don't synthesise load
 *                       against the upstream surface (U16).
 *   GET  /status      → public-safe metadata block: version, scope catalog,
 *                       build commit SHA (from env.MCP_COMMIT_SHA), legal /
 *                       support links (U16).
 *
 * Everything OAuth — the authorize/login/callback state machine, the DCR
 * register gate, the CSRF infrastructure, the role-lookup bridge — was
 * deleted in U3+U4 of the Better Auth OAuth consolidation refactor. The
 * MCP worker is now a pure protected resource: it validates JWT access
 * tokens minted by the API worker (`api.packrat.world`) via `verifyMcpToken`
 * and delegates to the MCP Durable Object. Issuance, consent, refresh,
 * DCR, and KV cleanup all live in the API worker's Better Auth plugin.
 */

import { ServiceMeta, WorkerRoute } from './constants';
import { correlationIdFrom, createLogger, getCorrelationId } from './observability';
import { SCOPES_SUPPORTED } from './scopes';
import type { Env } from './types';

// ── /health + /status (U16) ──────────────────────────────────────────────────

/**
 * Public-safe legal / support / docs URLs surfaced on both `/health` and
 * `/status`. Single source of truth so the two endpoints can never drift —
 * a reviewer hitting either gets the same brand-aligned values.
 *
 * All URLs land on `packratai.com` (the canonical brand domain per the
 * plan's domain-unification decision). `support` is the mailto we also
 * surface from the listing.
 */
const PUBLIC_LINKS = {
  docs: 'https://packratai.com/mcp',
  terms: 'https://packratai.com/terms-of-service',
  privacy: 'https://packratai.com/privacy-policy',
  support: 'mailto:hello@packratai.com',
} as const;

/**
 * Per-isolate cache for `/health` responses. A reviewer (or a Cloudflare-
 * native uptime monitor) hitting `/health` once per second would otherwise
 * land an upstream `/health` fetch on every call — easy to accidentally
 * turn into a synthetic load source against the API. Ten seconds is plenty
 * for an external uptime probe (which polls every 30-60s) and keeps the
 * freshness window short enough that a real outage surfaces within one
 * cache-window of when it began.
 *
 * Isolate-local state — every Worker isolate keeps its own copy, so a
 * fleet of N isolates allows up to N probe-batches per 10s window. That's
 * still bounded by the isolate-pool size (single-digits for our traffic
 * shape) and avoids the complexity + extra subrequests a shared Worker-
 * wide cache would require. See `docs/mcp/runbook.md` § "U16 /health +
 * /status" for the operator-facing trade-off.
 *
 * Module-level `let` (rather than `WeakMap` / `LRU`) is deliberate: a
 * single shared entry is all this cache holds, and we want the simplest
 * possible eviction story so a future refactor can't silently introduce
 * a per-key memory leak.
 */
interface HealthCacheEntry {
  body: unknown;
  status: number;
  expiresAt: number;
}
let healthCache: HealthCacheEntry | null = null;
const HEALTH_CACHE_TTL_MS = 10_000;

/**
 * Reset the `/health` cache. Test-only — every test that exercises the
 * probing path should call this in `beforeEach` so the isolate-local
 * cache doesn't leak between cases. Not exported in the public API
 * surface; the `__resetHealthCacheForTests` name signals intent at the
 * call site.
 */
export function __resetHealthCacheForTests(): void {
  healthCache = null;
}

/**
 * Timeout for the upstream PackRat API health probe. 3s is long enough to
 * tolerate transient network jitter without hanging the `/health`
 * response — and short enough that the synchronous wait stays well below
 * any reasonable reviewer-tool timeout (Cloudflare's external uptime
 * probes default to ~10s).
 */
const API_HEALTH_PROBE_TIMEOUT_MS = 3000;

/**
 * Probe the PackRat API's `/health` endpoint (see
 * `packages/api/src/index.ts`). Hits the API's root `/health`, NOT
 * `/api/health` — Elysia mounts the meta route at the worker root, so
 * the canonical URL is `${PACKRAT_API_URL}/health`. Any non-2xx (or any
 * fetch throw within the timeout window) collapses to `false`. Empty /
 * missing `PACKRAT_API_URL` (unit test environment without the binding)
 * also collapses to `false` rather than throwing a `URL` constructor
 * error.
 */
async function probeApi(env: Env): Promise<boolean> {
  const base = env.PACKRAT_API_URL;
  if (!base || base.length === 0) return false;
  try {
    const res = await fetch(`${base}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(API_HEALTH_PROBE_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Build the `/health` JSON body + status by probing the upstream API. The
 * result is cached for `HEALTH_CACHE_TTL_MS` in the isolate-local
 * `healthCache` slot above.
 *
 * Body shape (stable — reviewers parse this):
 *   {
 *     status: 'ok' | 'degraded',
 *     service, version, transport, endpoint,
 *     docs, terms, privacy, support,             // U12 legal/support surface
 *     probes: { api: 'ok' | 'down' },
 *   }
 *
 * On the degraded path we emit a WARN-level structured log so an operator
 * tailing logs sees which dependency tripped the response.
 *
 * Note: KV is no longer a dependency — the U3+U4 cutover removed all KV
 * usage from the worker, so only the API probe survives.
 */
export async function handleHealth(request: Request, env: Env): Promise<Response> {
  const now = Date.now();
  if (healthCache && healthCache.expiresAt > now) {
    return Response.json(healthCache.body, { status: healthCache.status });
  }

  const apiResult = await Promise.allSettled([probeApi(env)]);
  const apiOk = apiResult[0].status === 'fulfilled' && apiResult[0].value === true;
  const allOk = apiOk;

  const body = {
    status: allOk ? 'ok' : 'degraded',
    service: ServiceMeta.Name,
    version: ServiceMeta.Version,
    transport: ServiceMeta.Transport,
    endpoint: WorkerRoute.Mcp,
    docs: PUBLIC_LINKS.docs,
    terms: PUBLIC_LINKS.terms,
    privacy: PUBLIC_LINKS.privacy,
    support: PUBLIC_LINKS.support,
    probes: {
      api: apiOk ? 'ok' : 'down',
    },
  };
  const status = allOk ? 200 : 503;

  // U15: degraded health is interesting to operators — tail-able with
  // `wrangler tail --env prod --format pretty | grep mcp.health.degraded`.
  // We only log on the degraded path; healthy `/health` calls are
  // silent (otherwise external uptime probes spam Workers Logs every
  // probe-interval seconds).
  if (!allOk) {
    const correlationId = getCorrelationId(request) ?? correlationIdFrom(request);
    const log = createLogger({ correlationId });
    log.warn('mcp.health.degraded', {
      reason: 'api_down',
      statusCode: status,
    });
  }

  healthCache = { body, status, expiresAt: now + HEALTH_CACHE_TTL_MS };
  return Response.json(body, { status });
}

/**
 * `/status` — public-safe metadata block with no secrets ever.
 *
 * Returns the version + transport + scope catalog + brand URLs + the
 * build commit SHA (when `env.MCP_COMMIT_SHA` is bound at deploy time;
 * sentinel `'unknown'` otherwise). Unlike `/health` this is NOT cached:
 * the body is pure constants + an env-var read, no upstream calls — so
 * the per-call cost is already O(1) and a cache would add only
 * complexity. Also unlike `/health` there is no probe, no 503 path,
 * and no degraded surface.
 *
 * The whitelisted fields here are deliberate. Reviewers want a single
 * read-only metadata endpoint to verify a deployed Worker matches the
 * version + scope catalog they were promised; everything they need is in
 * the body. Things we will NEVER add: `PACKRAT_API_URL` (internal),
 * anything from `props`, any token, any runtime feature-flag value
 * beyond the canonical scope list.
 */
export function handleStatus(_request: Request, env: Env): Response {
  return Response.json({
    service: ServiceMeta.Name,
    version: ServiceMeta.Version,
    transport: ServiceMeta.Transport,
    endpoint: WorkerRoute.Mcp,
    scopes_supported: [...SCOPES_SUPPORTED],
    docs: PUBLIC_LINKS.docs,
    terms: PUBLIC_LINKS.terms,
    privacy: PUBLIC_LINKS.privacy,
    support: PUBLIC_LINKS.support,
    commitSha: env.MCP_COMMIT_SHA ?? 'unknown',
  });
}
