# @packrat/mcp — PackRat MCP Server

PackRat's Model Context Protocol Worker. A thin, OAuth-secured façade over the PackRat API that exposes ~103 typed tools, six resources, and a handful of guided prompts to MCP-capable clients (Claude.ai, Claude Code, MCP Inspector, custom clients).

- **Production transport:** Streamable HTTP at `https://mcp.packratai.com/mcp`
- **OAuth:** 2.1 + PKCE S256 + RFC 8707 audience binding, via `@cloudflare/workers-oauth-provider`
- **Auth backend:** Better Auth (`packages/api`), shared with the mobile + web apps
- **Runtime:** Cloudflare Workers + Durable Objects, via the [Cloudflare Agents SDK](https://github.com/cloudflare/agents)

Public, user-facing docs live at [packratai.com/mcp](https://packratai.com/mcp). This README is for developers working in `packages/mcp/`.

---

## Quick orientation

| What you want | Where it lives |
| --- | --- |
| Worker entrypoint + `OAuthProvider` config | [`src/index.ts`](./src/index.ts) |
| OAuth handler (`/authorize`, `/login`, `/callback`, `/health`, `/favicon.ico`) | [`src/auth.ts`](./src/auth.ts) |
| Tool surface (~103 tools, 18 files) | [`src/tools/*.ts`](./src/tools) |
| Resources (`packrat://...`) | [`src/resources.ts`](./src/resources.ts) |
| Prompts (guided multi-turn flows) | [`src/prompts.ts`](./src/prompts.ts) |
| Scope model + tool gating | [`src/scopes.ts`](./src/scopes.ts) |
| RFC 9728 + RFC 8414 metadata | [`src/metadata.ts`](./src/metadata.ts) |
| Output envelope + pagination helpers | [`src/client.ts`](./src/client.ts) |
| Elicitations (destructive admin tools) | [`src/elicit.ts`](./src/elicit.ts) |
| Branded login page | [`src/login-page.ts`](./src/login-page.ts) |
| Glossary resource content | [`src/glossary.ts`](./src/glossary.ts) |
| Embedded favicon (OAuth host) | [`src/favicon.ts`](./src/favicon.ts) |
| Tests | [`src/__tests__/`](./src/__tests__) |
| One-shot scripts (DCR client pre-reg, catalog dump) | [`scripts/`](./scripts) |
| Operator runbook | [`../../docs/mcp/runbook.md`](../../docs/mcp/runbook.md) |
| Implementation plan | [`../../docs/plans/2026-05-22-001-feat-mcp-connector-store-readiness-plan.md`](../../docs/plans/2026-05-22-001-feat-mcp-connector-store-readiness-plan.md) |

The high-level architecture (DO-backed `McpAgent` + OAuth provider + Eden Treaty client to the PackRat API) is summarised in `src/index.ts`'s top-of-file docstring.

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
| `PACKRAT_API_URL` | The PackRat API base. `http://localhost:8787` if you also run `bun api`. |
| `MCP_INITIAL_ACCESS_TOKEN` | Pre-shared bearer that gates `POST /register`. Generate via `openssl rand -hex 32`. If unset, DCR is effectively disabled (fail-closed). |

Optional:

| Variable | Notes |
| --- | --- |
| `MCP_FEATURE_FLAGS` | Comma-separated flags toggled at boot (e.g. `wildlife_id,season_suggestions`). |
| `SENTRY_DSN` | Sentry DSN; populated once U15 lands. |

KV namespaces are not required for `wrangler dev` against `--env dev`; the dev config has a placeholder ID that satisfies the wrangler schema.

### 3. Run the Worker

```bash
cd packages/mcp
bun run dev
```

That binds the worker to a local URL printed by wrangler. The `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server` endpoints auto-emit from `OAuthProvider`; `/health` returns the version + legal URLs; `/mcp` requires a valid OAuth bearer.

### 4. Verify discovery

```bash
# Replace <local-url> with what `bun run dev` printed:
curl -s http://localhost:8787/.well-known/oauth-protected-resource | jq
# Expect: { resource: "https://mcp.packratai.com/mcp", scopes_supported: [...], ... }

curl -s http://localhost:8787/.well-known/oauth-authorization-server | jq '.code_challenge_methods_supported'
# Expect: ["S256"]
```

For a full client-side OAuth round-trip, point [MCP Inspector](https://github.com/modelcontextprotocol/inspector) at your local URL:

```bash
bunx @modelcontextprotocol/inspector --transport streamable-http --server-url http://localhost:8787/mcp
```

The inspector will discover the well-known endpoints, walk through the OAuth flow against your local Better Auth instance, and surface every tool, resource, and prompt the connector exposes.

---

## Tests

```bash
cd packages/mcp
bun run test        # one-shot
bun run test:watch  # watch mode
```

The unit suite covers the OAuth handler, login page, tool annotation invariants (the U7 catalog test enumerates every registered tool), the scope-gating contract, resources, output envelopes, elicitations, and the embedded favicon. Integration tests against `@cloudflare/vitest-pool-workers` land in U17.

> `bun run check-types` is intentionally not run as part of the local default loop. The MCP SDK's type surface plus our own types are large enough that `tsc --noEmit` OOMs on workstations with under ~16 GB RAM. Run it locally with `NODE_OPTIONS=--max-old-space-size=16384` if you need it; the CI pipeline (U17) is the authoritative type-check.

---

## OAuth scopes

The MCP Worker advertises four coarse-grained OAuth scopes (`src/scopes.ts`, `src/metadata.ts`):

| Scope | Grants | Notes |
| --- | --- | --- |
| `mcp` | read tools only | Legacy umbrella scope, kept for back-compat with any client that registered before the scope split. Pre-split clients only ever called read tools — quietly granting writes to them would be an escalation. |
| `mcp:read` | `packrat_get_*`, `packrat_list_*`, `packrat_search_*`, `packrat_find_*`, plus `packrat_whoami` and a few `packrat_extract_*` / `packrat_preview_*` tools | Same as `mcp` but explicit. |
| `mcp:write` | read + every create / update / delete / submit / record tool | The default scope Claude.ai requests. |
| `mcp:admin` | read + write + every `packrat_admin_*` tool + the four explicit overrides (`packrat_execute_sql_query`, `packrat_get_database_schema`, `packrat_generate_pack_template_from_url`, `packrat_create_app_pack_template`) | Only granted to users whose Better Auth role resolves to `ADMIN` at `/callback` time — see [`docs/mcp/runbook.md`](../../docs/mcp/runbook.md) § "U5 admin scope model" for the role-lookup contract. |

Gating is enforced after tool registration: every tool registers normally, then the agent disables anything the granted scopes don't authorize. The SDK's `RegisteredTool.disable()` auto-emits `notifications/tools/list_changed`, so the client's view of the tool list stays in sync.

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

- **Operator topics** (deploy, secrets, custom-domain provisioning, scope-grant flow, login security, CORS, output envelopes, elicitations, login UX, legal pages): [`docs/mcp/runbook.md`](../../docs/mcp/runbook.md).
- **Implementation plan** (problem framing, scope, units, risks, sources): [`docs/plans/2026-05-22-001-feat-mcp-connector-store-readiness-plan.md`](../../docs/plans/2026-05-22-001-feat-mcp-connector-store-readiness-plan.md).
- **Public user docs**: [packratai.com/mcp](https://packratai.com/mcp).
- **Submission packet** (Anthropic Connector Store): [`docs/mcp/submission-packet.md`](../../docs/mcp/submission-packet.md).

---

## License

GNU GPL v3 — see the [root LICENSE](../../LICENSE).
