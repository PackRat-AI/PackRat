import { describe, expect, it } from 'vitest';
import {
  authorizationServerUrl,
  buildResourceMetadata,
  buildWwwAuthenticateHeader,
  canonicalResourceUrl,
  SCOPES_SUPPORTED,
  unauthorizedResponse,
} from '../metadata';
import type { Env } from '../types';

// After U3+U4 the `authorization_servers` value derives from
// `env.PACKRAT_API_URL` (the API worker hosts the AS via Better Auth). The
// resource URL is still env-invariant. We pin PACKRAT_API_URL to the prod
// hostname here so the assertions below stay readable.
const env = { PACKRAT_API_URL: 'https://api.packrat.world' } as Env;

describe('SCOPES_SUPPORTED', () => {
  it('declares the three v1 connector-store scopes', () => {
    expect(SCOPES_SUPPORTED).toEqual(['mcp:read', 'mcp:write', 'mcp:admin']);
  });

  it('has no duplicates', () => {
    expect(new Set(SCOPES_SUPPORTED).size).toBe(SCOPES_SUPPORTED.length);
  });
});

describe('canonicalResourceUrl', () => {
  it('pins to the production MCP custom domain regardless of env', () => {
    // Pinning is intentional — Claude verifies token audience against this
    // exact string; falling back to the request origin (the OAuth provider's
    // default) silently breaks discovery when the dev *.workers.dev hostname
    // differs from the issued-token audience.
    expect(canonicalResourceUrl(env)).toBe('https://mcp.packratai.com/mcp');
  });
});

describe('authorizationServerUrl', () => {
  it('points at the API worker (the AS is hosted there via Better Auth)', () => {
    // After U3+U4 the MCP worker is a pure protected resource; the AS lives
    // at the API worker, and the value here must match the JWT `iss` claim
    // that `verifyMcpToken` validates (also derived from PACKRAT_API_URL).
    expect(authorizationServerUrl(env)).toBe('https://api.packrat.world');
  });

  it('strips a trailing slash so it matches the canonical JWT `iss` claim', () => {
    const slashed = { PACKRAT_API_URL: 'https://api.packrat.world/' } as Env;
    expect(authorizationServerUrl(slashed)).toBe('https://api.packrat.world');
  });

  it('falls back to an empty string when PACKRAT_API_URL is unset', () => {
    // Defensive `?? ''` guard: a missing binding (e.g. an unconfigured dev
    // env) must not crash the metadata builder — it yields an empty issuer
    // rather than throwing on `undefined.replace(...)`.
    const missing = {} as Env;
    expect(authorizationServerUrl(missing)).toBe('');
  });

  it('returns an empty string verbatim when PACKRAT_API_URL is an empty string', () => {
    // The `?? ''` nullish coalesce does NOT fire for a defined-but-empty
    // value: an explicit `''` flows through the left arm and the trailing
    // -slash `.replace` is a no-op, so the result is still the empty issuer.
    const empty = { PACKRAT_API_URL: '' } as Env;
    expect(authorizationServerUrl(empty)).toBe('');
  });

  it('explicitly distinguishes a null binding (right arm of ?? ) from a URL', () => {
    // A `null` binding (not just `undefined`) also takes the `?? ''` arm —
    // pinned so a runtime that hands back `null` instead of `undefined`
    // still degrades to an empty issuer rather than throwing.
    const nulled = { PACKRAT_API_URL: null } as unknown as Env;
    expect(authorizationServerUrl(nulled)).toBe('');
  });
});

describe('buildResourceMetadata', () => {
  it('returns a complete RFC 9728 metadata object', () => {
    const meta = buildResourceMetadata(env);
    expect(meta.resource).toBe('https://mcp.packratai.com/mcp');
    expect(meta.authorization_servers).toEqual(['https://api.packrat.world']);
    expect(meta.scopes_supported).toEqual([...SCOPES_SUPPORTED]);
    expect(meta.bearer_methods_supported).toEqual(['header']);
    expect(meta.resource_name).toBe('PackRat MCP');
  });
});

describe('buildWwwAuthenticateHeader', () => {
  it('includes resource_metadata pointing at the well-known endpoint', () => {
    const header = buildWwwAuthenticateHeader({ env });
    expect(header).toContain(
      'resource_metadata="https://mcp.packratai.com/.well-known/oauth-protected-resource"',
    );
  });

  it('defaults the scope hint to "mcp:read"', () => {
    expect(buildWwwAuthenticateHeader({ env })).toContain('scope="mcp:read"');
  });

  it('passes through a specific requested scope when provided', () => {
    expect(buildWwwAuthenticateHeader({ env, scope: 'mcp:admin' })).toContain('scope="mcp:admin"');
  });

  it('uses the Bearer auth scheme', () => {
    expect(buildWwwAuthenticateHeader({ env }).startsWith('Bearer ')).toBe(true);
  });
});

describe('unauthorizedResponse', () => {
  it('returns 401 with WWW-Authenticate set', () => {
    const res = unauthorizedResponse({ env });
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toContain('resource_metadata=');
    expect(res.headers.get('Content-Type')).toBe('application/json');
  });

  it('encodes a JSON error body with invalid_token code', async () => {
    const res = unauthorizedResponse({ env });
    const body = (await res.json()) as { error: string; error_description: string };
    expect(body.error).toBe('invalid_token');
    expect(body.error_description).toBe('Missing or invalid bearer token');
  });

  it('passes through a custom error message', async () => {
    const res = unauthorizedResponse({ env, message: 'Token audience mismatch' });
    const body = (await res.json()) as { error_description: string };
    expect(body.error_description).toBe('Token audience mismatch');
  });
});
