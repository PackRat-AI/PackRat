/**
 * JWT access-token verification for the PackRat MCP Worker (U2 of the
 * Better Auth OAuth consolidation refactor).
 *
 * Background:
 *   After U1 the API worker (api.packrat.world) is a full OAuth 2.1
 *   Authorization Server via `@better-auth/oauth-provider`, issuing JWT
 *   access tokens signed via Better Auth's `jwt()` plugin. The JWKS is
 *   served at `${PACKRAT_API_URL}/api/auth/jwks`.
 *
 *   This module is the protected-resource validation surface — the U3
 *   outer fetch wrapper will call `verifyMcpToken(...)` on every `/mcp`
 *   call to gate access. The MCP worker never holds the signing keys,
 *   never round-trips to the AS for introspection — it verifies tokens
 *   locally against the cached JWKS.
 *
 * Contract: `verifyMcpToken` returns `null` on ANY failure and NEVER
 *   throws. The caller maps `null` → 401 + `WWW-Authenticate`. Throwing
 *   instead of returning `null` would surface as a 500 from the outer
 *   fetch wrapper, breaking Claude.ai's discovery-retry loop which only
 *   re-fetches `/.well-known/oauth-protected-resource` on 401 (see
 *   better-auth#9654 — raw `jose` errors must not bubble).
 *
 * Stale-while-revalidate:
 *   `jose.createRemoteJWKSet` ships with an in-process cache governed by
 *   `cacheMaxAge` (max time since last successful fetch) and
 *   `cooldownDuration` (min time between fetches). Per doc-review
 *   SEC-005, `cacheMaxAge` is tightened to 60s (was 10min in the
 *   original plan) so JWKS rotation propagates fleet-wide within ~1min
 *   even if a single isolate stays warm.
 *
 *   On `JWSSignatureVerificationFailed` (unknown `kid` — possibly because
 *   the cache is stale after rotation), we force-refresh via
 *   `jwks.reload()` and retry verification exactly once. On the second
 *   failure we return `null`. This matches the April migration plan's
 *   "stale-while-revalidate, single-retry-on-stale-kid" commitment.
 *
 * Cross-isolate caching deferred:
 *   doc-review SEC-005 asked whether `caches.default` should back the
 *   JWKS document for cross-isolate cache coherence (so that a JWKS
 *   rotation purges fleet-wide rather than per-isolate). Decision: stick
 *   with `jose`'s per-isolate cache for U2. The 60s in-process TTL
 *   bounds the worst-case staleness; cross-isolate cache adds complexity
 *   (cache-key versioning on rotation, race conditions on first-fetch)
 *   that isn't justified until JWKS rotation latency is shown to be an
 *   operational concern.
 */

import { isString } from '@packrat/guards';
import { createRemoteJWKSet, errors, jwtVerify } from 'jose';
import { canonicalResourceUrl } from './metadata';
import type { Env } from './types';

/**
 * Strip a trailing slash from a base URL. Hoisted so the regex literal
 * isn't re-allocated on every request (Biome lint/performance/useTopLevelRegex).
 */
const TRAILING_SLASH = /\/$/;
/** Whitespace split used for RFC 6749 §3.3 scope-claim tokenization. */
const SCOPE_SPLIT = /\s+/;

/** Shape returned to the U3 outer fetch wrapper. */
export interface VerifiedToken {
  /** PackRat user ID (JWT `sub` claim). */
  sub: string;
  /** Granted OAuth scopes (split from the space-separated `scope` claim per RFC 6749 §3.3). */
  scopes: string[];
  /**
   * The raw JWT — forwarded to the PackRat API as a Bearer credential for
   * proxied tool calls. Surfaces as `Props.betterAuthToken` to keep the
   * existing `packages/mcp/src/client.ts` plumbing unchanged.
   */
  token: string;
}

/**
 * Per-isolate JWKS cache, keyed by issuer URL so a dev / prod swap in a
 * single warm isolate (vitest test, local dev reload) doesn't reuse a
 * stale set. In production each isolate sees exactly one `PACKRAT_API_URL`,
 * so this is effectively a singleton.
 */
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(issuerUrl: string): ReturnType<typeof createRemoteJWKSet> {
  const cached = jwksCache.get(issuerUrl);
  if (cached) return cached;

  // 60s TTL per SEC-005. `cooldownDuration` default (30s) is fine — it's
  // the minimum time between unforced fetches and bounds DDoS pressure on
  // /api/auth/jwks if an attacker spams unknown-`kid` tokens.
  const jwks = createRemoteJWKSet(new URL(`${issuerUrl}/api/auth/jwks`), {
    cacheMaxAge: 60_000,
  });
  jwksCache.set(issuerUrl, jwks);
  return jwks;
}

/** Test-only escape hatch — lets vitest reset the per-isolate cache between mocks. */
export function __resetJwksCacheForTests(): void {
  jwksCache.clear();
}

