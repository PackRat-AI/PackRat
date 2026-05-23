/**
 * RFC 9728 + RFC 8414 metadata wiring for the PackRat MCP Worker.
 *
 * `@cloudflare/workers-oauth-provider` auto-emits both
 * `/.well-known/oauth-authorization-server` (RFC 8414) and
 * `/.well-known/oauth-protected-resource` (RFC 9728). We override the
 * protected-resource metadata so the `resource` URL matches our custom
 * domain (`mcp.packratai.com`) instead of the request origin — Claude
 * verifies token audience against this exact string and any mismatch
 * silently breaks discovery.
 *
 * The four scope strings here are the v1 listing surface (per the
 * connector-readiness plan). They are also passed to OAuthProvider's
 * top-level `scopesSupported` so the AS metadata advertises them.
 */

import { ServiceMeta } from './constants';
import type { Env } from './types';

/** All OAuth scopes the MCP server supports. */
export const SCOPES_SUPPORTED = [
  'mcp', // umbrella scope for back-compat with pre-split clients
  'mcp:read',
  'mcp:write',
  'mcp:admin',
] as const;

export type Scope = (typeof SCOPES_SUPPORTED)[number];

/**
 * Build the `resourceMetadata` option passed to `new OAuthProvider({...})`.
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
 * The canonical `resource` URL advertised in protected-resource metadata.
 *
 * Currently hard-pinned to production. If we later need a per-env
 * identifier (e.g. an env-specific staging hostname), thread an env var
 * (e.g. `MCP_PUBLIC_URL`) through and read it here. Don't fall back to the
 * request origin — Claude-side audience verification breaks the moment
 * the metadata's `resource` value diverges from the value bound into
 * issued access tokens.
 */
export function canonicalResourceUrl(_env: Env): string {
  return 'https://mcp.packratai.com/mcp';
}

/**
 * The canonical authorization-server URL — same hostname as the resource,
 * since this Worker is both the MCP server and the AS.
 */
export function authorizationServerUrl(_env: Env): string {
  return 'https://mcp.packratai.com';
}

/**
 * Build the `WWW-Authenticate` header value for a 401 response from a
 * protected resource endpoint, per RFC 9728 §5.1.
 *
 * Includes `resource_metadata=...` so MCP clients can discover the AS
 * configuration on first encounter, and `scope=...` so they can ask for
 * exactly the right scopes on the subsequent auth flow.
 */
export function buildWwwAuthenticateHeader(env: Env, scope: Scope = 'mcp'): string {
  const metadataUrl = `${authorizationServerUrl(env)}/.well-known/oauth-protected-resource`;
  return `Bearer resource_metadata="${metadataUrl}", scope="${scope}"`;
}

/**
 * Returns the `error: invalid_token` JSON body and a `WWW-Authenticate`
 * header for a 401 response from /mcp — convenience wrapper so the
 * apiHandler in index.ts doesn't have to reach into raw header shapes.
 */
export function unauthorizedResponse(env: Env, message = 'Missing or invalid bearer token'): Response {
  return new Response(
    JSON.stringify({ error: 'invalid_token', error_description: message }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': buildWwwAuthenticateHeader(env),
      },
    },
  );
}

/** Re-export ServiceMeta so consumers can declare a single import surface. */
export { ServiceMeta };
