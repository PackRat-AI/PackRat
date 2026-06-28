/**
 * RFC 9728 metadata for the PackRat MCP Worker (a pure protected resource).
 *
 * After U3+U4, the MCP worker is **not** an Authorization Server — it only
 * serves `/.well-known/oauth-protected-resource` from this module. The
 * matching `/.well-known/oauth-authorization-server` document is served
 * by the API worker (`api.packrat.world`) via `@better-auth/oauth-provider`
 * (configured in `packages/api/src/auth/index.ts`).
 *
 * The `authorization_servers` value points at the API worker's issuer URL
 * (derived from `env.PACKRAT_API_URL`, matching the JWT `iss` claim that
 * `verifyMcpToken` validates). Claude follows this pointer to discover the
 * AS metadata + endpoints (authorize, token, register, jwks) and then mints
 * tokens against THAT origin; tokens come back with `aud = canonicalResourceUrl`
 * which the verifier on this worker requires.
 *
 * The three scope strings here are the v1 listing surface (per the
 * connector-readiness plan).
 */

import { safeJsonStringify } from '@packrat/utils';
import { ServiceMeta } from './constants';
import type { Env } from './types';

/** All OAuth scopes the MCP server supports. */
export const SCOPES_SUPPORTED = ['mcp:read', 'mcp:write', 'mcp:admin'] as const;

export type Scope = (typeof SCOPES_SUPPORTED)[number];

/**
 * Strip a trailing slash from a base URL. Hoisted so the regex literal isn't
 * re-allocated on every call (Biome lint/performance/useTopLevelRegex).
 */
const TRAILING_SLASH = /\/$/;

/**
 * Build the body of `/.well-known/oauth-protected-resource`.
 *
 * The resource identifier is pinned to the production MCP custom domain.
 * Even in dev environments (where the request origin is *.workers.dev),
 * tokens are bound to this stable identifier — Claude-side audience checks
 * compare against the metadata, not the request URL.
 */
export function buildResourceMetadata(env: Env) {
  const resourceUrl = canonicalResourceUrl(env);
  return {
    resource: resourceUrl,
    authorization_servers: [authorizationServerUrl(env)],
    scopes_supported: [...SCOPES_SUPPORTED],
    bearer_methods_supported: ['header'] as const,
    resource_name: 'PackRat MCP',
  };
}

/**
 * The canonical `resource` URL advertised in protected-resource metadata AND
 * used as the JWT `aud` claim by `verifyMcpToken`. The two must stay in sync:
 * the AS mints tokens with `aud` equal to the `resource` value the client
 * sends in its token request, which it reads from the metadata document here.
 *
 * In local dev (`MCP_PUBLIC_URL` is set in `.dev.vars`), we derive the
 * resource from the local base URL so MCP Inspector's resource-match
 * validation passes and the locally-issued JWT audience matches the verifier.
 *
 * In production (`MCP_PUBLIC_URL` absent), hard-pin to the canonical custom
 * domain. Do NOT fall back to the request origin — if the Workers.dev hostname
 * ever appears here it will diverge from every token already issued against
 * the custom domain.
 */
export function canonicalResourceUrl(env: Env): string {
  if (env.MCP_PUBLIC_URL) {
    const base = env.MCP_PUBLIC_URL.replace(TRAILING_SLASH, '');
    return `${base}/mcp`;
  }
  return 'https://mcp.packratai.com/mcp';
}

/**
 * The canonical authorization-server URL. After U3+U4 this points at the
 * API worker — the AS is hosted there via Better Auth, NOT on this worker.
 *
 * Derived from `env.PACKRAT_API_URL` so it stays in lockstep with the JWT
 * `iss` claim the U2 verifier enforces (see `getIssuerUrl` in
 * `token-verify.ts`). Both must be the exact same string for the discovery
 * chain `oauth-protected-resource → oauth-authorization-server → token mint`
 * to terminate at a JWT whose `iss` matches what `jose.jwtVerify` expects.
 *
 * Trailing slash stripped because JWT `iss` is byte-for-byte compared and
 * Better Auth's plugin emits the issuer without one.
 */
export function authorizationServerUrl(env: Env): string {
  const base = env.PACKRAT_API_URL ?? '';
  return base.replace(TRAILING_SLASH, '');
}

/**
 * Build the `WWW-Authenticate` header value for a 401 response from a
 * protected resource endpoint, per RFC 9728 §5.1.
 *
 * Includes `resource_metadata=...` so MCP clients can discover the AS
 * configuration on first encounter, and `scope=...` so they can ask for
 * exactly the right scopes on the subsequent auth flow.
 *
 * The `resource_metadata` URL points at THIS worker's protected-resource
 * document — Claude reads that, follows `authorization_servers[0]` to the
 * API worker, fetches `.well-known/oauth-authorization-server` from there,
 * and proceeds with the authorization-code flow against the API worker.
 */
export function buildWwwAuthenticateHeader({
  env,
  scope = 'mcp:read',
}: {
  env: Env;
  scope?: Scope;
}): string {
  const base = (env.MCP_PUBLIC_URL ?? 'https://mcp.packratai.com').replace(TRAILING_SLASH, '');
  const metadataUrl = `${base}/.well-known/oauth-protected-resource`;
  return `Bearer resource_metadata="${metadataUrl}", scope="${scope}"`;
}

/**
 * Returns the `error: invalid_token` JSON body and a `WWW-Authenticate`
 * header for a 401 response from /mcp — convenience wrapper so the
 * outer fetch wrapper in index.ts doesn't have to reach into raw header
 * shapes.
 */
export function unauthorizedResponse({
  env,
  message = 'Missing or invalid bearer token',
}: {
  env: Env;
  message?: string;
}): Response {
  return new Response(safeJsonStringify({ error: 'invalid_token', error_description: message }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': buildWwwAuthenticateHeader({ env }),
    },
  });
}

/** Re-export ServiceMeta so consumers can declare a single import surface. */
export { ServiceMeta };
