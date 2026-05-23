/**
 * U14 — Workers Rate Limiting binding wrapper.
 *
 * Thin helpers around `env.MCP_TOOLS_RL.limit({ key })`. Two seams:
 *
 *   - `toolRateLimitKey(userId, toolName)` — canonical key shape for
 *     per-user/per-tool counters. Centralised so a future refactor of the
 *     key shape (e.g. adding a session segment) lands in one place.
 *   - `checkRateLimit(env, key)` — call the binding if it's bound, return
 *     `true` when allowed and `false` when the budget is exhausted. The
 *     dev fallback (binding undefined) returns `true` so local `vitest`
 *     and `wrangler dev` don't break — production always has the binding
 *     bound per `wrangler.jsonc`.
 *
 * The rate-limit budget itself (60/60s today) is configured at the binding
 * level in `wrangler.jsonc`, not here, so operators can tune it without a
 * code change. The block-key conventions (`rate_limiting`, `binding`)
 * match `packages/api/wrangler.jsonc:44`.
 *
 * Why no DO-backed limiter? Per the connector-store plan's K.T.D.
 * "Rate-limit split": Workers Rate Limiting handles the authenticated tool
 * surface, zone-level WAF Rate Limiting Rules handle anonymous endpoints
 * (`/register`, `/authorize`, `/token`). A DO-backed limiter would add a
 * cold-start tax + a single-region bottleneck for marginal benefit in v1.
 */

import type { Env } from './types';

/**
 * Build the canonical per-user/per-tool rate-limit key.
 *
 * Shape: `${userId}:${toolName}`. Independent counters per (user, tool)
 * pair — one user spamming `packrat_get_pack` doesn't starve their own
 * `packrat_list_trips` budget, and two users hitting the same tool don't
 * share a counter.
 *
 * An empty `userId` (legacy bearer-flow tokens that bypass OAuth props)
 * collapses to `:${toolName}` — effectively a per-tool global counter for
 * that one slot. Acceptable: the bearer-flow path is the rare back-compat
 * surface; the modern OAuth flow always populates `userId`.
 */
export function toolRateLimitKey(userId: string, toolName: string): string {
  return `${userId}:${toolName}`;
}

/**
 * Canonical key shape for the /login POST rate limit.
 *
 * Prefers `cf-connecting-ip`; falls back to `cf-ray` (every Cloudflare
 * request has one, so the key is never empty even when an IP can't be
 * resolved). Without the `cf-ray` fallback, missing-IP requests would all
 * collapse to one global counter and effectively DOS legitimate users
 * during a Cloudflare-side IP-header glitch.
 *
 * Exposed separately from the tool key shape so the two surfaces never
 * collide in the binding's namespace (`login:` prefix vs. `${userId}:`).
 */
export function loginRateLimitKey(ipOrRay: string): string {
  return `login:${ipOrRay}`;
}

/**
 * Call the rate-limit binding and return whether the request is allowed.
 *
 * Returns `true` (allowed) when:
 *   - `env.MCP_TOOLS_RL` is undefined — the dev fallback. Local vitest and
 *     `wrangler dev` runs without a bound rate-limit namespace must not
 *     fail closed; production deploys always bind it via `wrangler.jsonc`.
 *   - The binding returned `{ success: true }`.
 *
 * Returns `false` (rate-limited) when the binding returned
 * `{ success: false }`.
 *
 * Never throws: a binding-side failure surfaces as `true` (fail-open) so
 * a rate-limit infrastructure outage doesn't black-hole legitimate
 * requests. The trade-off is intentional — a brief over-allow window is
 * preferable to a hard outage when the limiter itself is down.
 */
export async function checkRateLimit(env: Env, key: string): Promise<boolean> {
  const binding = env.MCP_TOOLS_RL;
  if (!binding) return true;
  try {
    const { success } = await binding.limit({ key });
    return success;
  } catch {
    // Fail-open on binding errors. The alternative (fail-closed) would
    // turn a transient Cloudflare-side rate-limit-API hiccup into a
    // global outage of the MCP surface. U15 will add structured
    // observability so we can alert on the error volume.
    return true;
  }
}