/**
 * Resolve the OAuth issuer URL the AS metadata advertises.
 *
 * Sourced from `env.PACKRAT_API_URL` to match U1's `auth/index.ts`
 * config: `betterAuth({ baseURL: env.PACKRAT_API_URL })`. Both workers
 * read the same env var name (post-2026-05-25 rename — the API used to
 * call this BETTER_AUTH_URL; both names point at the api worker —
 * `https://api.packrat.world` in prod,
 * `http://localhost:8787` in dev). Better Auth's `oauthProvider` plugin
 * defaults the `issuer` claim and AS metadata `issuer` field to
 * `ctx.context.baseURL`, so deriving from `PACKRAT_API_URL` keeps the
 * two workers in lockstep without adding another env var.
 */
function getIssuerUrl(env: Env): string {
  // Strip a trailing slash so the issuer is canonical — JWT `iss` is
  // string-compared verbatim, and Better Auth doesn't append one.
  return env.PACKRAT_API_URL.replace(TRAILING_SLASH, '');
}

/**
 * Options for `verifyMcpToken`. Bundled into an object (rather than three
 * positional args) so the function obeys the project's Biome
 * `useMaxParams: 2` rule and so the U3 outer fetch wrapper has a single
 * stable call-site shape.
 */
export interface VerifyOpts {
  env: Env;
  ctx: ExecutionContext;
}

/**
 * Verify a JWT access token against the Better Auth JWKS.
 *
 * @returns `{ sub, scopes, token }` on success, `null` on ANY failure.
 *          Never throws — caller maps `null` to a 401 + WWW-Authenticate.
 */
export async function verifyMcpToken(
  token: string,
  opts: VerifyOpts,
): Promise<VerifiedToken | null> {
  // Fail fast on obviously-bad inputs so the caller doesn't pay the
  // JWKS-fetch cost. `jose.jwtVerify` would catch these too, but the
  // try/catch + retry below is wasted work for an empty string.
  if (!token || !isString(token)) return null;

  const issuer = getIssuerUrl(opts.env);
  const audience = canonicalResourceUrl(opts.env); // 'https://mcp.packratai.com/mcp'
  const jwks = getJwks(issuer);
  const verifyArgs = { jwks, issuer, audience };

  try {
    return await verifyOnce(token, verifyArgs);
  } catch (err) {
    // Stale-while-revalidate retry. A signature failure is most often
    // caused by the JWKS cache missing a freshly-rotated `kid`. We force
    // a refresh and retry exactly once; on a second failure we give up
    // and return `null` (the token genuinely doesn't validate).
    if (err instanceof errors.JWSSignatureVerificationFailed) {
      try {
        // `jwks.reload()` returns a Promise; we await it because the
        // retry must use the freshly-fetched keys synchronously. The
        // `opts.ctx` is available if a future tweak wants to fire a
        // background refresh via `waitUntil` instead.
        await jwks.reload();
        return await verifyOnce(token, verifyArgs);
      } catch {
        return null;
      }
    }
    // Every other jose error (expired, wrong iss/aud, malformed JWT,
    // algorithm not allowed, claim validation failed, JWKS fetch
    // network error, ...) maps to `null`. Also catches the
    // unexpected-throw regression from better-auth#9654.
    return null;
  }
}

/**
 * Single verification pass. Extracted so the SWR retry path can reuse it
 * without duplicating the option set or scope-parsing logic.
 */
interface VerifyOnceArgs {
  jwks: ReturnType<typeof createRemoteJWKSet>;
  issuer: string;
  audience: string;
}

async function verifyOnce(token: string, args: VerifyOnceArgs): Promise<VerifiedToken> {
  const { payload } = await jwtVerify(token, args.jwks, {
    issuer: args.issuer,
    audience: args.audience,
    // Algorithm allowlist — defends against `alg: none` and HS256-with-
    // public-key confusion attacks. Better Auth's `jwt()` plugin signs
    // with ES256 by default; RS256 is supported as a future migration
    // path. Anything else (HS*, EdDSA, PS*) is rejected here even if a
    // JWKS key happens to advertise that alg.
    algorithms: ['ES256', 'RS256'],
  });

  const sub = isString(payload.sub) ? payload.sub : '';
  // `sub` is required by RFC 7519 for an access token to be useful here
  // (rate-limit key, audit log actor). A token without it is rejected —
  // the upstream JWT plugin sets it from `user.id`, so absence means
  // something is wrong.
  if (!sub) {
    throw new errors.JWTClaimValidationFailed('missing sub claim', payload, 'sub', 'invalid');
  }

  return {
    sub,
    scopes: parseScopeClaim(payload.scope),
    token,
  };
}

/**
 * Parse RFC 6749 §3.3 scope claim: a space-separated string of scope
 * tokens. Tolerates multiple-space separators and trims surrounding
 * whitespace. Returns `[]` for missing/empty/non-string claims —
 * fail-closed (the U3 scope filter will then hide every tool, so an
 * empty-scope token effectively grants nothing).
 */
function parseScopeClaim(claim: unknown): string[] {
  if (!isString(claim)) return [];
  const trimmed = claim.trim();
  if (!trimmed) return [];
  return trimmed.split(SCOPE_SPLIT);
}
