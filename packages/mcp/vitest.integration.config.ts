import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Integration-test project for the MCP package (U17).
 *
 * **Current state (U17):** the harness is wired but the live tests
 * are deferred. Every file under `src/__tests__/integration/` ships
 * with `it.todo` placeholders explaining the deferral rationale
 * (see `./src/__tests__/integration/well-known.test.ts`).
 *
 * Short version: the Worker entrypoint transitively imports the MCP
 * SDK, which loads `ajv@^8` at module-eval time. `ajv` does
 * `require('./refs/data.json')`, and workerd's CJS module-fallback
 * path treats JSON content as JS — the worker won't boot inside
 * vitest-pool-workers until one of two upstream fixes lands:
 *
 *   1. vitest-pool-workers' `handleModuleFallbackRequest` learns to
 *      apply user-supplied `modulesRules` (currently only applied
 *      via the vite RPC patch, not the workerd resolution chain).
 *   2. The MCP SDK accepts an injected `jsonSchemaValidator` we can
 *      stub in tests — bypassing `ajv` entirely.
 *
 * Until then this config runs as a plain node-environment project
 * over the `it.todo` files so `vitest run` doesn't fall over on
 * "no test files matched" and the test summary keeps a visible
 * deferred-todo count.
 *
 * The future swap to `@cloudflare/vitest-pool-workers` will:
 *   - import `defineWorkersProject` from
 *     `@cloudflare/vitest-pool-workers/config` instead of vitest/config
 *   - point `poolOptions.workers.wrangler.configPath` at `wrangler.jsonc`
 *   - bind `PACKRAT_API_URL` via `miniflare.bindings` so
 *     `verifyMcpToken` can resolve the JWKS endpoint against a local
 *     mock-fetch (or a locally-running API worker)
 *
 * Post-refactor (2026-05-25) the MCP worker is a pure protected resource:
 * no KV binding, no DCR pre-shared bearer. The previously-planned
 * `miniflare.kvNamespaces: ['OAUTH_KV']` and
 * `miniflare.bindings.MCP_INITIAL_ACCESS_TOKEN` stubs are intentionally
 * absent — when the integration tests eventually light up, they'll
 * exercise the JWT-validation path, which doesn't need either binding.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@packrat/api-client': resolve(__dirname, '../api-client/src/index.ts'),
    },
  },
  test: {
    name: 'mcp-integration',
    environment: 'node',
    globals: true,
    include: [resolve(__dirname, 'src/__tests__/integration/**/*.test.ts')],
  },
});
