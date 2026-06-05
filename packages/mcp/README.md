# @packrat/mcp — PackRat MCP Server

PackRat's Model Context Protocol Worker. A thin, OAuth-secured façade over the PackRat API that exposes ~103 typed tools, six resources, and a handful of guided prompts to MCP-capable clients (Claude.ai, Claude Code, MCP Inspector, custom clients).

- **Production transport:** Streamable HTTP at `https://mcp.packratai.com/mcp`
- **OAuth posture:** This worker is a **pure protected resource**. The authorization server (AS) lives on `https://api.packrat.world` via [`@better-auth/oauth-provider`](https://github.com/better-auth/better-auth). Per RFC 8707 every access token is audience-bound to `https://mcp.packratai.com/mcp`.
- **JWT validation:** `verifyMcpToken` ([`src/token-verify.ts`](./src/token-verify.ts)) fetches and caches the JWKS from `${PACKRAT_API_URL}/api/auth/jwks` (60s SWR cache with single-retry on stale `kid`).
- **Runtime:** Cloudflare Workers + Durable Objects, via the [Cloudflare Agents SDK](https://github.com/cloudflare/agents)

Public, user-facing docs live at [packratai.com/mcp](https://packratai.com/mcp). This README is for developers working in `packages/mcp/`.

---

## Architecture (post-refactor, 2026-05-25)

As of the Better Auth OAuth consolidation refactor, the MCP worker no longer hosts an authorization server. The split is:

| Component | Lives on | Owned by |
| --- | --- | --- |
| Authorization server (AS) — `/oauth2/authorize`, `/oauth2/token`, JWKS | `api.packrat.world` | `@better-auth/oauth-provider` plugin |
| Consent / login UI | `api.packrat.world` | Branded consent page on the API |
| OAuth clients / grants / tokens | `api.packrat.world` | Better Auth tables in Postgres |
| Protected resource (MCP) | `mcp.packratai.com` | This worker — validates JWTs only |
| MCP tool / resource / prompt surface | `mcp.packratai.com` | This worker — unchanged from U7–U16 of the prior plan |

### Discovery chain (what Claude.ai does on first connect)

1. Claude POSTs to `https://mcp.packratai.com/mcp` with no `Authorization` header.
2. The MCP worker returns `401 + WWW-Authenticate: Bearer resource_metadata="https://mcp.packratai.com/.well-known/oauth-protected-resource"`.
3. Claude fetches the PRM document; it advertises `authorization_servers: ["https://api.packrat.world"]`.
4. Claude fetches `https://api.packrat.world/.well-known/oauth-authorization-server` (served by Better Auth's plugin) to discover the AS endpoints.
5. Claude opens a browser to the AS's `/oauth2/authorize`; the user signs in and approves the branded consent screen, all on the API origin.
6. Claude receives a JWT (signed by Better Auth) at the token endpoint and redirects back to `claude.ai/api/mcp/auth_callback`.
7. Claude retries the MCP request with `Authorization: Bearer <jwt>`; the MCP worker validates the JWT locally against the JWKS cache and dispatches the tool call.

### Scopes (three, coarse-grained)

| Scope | Grants | Notes |
| --- | --- | --- |
| `mcp:read` | `packrat_get_*`, `packrat_list_*`, `packrat_search_*`, `packrat_find_*`, plus `packrat_whoami` and a few `packrat_extract_*` / `packrat_preview_*` tools | Read-only access. |
| `mcp:write` | read + every create / update / delete / submit / record tool | The default scope Claude.ai requests alongside `mcp:read`. |
| `mcp:admin` | read + write + every `packrat_admin_*` tool + the four explicit overrides (`packrat_execute_sql_query`, `packrat_get_database_schema`, `packrat_generate_pack_template_from_url`, `packrat_create_app_pack_template`) | Granted at consent time only when the user's Better Auth role resolves to `ADMIN`. The MCP also defense-in-depths the check at tool-dispatch time. |

Scope filtering happens in two places: the consent page on `api.packrat.world` filters the scope list shown to the user (and the granted set written into the OAuth grant), and the MCP worker re-checks the `scope` JWT claim before exposing admin tools via `RegisteredTool.disable()` (which auto-emits `notifications/tools/list_changed` so the client view stays in sync).

### Pre-registration of OAuth clients

DCR is disabled at the AS (`allowDynamicClientRegistration: false`). Claude.ai's two callback URLs are seeded into the `oauthClient` table via [`packages/api/src/db/seed-claude-oauth-client.ts`](../api/src/db/seed-claude-oauth-client.ts) (run with `cd packages/api && bun run db:seed:oauth-clients`). The script is idempotent (re-runs are no-ops) and is the only registration path.

---

## Quick orientation

| What you want | Where it lives |
| --- | --- |
| Worker entrypoint (outer fetch dispatcher: well-known, /health, /status, /favicon.ico, /mcp → JWT-validate → DO) | [`src/index.ts`](./src/index.ts) |
| JWT validation + JWKS cache | [`src/token-verify.ts`](./src/token-verify.ts) |
| /health + /status handlers + PUBLIC_LINKS | [`src/auth.ts`](./src/auth.ts) |
| Tool surface (~103 tools, 18 files) | [`src/tools/*.ts`](./src/tools) |
| Resources (`packrat://...`) | [`src/resources.ts`](./src/resources.ts) |
| Prompts (guided multi-turn flows) | [`src/prompts.ts`](./src/prompts.ts) |
| Scope model + tool gating | [`src/scopes.ts`](./src/scopes.ts) |
| RFC 9728 protected-resource metadata | [`src/metadata.ts`](./src/metadata.ts) |
| CORS allowlist (Claude origins on /.well-known/*) | [`src/cors.ts`](./src/cors.ts) |
| Output envelope + pagination helpers | [`src/client.ts`](./src/client.ts) |
| Elicitations (destructive admin tools) | [`src/elicit.ts`](./src/elicit.ts) |
| Glossary resource content | [`src/glossary.ts`](./src/glossary.ts) |
| Embedded favicon (Anthropic domain-ownership probe) | [`src/favicon.ts`](./src/favicon.ts) |
| Tests | [`src/__tests__/`](./src/__tests__) |
| One-shot scripts (catalog dump, submission-readiness probe) | [`scripts/`](./scripts) |
| Operator runbook | [`../../docs/mcp/runbook.md`](../../docs/mcp/runbook.md) |
| Consolidation-refactor plan | [`../../docs/plans/2026-05-25-001-refactor-mcp-auth-onto-better-auth-plan.md`](../../docs/plans/2026-05-25-001-refactor-mcp-auth-onto-better-auth-plan.md) |
| Connector-store readiness plan (the surface this worker exposes) | [`../../docs/plans/2026-05-22-001-feat-mcp-connector-store-readiness-plan.md`](../../docs/plans/2026-05-22-001-feat-mcp-connector-store-readiness-plan.md) |

The high-level architecture (DO-backed `McpAgent` + JWT-validating outer fetch + Eden Treaty client to the PackRat API) is summarised in `src/index.ts`'s top-of-file docstring.

---

## Local development

### 1. Install

From the repo root (Bun is the workspace package manager):

```bash
bun install
```

### 2. Configure secrets

Copy the example dev vars and fill them in:

```bash
cp packages/mcp/.dev.vars.example packages/mcp/.dev.vars
```

Required:

| Variable | Notes |
| --- | --- |
| `PACKRAT_API_URL` | The PackRat API base (which is also the AS host). `http://localhost:8787` if you also run `bun api`. Used by `token-verify.ts` to fetch the JWKS at `${PACKRAT_API_URL}/api/auth/jwks`. |

Optional:

| Variable | Notes |
| --- | --- |
| `MCP_FEATURE_FLAGS` | Comma-separated flags toggled at boot (e.g. `wildlife_id,season_suggestions`). |
| `SENTRY_DSN` | Sentry DSN (U15). |
| `CF_VERSION_METADATA` | Cloudflare `version_metadata` binding (wrangler.jsonc). Runtime-injected `{ id, tag, timestamp }`; `/status` surfaces `id` as `deployId`. No deploy-time var or CI step needed. |

No KV bindings are required. The worker is stateless apart from its Durable Object for MCP session continuity.

### 3. Run the Worker

```bash
cd packages/mcp
bun run dev
```

That binds the worker to a local URL printed by wrangler. `/.well-known/oauth-protected-resource` returns the PRM document (advertising the AS on `${PACKRAT_API_URL}`); `/health` returns the version + legal URLs; `/mcp` requires a valid JWT (validated against the JWKS on `${PACKRAT_API_URL}/api/auth/jwks`).

### 4. Verify discovery

```bash
# Replace <local-url> with what `bun run dev` printed:
curl -s http://localhost:8788/.well-known/oauth-protected-resource | jq
# Expect: { resource: "https://mcp.packratai.com/mcp",
#          authorization_servers: ["http://localhost:8787" (or PACKRAT_API_URL)],
#          scopes_supported: [...], ... }

# The AS metadata lives on the API, not on the MCP — fetch it from the API host:
curl -s http://localhost:8787/.well-known/oauth-authorization-server | jq '.code_challenge_methods_supported'
# Expect: ["S256"]
```

For a full client-side OAuth round-trip, point [MCP Inspector](https://github.com/modelcontextprotocol/inspector) at your local URL:

```bash
bunx @modelcontextprotocol/inspector --transport streamable-http --server-url http://localhost:8788/mcp
```

The inspector will discover the PRM, follow the `authorization_servers` link to the AS metadata on the API host, walk through the OAuth flow against your local Better Auth instance, and surface every tool, resource, and prompt the connector exposes.

---

## Tests

```bash
cd packages/mcp
bun run test        # one-shot
bun run test:watch  # watch mode
```

The unit suite covers JWT validation + JWKS cache, the /health + /status handlers, the well-known metadata document, tool annotation invariants (the U7 catalog test enumerates every registered tool), the scope-gating contract, resources, output envelopes, elicitations, and the embedded favicon. Integration tests against `@cloudflare/vitest-pool-workers` are deferred as `it.todo` placeholders pending an upstream ajv module-resolution fix (see [`docs/mcp/runbook.md`](../../docs/mcp/runbook.md) § "vitest-pool-workers integration suite — current state").

> `bun run check-types` is intentionally not run as part of the local default loop. The MCP SDK's type surface plus our own types are large enough that `tsc --noEmit` OOMs on workstations with under ~16 GB RAM. Run it locally with `NODE_OPTIONS=--max-old-space-size=16384` if you need it; the CI pipeline (U17) is the authoritative type-check.

---

## Tool surface (catalog overview)

The current surface is ~103 user-callable tools across these domains:

| Domain | What it covers |
| --- | --- |
| **Account** | `packrat_whoami`, `packrat_get_profile`, `packrat_update_profile`. |
| **Packs** | List/get/create/update/delete packs and pack items; record pack weights; analyze pack composition. |
| **Pack Templates** | Personal templates (user) and app-curated templates (admin-only via `packrat_create_app_pack_template`). |
| **Trips** | List/get/create/update/delete trips. |
| **Trails** | OSM-backed trail search, get, get-geometry; AllTrails URL preview. |
| **Trail Conditions** | List, submit, update, delete trail-condition reports. |
| **Weather** | Current conditions + forecast lookups by name or coordinates. |
| **Gear & Catalog** | Text + semantic gear catalog search; item comparison; visual gear identification via images. |
| **Knowledge & Search** | Open-world web search; extract content from arbitrary URLs. |
| **Feed** | Post, comment, like/unlike on the community feed. |
| **Guides** | Static guides surface — categories, list, get. |
| **Seasons** | Season-based gear suggestions. |
| **Wildlife** | Visual wildlife identification. |
| **Uploads** | Server-side upload registration. |
| **Admin & Analytics** | User management, content moderation, ETL operations, analytics dashboards. Gated on `mcp:admin`. |
| **Database (Admin)** | `packrat_execute_sql_query` + `packrat_get_database_schema`. Explicit-admin overrides because their names don't match the admin prefix. |

For the live, machine-readable catalog with annotations + scope classification, run:

```bash
bun packages/mcp/scripts/dump-catalog.ts
# Writes apps/landing/data/mcp-catalog.json — what the public docs page renders.
```

Rerun the script after any tool change (new tool, rename, annotation tweak, scope re-classification) and commit the regenerated JSON in the same PR.

---

## Pointers

- **Operator topics** (deploy, secrets, custom-domain provisioning, JWKS rotation, scope-grant flow, CORS, output envelopes, elicitations, legal pages, R11 dev-verification gate): [`docs/mcp/runbook.md`](../../docs/mcp/runbook.md).
- **Consolidation-refactor plan** (architecture decision, AS-on-API migration, rollout): [`docs/plans/2026-05-25-001-refactor-mcp-auth-onto-better-auth-plan.md`](../../docs/plans/2026-05-25-001-refactor-mcp-auth-onto-better-auth-plan.md).
- **Connector-store readiness plan** (the original surface scope): [`docs/plans/2026-05-22-001-feat-mcp-connector-store-readiness-plan.md`](../../docs/plans/2026-05-22-001-feat-mcp-connector-store-readiness-plan.md).
- **Public user docs**: [packratai.com/mcp](https://packratai.com/mcp).
- **Submission packet** (Anthropic Connector Store): [`docs/mcp/submission-packet.md`](../../docs/mcp/submission-packet.md).

---

## License

GNU GPL v3 — see the [root LICENSE](../../LICENSE).
