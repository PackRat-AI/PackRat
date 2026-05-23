/**
 * Live-Worker integration tests for the well-known OAuth metadata endpoints.
 *
 * **Deferred (U17 follow-up):** the test scaffolding is fully wired
 * (`@cloudflare/vitest-pool-workers` is installed; this file's
 * `vitest.integration.config.ts` boots the Worker behind a workerd
 * isolate), but the Worker entrypoint transitively imports the MCP SDK,
 * which loads `ajv@^8` at module-eval time. `ajv` does
 * `require('./refs/data.json')`, and workerd's CJS module-fallback path
 * treats JSON content as JS — crashing with "Unexpected token ':'" the
 * moment anything inside `packages/mcp/src/index.ts` is evaluated.
 *
 * Two viable follow-up fixes:
 *   1. Upstream — ship a vitest-pool-workers patch that registers a
 *      built-in `Text`/`Data` rule for `*.json` files in the workerd
 *      module-fallback loader (currently only `compileModuleRules`
 *      from the user-supplied list runs, and only through the vite
 *      RPC patch — not the workerd-side resolution chain).
 *   2. Local — refactor `PackRatMCP` so the `McpServer` instance can
 *      be constructed with an injected `jsonSchemaValidator` (the SDK
 *      supports it as of v1.20+). A vitest setup file would then bind
 *      a no-op validator for integration tests, bypassing `ajv`
 *      entirely.
 *
 * The metadata module's pure functions (`buildResourceMetadata`,
 * `buildWwwAuthenticateHeader`, `unauthorizedResponse`) are fully
 * covered by `../metadata.test.ts` in the unit suite. Six `it.todo`
 * cases below preserve the contract intent.
 */

import { describe, it } from 'vitest';

describe('well-known endpoints (integration — deferred per U17 follow-up)', () => {
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
    'POST /mcp with an invalid bearer token returns 401 with the same ' + 'WWW-Authenticate shape',
  );

  it.todo(
    'GET /.well-known/oauth-protected-resource from https://claude.ai returns ' +
      'Access-Control-Allow-Origin: https://claude.ai (CORS allowlist — added in U6)',
  );

  it.todo(
    'GET /.well-known/oauth-protected-resource from a non-allowlisted origin does ' +
      'NOT include Access-Control-Allow-Origin (default-deny — U6)',
  );
});
