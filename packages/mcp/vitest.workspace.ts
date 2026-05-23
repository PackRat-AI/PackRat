/**
 * Vitest workspace for the MCP package (U17).
 *
 * Declares two projects so a single `vitest run` exercises both suites:
 *
 *   - `./vitest.unit.config.ts` — Node-environment unit tests for pure
 *     modules (auth helpers, scopes, output schemas, etc.). Fast; no
 *     workerd.
 *   - `./vitest.integration.config.ts` — Workerd-environment tests using
 *     `@cloudflare/vitest-pool-workers`, which boots the actual Worker
 *     bundle behind a `SELF` fetcher.
 *
 * Filter to one project via `vitest run --project <name>`:
 *   - `bun test:unit`        → `--project mcp-unit`
 *   - `bun test:integration` → `--project mcp-integration`
 *
 * First-invocation note: workerd binary is downloaded on demand
 * (~30s, one-time per machine + version). Subsequent runs are warm.
 */
export default ['./vitest.unit.config.ts', './vitest.integration.config.ts'];
