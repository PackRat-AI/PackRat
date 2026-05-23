# PackRat MCP — operator docs

Internal-facing docs for the PackRat MCP Worker (`packages/mcp`). User-facing
docs live at [packratai.com/mcp](https://packratai.com/mcp) and inside
`packages/mcp/README.md`.

- [runbook.md](./runbook.md) — deploy, secret rotation, KV/DNS setup, common
  operations
- [submission-packet.md](./submission-packet.md) — the artifacts assembled for
  Anthropic's Claude Connector Store submission form (added in U18)

## Architecture at a glance

- **Worker name (prod):** `packrat-mcp` → `mcp.packratai.com`
- **Worker name (dev):** `packrat-mcp-dev` → `*.workers.dev`
- **Transport:** Streamable HTTP at `/mcp`
- **Auth:** OAuth 2.1 + PKCE S256 + RFC 8707 audience binding, served by
  `@cloudflare/workers-oauth-provider`
- **Identity provider:** Better Auth (lives in `packages/api`)
- **State:** Durable Object (`PackRatMCP`, sqlite-backed) per session +
  `OAUTH_KV` for OAuth tokens and intermediate state
- **Implementation plan:** [docs/plans/2026-05-22-001-feat-mcp-connector-store-readiness-plan.md](../plans/2026-05-22-001-feat-mcp-connector-store-readiness-plan.md)
