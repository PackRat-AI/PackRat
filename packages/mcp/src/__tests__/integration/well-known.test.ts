/**
 * Live-Worker integration tests for the well-known OAuth metadata endpoints.
 *
 * Full coverage requires `@cloudflare/vitest-pool-workers` (added in U17).
 * The placeholder cases below describe the contract the integrated tests
 * must enforce — when the vitest-pool-workers harness lands, replace each
 * `it.todo` with the real `SELF.fetch('/...')` assertion.
 *
 * The unit-test surface for the metadata module's pure functions lives in
 * `../metadata.test.ts` and already runs under the node environment.
 */

import { describe, it } from 'vitest';

describe('well-known endpoints (integration — requires vitest-pool-workers)', () => {
  it.todo(
    'GET /.well-known/oauth-protected-resource returns the pinned resource URL, ' +
      'authorization_servers, and the four v1 scopes',
  );

  it.todo(
    'GET /.well-known/oauth-authorization-server advertises ' +
      'code_challenge_methods_supported: ["S256"] — without it, MCP clients ' +
      'refuse to proceed per the 2025-11-25 authorization spec',
  );

  it.todo(
    'GET /.well-known/oauth-authorization-server advertises scopes_supported ' +
      'including all four scopes (mcp, mcp:read, mcp:write, mcp:admin)',
  );

  it.todo(
    'POST /mcp with no Authorization header returns 401 with WWW-Authenticate ' +
      'containing resource_metadata=... and scope=...',
  );

  it.todo(
    'POST /mcp with an invalid bearer token returns 401 with the same ' +
      'WWW-Authenticate shape',
  );

  it.todo(
    'GET /.well-known/oauth-protected-resource from https://claude.ai returns ' +
      'Access-Control-Allow-Origin: https://claude.ai (CORS allowlist — added in U6)',
  );
});
