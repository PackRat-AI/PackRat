# PackRat MCP — operator docs

Internal-facing docs for the PackRat MCP Worker (`packages/mcp`). User-facing
docs live at [packratai.com/mcp](https://packratai.com/mcp) and inside
`packages/mcp/README.md`.

- [runbook.md](./runbook.md) — deploy, secret rotation, DNS setup, JWKS
  rotation, R11 dev verification, common operations
- [submission-packet.md](./submission-packet.md) — the artifacts assembled for
  Anthropic's Claude Connector Store submission form (added in U18)
- [better-auth-oauth-provider-spike-2026-05-25.md](./better-auth-oauth-provider-spike-2026-05-25.md) — empirical verification that backed the consolidation refactor
- [adr-0001-oauth-provider-vs-mcp-plugin.md](./adr-0001-oauth-provider-vs-mcp-plugin.md) — why we chose `@better-auth/oauth-provider` over the bundled `mcp()` plugin

## Architecture at a glance

Post-refactor (2026-05-25), the MCP worker is a **pure protected resource**.
The OAuth authorization server lives on `api.packrat.world` via
`@better-auth/oauth-provider`; the MCP worker validates JWT access tokens
locally against the AS's JWKS.

- **Worker name (prod):** `packrat-mcp` → `mcp.packratai.com`
- **Worker name (dev):** `packrat-mcp-dev` → `*.workers.dev`
- **Transport:** Streamable HTTP at `/mcp`
- **Auth posture:** Pure protected resource. OAuth 2.1 + PKCE S256 + RFC 8707
  audience binding are enforced by the AS on `api.packrat.world`; the MCP
  worker only validates JWTs.
- **Authorization server:** `api.packrat.world`, hosted by
  `@better-auth/oauth-provider` (inside `packages/api`). The AS owns all
  client / grant / token state in the API's Postgres + `AUTH_KV`.
- **JWT validation:** `packages/mcp/src/token-verify.ts` —
  `verifyMcpToken` fetches and caches the JWKS from
  `${PACKRAT_API_URL}/api/auth/jwks` (60s SWR cache, single-retry on
  stale `kid`).
- **Discovery chain:** PRM on the MCP (`/.well-known/oauth-protected-resource`)
  → `authorization_servers: [https://api.packrat.world]` → AS metadata on
  the API (`/.well-known/oauth-authorization-server`) → OAuth flow on the
  API origin.
- **State:** Durable Object (`PackRatMCP`, sqlite-backed) per MCP session.
  No KV on the MCP worker — `OAUTH_KV` is gone.
- **Refactor plan:** [docs/plans/2026-05-25-001-refactor-mcp-auth-onto-better-auth-plan.md](../plans/2026-05-25-001-refactor-mcp-auth-onto-better-auth-plan.md)
- **Connector-store readiness plan (the tool/resource surface):** [docs/plans/2026-05-22-001-feat-mcp-connector-store-readiness-plan.md](../plans/2026-05-22-001-feat-mcp-connector-store-readiness-plan.md)
