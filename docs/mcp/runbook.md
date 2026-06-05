# PackRat MCP — operator runbook

Operational reference for deploying and maintaining `packages/mcp` (the
PackRat MCP Worker). User-facing docs are at
[packratai.com/mcp](https://packratai.com/mcp); this doc is for whoever
operates the Worker.

> **Status: in progress.** Sections are filled in as their corresponding
> implementation units land. Anything marked `TODO (operator)` is an action
> a human with Cloudflare access has to perform — not something the code can
> automate.

## Domains & environments

| Env  | Worker name        | URL                                  | Branch trigger |
| ---- | ------------------ | ------------------------------------ | -------------- |
| prod | `packrat-mcp`      | `https://mcp.packratai.com`          | tag push (U17) |
| dev  | `packrat-mcp-dev`  | `https://packrat-mcp-dev.<acct>.workers.dev` | manual (`bun run deploy:dev`) |

## Post-refactor: AS lives on api.packrat.world

As of the 2026-05-25 OAuth consolidation refactor, the MCP worker is a
**pure protected resource**. It no longer runs its own authorization
server, no longer issues tokens, no longer brokers DCR or login. All of
that lives on `api.packrat.world` via the `@better-auth/oauth-provider`
plugin (U1 of the refactor plan).

### Architecture overview

| Component                       | Lives on             | Owned by                                       |
| ------------------------------- | -------------------- | ---------------------------------------------- |
| Authorization server (AS)       | `api.packrat.world`  | `@better-auth/oauth-provider` plugin           |
| Consent / login UI              | `api.packrat.world`  | `consent-page.ts` (U1 of the refactor)         |
| OAuth clients / grants / tokens | `api.packrat.world`  | Better Auth tables in Postgres + `AUTH_KV`     |
| JWKS                            | `api.packrat.world`  | Better Auth (`/api/auth/jwks`)                 |
| Protected resource (MCP)        | `mcp.packratai.com`  | This worker — validates JWTs only              |
| MCP tool / resource surface     | `mcp.packratai.com`  | This worker — unchanged from U7–U16            |

The MCP worker validates incoming JWTs via `verifyMcpToken`
(`packages/mcp/src/token-verify.ts`), which fetches and caches the
JWKS from `${PACKRAT_API_URL}/api/auth/jwks`.

### Discovery chain

When Claude.ai connects to the MCP for the first time:

1. Claude POSTs to `https://mcp.packratai.com/mcp` with no Authorization.
2. MCP returns 401 with
   `WWW-Authenticate: Bearer resource_metadata="https://mcp.packratai.com/.well-known/oauth-protected-resource"`.
3. Claude fetches the PRM document, which advertises
   `authorization_servers: ["https://api.packrat.world"]`.
4. Claude fetches
   `https://api.packrat.world/.well-known/oauth-authorization-server`
   to discover the AS endpoints (Better Auth's plugin serves this).
5. Claude runs the OAuth flow entirely against `api.packrat.world`:
   `/api/auth/oauth/authorize` → consent page → `/api/auth/oauth/token`.
6. Claude receives the issued bearer (a JWT signed by Better Auth) and
   redirects back to `https://claude.ai/api/mcp/auth_callback`.
7. Claude retries the MCP request with `Authorization: Bearer <jwt>`;
   the MCP worker validates the JWT locally (JWKS cache hit after the
   first request per isolate) and dispatches the tool call.

References:

- [Refactor plan](../plans/2026-05-25-001-refactor-mcp-auth-onto-better-auth-plan.md)
  for the architectural decision, requirements, rollout strategy, and
  alternatives considered.
- [Spike doc](./better-auth-oauth-provider-spike-2026-05-25.md) for the
  empirical verification that `@better-auth/oauth-provider` carries
  the MCP integration end-to-end.

### Operator note: force isolate rotation after the deploy

Better Auth is memoized in a per-isolate singleton on the API side
(`authCache` in `packages/api/src/auth/index.ts`). The MCP worker has
its own per-isolate JWKS cache. After the refactor deploy, existing
isolates on both workers will keep their old config until they rotate.
Force a rotation by bumping a benign env var on each worker so the new
plugin config / JWKS endpoint is picked up immediately rather than
waiting on natural isolate churn. See § "Forcing isolate rotation
after a deploy" further down for the pattern.

## One-time operator setup

These steps are required before `wrangler deploy --env prod` can succeed.
They live outside the codebase because they touch Cloudflare account state.

### 1. ~~Remove leftover `OAUTH_KV` namespaces + DCR secret~~ — nothing to do (verified)

**Verified 2026-05-31 against the `packratai.com` Cloudflare account — there is
nothing to clean up.** The MCP connector has never been deployed to any
environment:

- KV namespaces `0ac2e23b…` (prod) / `be554ba7…` (dev) **do not exist** — they
  were never created (the `development` `wrangler.jsonc` still carries
  `__TODO_OAUTH_KV_*_ID__` placeholders). The only KV in the account is
  `AUTH_KV` / `AUTH_KV_preview` — the **current** Better Auth namespaces used by
  the API worker. **Do not delete those.**
- Workers `packrat-mcp` / `packrat-mcp-dev` **do not exist** (`wrangler` →
  "Worker not found"), so no `MCP_INITIAL_ACCESS_TOKEN` secret exists either.

The IDs that appear elsewhere in the plan/runbook are notional — recorded in the
plan, never provisioned. The first MCP deploy will be a **net-new first deploy**
(the U17 workflow creates the workers on first tag), not a migration off
anything. No pre-deploy cleanup step is required.

No equivalent provisioning step exists anymore: Better Auth's OAuth
provider on `api.packrat.world` owns all client / grant / token state in
the API's Postgres + `AUTH_KV`. Pre-registered Claude clients are seeded
once via `cd packages/api && bun run db:seed:oauth-clients` (script:
`packages/api/src/db/seed-claude-oauth-client.ts`) — see § "Post-refactor:
AS lives on api.packrat.world" below for the architecture overview.

### 2. Provision the `mcp.packratai.com` custom domain

In the Cloudflare dashboard, on the `packratai.com` zone:

1. Workers & Pages → `packrat-mcp` → Settings → Domains & Routes → Add → Custom Domain
2. Enter `mcp.packratai.com`
3. Cloudflare will provision the certificate automatically; allow up to 15 minutes
4. The `routes` block in `packages/mcp/wrangler.jsonc` references this
   already, but the domain has to exist on the zone before
   `wrangler deploy --env prod` will succeed against it

### 3. Set secrets per environment

```bash
# Required for both prod and dev
wrangler secret put PACKRAT_API_URL --env prod
# value: https://api.packrat.world  (the AS host — used by token-verify.ts
# to fetch JWKS at ${PACKRAT_API_URL}/api/auth/jwks)

# Optional (used by U15)
wrangler secret put SENTRY_DSN --env prod
```

Repeat for `--env dev` with dev values.

Pre-registration of Claude as an OAuth client now happens on the API side
once via `cd packages/api && bun run db:seed:oauth-clients` (script:
`packages/api/src/db/seed-claude-oauth-client.ts`) — see U1 of the refactor
plan and § "Post-refactor: AS lives on api.packrat.world" below.

### 4. Migrate API env-var names: `BETTER_AUTH_*` → `PACKRAT_*` (2026-05-25)

The API package was renamed off framework-specific env-var names so the
backend secrets carry a `PACKRAT_*` namespace consistent with the rest of
the monorepo (MCP and CLI already used `PACKRAT_API_URL`):

| Legacy name (accepted as fallback) | New canonical name |
|---|---|
| `BETTER_AUTH_SECRET` | `PACKRAT_AUTH_SECRET` |
| `BETTER_AUTH_URL` | `PACKRAT_API_URL` |

The zod schema in `packages/api/src/utils/env-validation.ts` accepts BOTH
names during the rolling migration — set EITHER one in each pair and the
canonical `PACKRAT_*` field is resolved at validation time. Consumer code
reads `env.PACKRAT_AUTH_SECRET` / `env.PACKRAT_API_URL` only.

**Operator migration steps (per environment — `--env prod` first, then
`--env dev`):**

```bash
# 1) Add the new-name secrets with the SAME VALUES as today. CF Worker
#    secrets are write-only — you cannot read back the current value via
#    `wrangler secret`. Either pull from your password manager / 1Password,
#    OR rotate to a fresh value and accept that every Better Auth session +
#    every HS256 admin JWT is invalidated (users + admins must re-login
#    once; no data loss). The URL value is non-secret: `https://api.packrat.world`
#    in prod, `http://localhost:8787` in dev.

wrangler secret put PACKRAT_AUTH_SECRET --env prod   # value: current BETTER_AUTH_SECRET, or fresh random
wrangler secret put PACKRAT_API_URL --env prod       # value: https://api.packrat.world

# 2) Deploy the API. The transitional schema now reads PACKRAT_* first,
#    falling back to BETTER_AUTH_* if PACKRAT_* is missing — both code
#    paths are exercised here, so no downtime.

# 3) Verify the API came up cleanly (no zod validation errors in
#    `wrangler tail --env prod`, /api/health returns 200).

# 4) Once you've verified, delete the legacy secrets:
wrangler secret delete BETTER_AUTH_SECRET --env prod
wrangler secret delete BETTER_AUTH_URL --env prod
```

**A follow-up PR will remove the `BETTER_AUTH_*` schema fallback.** Until
that PR ships, you can leave the legacy secrets in place or delete them
per step 4. The schema accepts either configuration.

**Why this matters:** `PACKRAT_AUTH_SECRET` signs both Better Auth sessions
AND the legacy HS256 admin JWTs used by `apps/admin`. Keep the VALUE
identical across the rename — rotating the value would invalidate every
existing admin token. The rename is name-only; the bytes stay the same.

## U5 admin scope model

The MCP Worker advertises four coarse-grained OAuth scopes (see
`packages/mcp/src/scopes.ts` and `metadata.ts`):

| Scope | Visible tools |
| ----- | ------------- |
| `mcp` (umbrella, back-compat) | read tools only (`packrat_get_*`, `packrat_list_*`, `packrat_search_*`, `packrat_find_*`, `packrat_extract_*`, `packrat_preview_*`, `packrat_whoami`) |
| `mcp:read` | same as `mcp`, explicit |
| `mcp:write` | read + write tools (everything not classified `admin`) |
| `mcp:admin` | read + write + every `packrat_admin_*` tool + the four explicit overrides `packrat_execute_sql_query` / `packrat_get_database_schema` / `packrat_generate_pack_template_from_url` / `packrat_create_app_pack_template` (the last two added in U7) |

`mcp:admin` is granted ONLY when:

1. The client requested `mcp:admin` in `/authorize`, AND
2. The authenticated user's Better Auth session resolves to
   `user.role === 'ADMIN'` at `/callback` time.

A non-admin user who requests `mcp:admin` does not receive it — the
authorization completes successfully but the granted-scope set is
stripped of `mcp:admin`. Per RFC 6749 §3.3 the granted scope must be a
subset of the requested scope, so a client that didn't request
`mcp:admin` will never receive it even for an admin user.

### Per-grant role lookup, fail-closed

The role lookup at `/callback` calls Better Auth via the API
(`/api/auth/get-session`) with a **5-second** `AbortSignal.timeout`.
Any failure path — timeout, non-2xx response, malformed body,
network error, role !== ADMIN — drops the request to "non-admin"
scope set. This keeps the OAuth flow usable for read/write users
during Better Auth degradation; admin scope is only granted on an
unambiguous positive role check.

The lookup is NOT cached across `/callback` invocations: every
authorization re-checks the role, so a user whose admin role was
revoked between sessions cannot keep getting `mcp:admin` on the
next grant.

### Contrast: removed parallel admin path

U5 deleted the prior `admin_login` MCP tool and the
`X-PackRat-Admin-Token` request header. Admins no longer need to
perform a runtime tool-mediated handshake to access admin tools;
they re-authorize the MCP client with `mcp:admin` in the requested
scope set and the scope is granted automatically if their Better
Auth role permits it.

On the API side (`packages/api/src/routes/admin/index.ts`), the
`adminAuthGuard` was extended to accept Better Auth session bearers
whose `user.role === 'ADMIN'` in addition to the legacy HS256
`packrat-admin` JWT. The HS256 path is retained for back-compat
with `apps/admin`. See the security note in that file's docstring:
accepting Better Auth bearers means a stolen admin session is now
also a path to `/admin/*`. This is the intended trade-off — admin
session theft has always been catastrophic, and consolidating on a
single revocation surface (the Better Auth session table) is the
simplification the change buys.

### U5 consumer audit

Grep audit (2026-05-22) across `apps/`, `packages/`, `docs/`,
`scripts/`, `.github/workflows/`, `README*` for the removed
identifiers:

| Identifier | Hits outside `docs/plans/` | Resolution |
| ---------- | -------------------------- | ---------- |
| `X-PackRat-Admin-Token` | **0** | Header was MCP-internal; no consumer ever shipped. |
| `admin_login` (MCP tool name) | 1 in `packages/mcp/src/tools/auth.ts` (historical-context comment) + 1 in `packages/mcp/src/tools/packTemplates.ts` (live tool description) | Comment retained as removal documentation. The tool description was updated to reference `mcp:admin` scope. |
| `admin/login` (API route) | 1 in `apps/admin/app/login/page.tsx` | Unrelated — this is the API `POST /admin/login` HS256-JWT path used by the admin SPA. Path A of the dual-mechanism guard preserves it. |
| `adminToken` / `getAdminToken` | 0 in `packages/mcp/` | Field removed from `Props`; client factory no longer takes the parameter. |

No active consumer outside `apps/admin` (which uses the preserved
HS256 path) was affected by the U5 removal.

## Better Auth trustedOrigins (U6)

The MCP Worker calls Better Auth (in `packages/api`) for password sign-in
during the OAuth flow. Better Auth rejects calls whose `Origin` is not on
its `trustedOrigins` list — so `https://mcp.packratai.com` must appear in
that list, or every MCP-driven sign-in will fail with an untrusted-origin
error.

> U5 also depends on this: the role lookup at `/callback` calls
> `/api/auth/get-session`, which Better Auth gates on the same
> `trustedOrigins` list. If the MCP host is missing from
> `trustedOrigins`, admin scope grants will fail closed (correctly —
> the role check fails — but for the wrong reason).

`trustedOrigins` is configured in **two files that drift independently**:

| File | Purpose | Line |
| ---- | ------- | ---- |
| `packages/api/src/auth/index.ts` | Runtime (per-isolate) config | search `trustedOrigins:` |
| `packages/api/src/auth/auth.config.ts` | CLI / `bunx auth generate` static config | search `trustedOrigins:` |

Both must include `https://mcp.packratai.com`. If you edit one, edit the
other in the same commit. The factory pattern that splits them is
documented in
[`docs/solutions/developer-experience/better-auth-cli-cloudflare-worker-factory-2026-05-02.md`](../solutions/developer-experience/better-auth-cli-cloudflare-worker-factory-2026-05-02.md).

### Schema regen reminder

Per the same learning doc, after editing `auth.config.ts` you should run:

```bash
cd packages/api
bunx auth generate --config src/auth/auth.config.ts
```

to keep the generated schema in sync. The U6 change only touches
`trustedOrigins` — which is not a schema-affecting field — so a regen is
not required to ship U6. Run it on the next deploy that does touch a
schema-affecting field (an `additionalFields` change, a new plugin, etc.).

### Forcing isolate rotation after a deploy

Better Auth is memoized in a per-isolate singleton (`authCache` in
`packages/api/src/auth/index.ts`). Existing isolates already running when
a deploy lands will keep the old `trustedOrigins` list until they're
rotated. Force a rotation by deploying a no-op env change (e.g. bumping
a benign var) so MCP sign-ins start succeeding immediately rather than
waiting on natural isolate churn.

## CORS allowlist on /.well-known/oauth-protected-resource (U6)

Post-refactor, the MCP worker only serves the **protected-resource**
metadata endpoint at `/.well-known/oauth-protected-resource`. The
authorization-server metadata (`/.well-known/oauth-authorization-server`)
now lives on `api.packrat.world` because the AS itself runs there.

The PRM endpoint accepts cross-origin GET and OPTIONS requests **only**
from:

- `https://claude.ai`
- `https://claude.com`

Everything else gets the response unmodified (default-deny). The
allowlist + GET annotation + OPTIONS short-circuit all live in
`packages/mcp/src/cors.ts` (`applyCorsHeaders`), invoked by the outer
fetch wrapper in `index.ts`.

If Anthropic adds new origins (e.g. a future Claude domain), update the
`WELL_KNOWN_ALLOWED_ORIGINS` set in `cors.ts` and the corresponding test
in `__tests__/auth.test.ts`.

## U7 tool surface

### `packrat_*` namespace

Every user-callable MCP tool is namespaced with the `packrat_` prefix. This
prevents collisions when a user installs multiple connectors in Claude
(e.g. another connector also exposing a `get_pack` tool would clash without
the prefix). Admin tools keep the legacy `admin_` prefix on top of the
namespace, so they read as `packrat_admin_*`.

There are no backwards-compatible aliases — the v1 connector-store
listing breaks pre-rename tool names by design. The scope classifier in
`packages/mcp/src/scopes.ts` accepts both shapes (`admin_*` and
`packrat_admin_*`) so the U5 gating contract doesn't depend on U7 having
shipped, but the live surface only emits the prefixed form.

### Annotation policy — every flag set explicitly

Every tool registration sets `title`, `readOnlyHint`, `idempotentHint`,
and `openWorldHint` on the `annotations` object. Write tools (anything
with `readOnlyHint: false`) additionally set `destructiveHint`.

We do **not** rely on SDK defaults. The MCP SDK's `destructiveHint`
default is `true`, which forces a confirmation prompt on every tool
call — including reads — if `readOnlyHint` is also unset. The catalog
test in `packages/mcp/src/__tests__/annotations.test.ts` fails the
build if any tool ships without explicit values for every annotation.

Classification rules (codified in the catalog test):

| Pattern | `readOnlyHint` | `destructiveHint` | `openWorldHint` |
| --- | --- | --- | --- |
| `packrat_get_*` / `packrat_list_*` / `packrat_search_*` / `packrat_whoami` | true | (unset) | false for internal data; true for `packrat_web_search`, `packrat_get_weather`, `packrat_extract_url_content`, `packrat_preview_alltrails_url`, `packrat_search_weather_*`, etc. |
| `packrat_create_*` / `packrat_update_*` / `packrat_submit_*` / `packrat_record_*` / `packrat_add_*` | false | false (additive) | false |
| `packrat_delete_*` / `packrat_remove_*` / `packrat_admin_hard_delete_*` / `packrat_admin_delete_*` | false | true | false |
| `packrat_toggle_*` | false | false (additive — flips state) | false |
| `packrat_analyze_*` / `packrat_identify_*` / `packrat_analyze_pack_image` | false | false | false |
| `packrat_generate_pack_template_from_url` | false | false | true (reaches TikTok/YouTube) |

### Split tools

The pre-rename `create_pack_template` accepted an `is_app_template`
boolean that switched between user-level and admin-only behaviour. Per
the U7 plan's "Key Technical Decisions" and the security-lens
doc-review finding, U7 split this into two tools so a single boolean
parameter never decides between safe and unsafe operations:

| New tool | Behaviour | Visibility |
| --- | --- | --- |
| `packrat_create_pack_template` | `is_app_template` forced to `false`. Creates a personal template visible only to the signed-in user. | All write+admin scopes (`mcp:write`, `mcp:admin`). |
| `packrat_create_app_pack_template` | `is_app_template` forced to `true`. Creates a curated app template visible to all users. | `mcp:admin` only — listed in `EXPLICIT_ADMIN` in `scopes.ts`. |

### `EXPLICIT_ADMIN` overrides — U7 additions

The `ADMIN_OVERRIDES` set in `packages/mcp/src/scopes.ts` lists tool
names whose prefix doesn't match the admin convention but whose blast
radius warrants admin-only visibility. U7 added two new entries on top
of the existing two D3-finding overrides:

| Tool | Why explicit-admin |
| --- | --- |
| `packrat_execute_sql_query` (carry-over from U5 / D3) | Raw DB SELECT access — over-grant risk. |
| `packrat_get_database_schema` (carry-over from U5 / D3) | Exposes the DB shape; admin-only data leakage prevention. |
| `packrat_generate_pack_template_from_url` (U7) | API enforces admin on `user.role`; MCP hides it from non-admin sessions so `tools/list` matches what the user can actually call. |
| `packrat_create_app_pack_template` (U7) | Admin variant of the split create-template tool; the `admin_` prefix isn't in the name (would otherwise read as "admin: create"), so the override is the only gate. |

Each override is listed twice in `ADMIN_OVERRIDES` — once without the
`packrat_` prefix and once with — so the classifier handles both
pre- and post-U7 naming and the override semantics survive a future
naming refactor.

## U8 output envelopes

### Error envelope convention

Every recoverable tool failure flows through `errResponse(code, message, retryable)`
in `packages/mcp/src/client.ts` and surfaces as:

```jsonc
{
  "isError": true,
  "content": [{ "type": "text", "text": "<human-readable message>" }],
  "structuredContent": {
    "error": {
      "code": "api_error" | "network_error" | "unauthorized" | "forbidden" |
              "not_found" | "conflict" | "validation_error" | "rate_limited" |
              "tool_error",
      "message": "<same as content[0].text>",
      "retryable": true | false
    }
  }
}
```

`call()` maps API responses to codes deterministically:

| Origin                     | `code`              | `retryable` |
| -------------------------- | ------------------- | ----------- |
| Thrown / network error     | `network_error`     | true        |
| HTTP 401                   | `unauthorized`      | false       |
| HTTP 403                   | `forbidden`         | false       |
| HTTP 404                   | `not_found`         | false       |
| HTTP 409                   | `conflict`          | false       |
| HTTP 422                   | `validation_error`  | false       |
| HTTP 429                   | `rate_limited`      | true        |
| HTTP 5xx                   | `api_error`         | true        |
| Other non-success          | `api_error`         | false       |

Protocol violations — unknown method, malformed JSON-RPC params, bad
argument types — are reserved for the SDK to surface as JSON-RPC errors
(`-32602`, `-32600`, etc.). Tool handlers must never throw to signal a
recoverable failure; throw is for "the model gave us something we can't
parse at all". `call()` catches inside-handler throws and converts them
to `network_error` to make the asymmetry safe.

### 150 000-char response cap + truncation

Per Anthropic's connector-store documentation, Claude.ai and Claude
Desktop truncate tool results at ~150 000 characters. We truncate
server-side so we control the marker text and don't waste bandwidth:

- The cap is `RESPONSE_SIZE_LIMIT_CHARS = 150_000` in `client.ts`.
- `ok()` runs every payload through `truncateForResponse` before
  formatting. If `JSON.stringify(data, null, 2).length` exceeds the cap,
  the text content is sliced to fit and a `\n[truncated: response
  exceeded 150k chars]` marker is appended.
- On truncation we **drop `structuredContent`** even when the caller
  opted in — the truncated text is no longer valid JSON, so emitting it
  as `structuredContent` would fail the SDK's outputSchema validation.
- Truncation is **not** flagged as `isError: true` — it's a response-
  shape concern, not a failure. The marker is sufficient for the model
  to detect the cutoff and request a narrower scope on its next turn.

### Pagination clamp + cursor convention

List-style tools that previously advertised `limit ≤ 200` now clamp to
`PAGINATION_LIMIT_MAX = 50` server-side. The clamp is **silent**:
caller-supplied `limit > 50` is rounded down without erroring, so a
model that ignores the published cap still gets a successful response
on a recoverable mistake.

| Tool                                       | Pagination cursor surface |
| ------------------------------------------ | ------------------------- |
| `packrat_list_packs` (U8)                  | MCP envelope `{ data, nextOffset }`; `nextOffset` is null at end of list. |
| `packrat_list_trips` (U8)                  | Same MCP envelope. |
| `packrat_admin_list_users`                 | API native `{ data, total, limit, offset }`; walk via next `offset`. |
| `packrat_admin_list_packs`                 | Same as above. |
| `packrat_admin_list_catalog`               | Same as above. |
| `packrat_admin_list_trail_condition_reports` | Same as above. |
| `packrat_admin_search_trails`              | API native `{ trails, hasMore, offset, limit }`. |
| `packrat_search_gear_catalog`              | API native `page`-based pagination; `limit` clamped. |
| `packrat_admin_analytics_top_brands`       | `limit` clamped. |
| `packrat_admin_analytics_etl_jobs`         | `limit` clamped. |
| `packrat_admin_analytics_etl_failure_summary` | `limit` clamped. |
| `packrat_admin_analytics_etl_job_failures` | `limit` clamped. |

The `withNextOffset` helper in `client.ts` is the canonical
no-cursor-from-API fallback: it returns
`{ data: items, nextOffset: items.length >= limit ? offset + items.length : null }`
so the model always sees the same shape regardless of which list tool
it called.

### Structured output (Tier 1)

The MCP spec 2025-06-18 allows tools to declare an `outputSchema` and
emit `structuredContent` alongside the text content block. Clients that
adopt the new shape (Claude Code, future Claude.ai versions) can
consume the structured payload directly; clients that don't still see
the JSON-stringified text fallback. The SDK validates emitted
`structuredContent` against the declared schema before send — a schema
mismatch is a runtime error, not a silent shape drift.

Tier 1 (shipped in U8 — these tools declare an `outputSchema` and call
`ok(..., { structured: true })` or `call(..., { structured: true })`):

| Tool | Schema |
| --- | --- |
| `packrat_whoami` | `WhoAmIOutputSchema` (`{ success?, user }`) |
| `packrat_get_pack` | `PackWithItemsSchema` |
| `packrat_list_packs` | `{ data: Pack[], nextOffset }` |
| `packrat_get_trip` | `TripSchema` |
| `packrat_list_trips` | `{ data: Trip[], nextOffset }` |
| `packrat_get_weather` | `GetWeatherOutputSchema` (WeatherAPI passthrough) |
| `packrat_admin_stats` | `AdminStatsSchema` |
| `packrat_admin_analytics_active_users` | `ActiveUsersSchema` |
| `packrat_admin_analytics_catalog_overview` | `CatalogOverviewSchema` |
| `packrat_admin_analytics_growth` | `z.array(GrowthPointSchema)` (declared) |
| `packrat_admin_analytics_activity` | `z.array(ActivityPointSchema)` (declared) |
| `packrat_admin_analytics_pack_breakdown` | `z.array(BreakdownItemSchema)` (declared) |

Schemas live in `packages/mcp/src/output-schemas.ts`. They re-use
`@packrat/schemas` wherever a response shape is already modeled in the
API contract — single source of truth. Tests in
`packages/mcp/src/__tests__/output-schemas.test.ts` round-trip every
schema and assert each Tier 1 tool's `_registeredTools` entry carries
an `outputSchema` value.

### Tier 2 deferral (follow-up unit)

The remaining read tools emit text-only output today. Their API
response shapes either aren't modeled in `@packrat/schemas` yet or
require non-trivial derivation from Eden Treaty's inferred types.
Lifting them to Tier 1 is a follow-up unit; the catalogue test still
asserts the annotation invariants on all of these so the surface
doesn't drift in the meantime.

Tier 2 categories (representative — not exhaustive):

- All `packs.items.*` mutations and the bare `*_items` reads
  (`packrat_get_pack_item`, `packrat_list_pack_items`).
- Catalog read paths beyond `packrat_search_gear_catalog`
  (`packrat_get_catalog_item`, `packrat_similar_catalog_items`,
  `packrat_semantic_gear_search`, `packrat_compare_gear_items`,
  `packrat_list_gear_categories`).
- All `tools/feed.ts`, `tools/trail-conditions.ts`,
  `tools/trails.ts`, `tools/alltrails.ts`, `tools/guides.ts`,
  `tools/knowledge.ts`, `tools/seasons.ts`, `tools/wildlife.ts`,
  `tools/upload.ts`, `tools/packTemplates.ts`, `tools/ai.ts`.
- `tools/user.ts` — `packrat_get_profile`, `packrat_update_profile`
  (overlap with `packrat_whoami` shape; can be lifted in the same
  follow-up).
- Admin list/get tools that aren't analytics-bucket Tier 1 above:
  `packrat_admin_list_users`, `packrat_admin_list_packs`,
  `packrat_admin_list_catalog`, `packrat_admin_get_trail`,
  `packrat_admin_get_trail_geometry`,
  `packrat_admin_list_trail_condition_reports`,
  `packrat_admin_search_trails`,
  `packrat_admin_analytics_catalog_prices`,
  `packrat_admin_analytics_catalog_embeddings`.
- `tools/weather.ts` beyond `packrat_get_weather`
  (`packrat_search_weather_location`,
  `packrat_search_weather_by_coordinates`,
  `packrat_get_weather_forecast`).

Tracking sketch for a follow-up:

1. Inventory each Tier 2 tool's API endpoint and pull the Treaty
   inferred response type into `output-schemas.ts`.
2. Where Treaty loses the array element shape (the recurring pattern
   here is admin routes whose response is declared with Elysia's
   `t.Unsafe<any>`), declare the schema fresh against the route's
   underlying SQL projection.
3. Add the schema to the Tier 1 table in this runbook; add a
   round-trip test and a cross-check entry in `output-schemas.test.ts`.

## U9 resources surface

The MCP Worker exposes the following resources. Templated resources
carry `list:` providers wherever it makes sense, so MCP clients can
enumerate the signed-in user's data via `resources/list` rather than
having to guess IDs.

| URI                                | Shape     | List provider | mimeType            | Notes |
| ---------------------------------- | --------- | ------------- | ------------------- | ----- |
| `packrat://packs/{packId}`         | template  | yes           | `application/json`  | Lists user's packs (no public packs in the enumeration). |
| `packrat://trips/{tripId}`         | template  | yes           | `application/json`  | Lists user's trips. |
| `packrat://catalog/{itemId}`       | template  | yes (capped)  | `application/json`  | List capped at `CATALOG_LIST_CAP = 25` to avoid context-blowing on the multi-thousand-item catalog. |
| `packrat://catalog/categories`     | static    | n/a           | `application/json`  | Pre-U9; preserved. |
| `packrat://search?q={query}`       | template  | no            | `application/json`  | Delegates to the gear-catalog text-search endpoint. Returns up to 20 hits as JSON. No list provider (queries are inherently parameterised). |
| `packrat://glossary`               | static    | n/a           | `text/markdown`     | Domain vocabulary (pack/trip/weight/trail/scope terms). Reviewers see this in the resource catalog; Claude reads it once early in a session. |

### Why a glossary resource

Reviewer-facing: Anthropic's reviewers downrank "thin connectors" that
expose only CRUD calls. A glossary resource doubles as
domain-knowledge documentation a reviewer can browse without leaving
the resource catalog.

Model-facing: Claude burns tool calls (and turns) re-learning that
"base weight" excludes consumables, that an "AT thru-hiker" walks the
Appalachian Trail, etc. A single static markdown read at session start
shortcuts that. The glossary content lives in
`packages/mcp/src/glossary.ts` and is exported as
`GLOSSARY_MARKDOWN` so the resource handler stays a one-line return.

### List-provider error handling (degrade, don't propagate)

A thrown error inside any list callback would break the SDK's
`resources/list` aggregator for **every** template at once. So all
three list providers (`pack`, `trip`, `catalog_item`) wrap their
callbacks in `safeList()` which swallows the error, logs a warning to
`console.warn`, and returns an empty array. The catalog, glossary,
and other resources stay readable even while one provider is degraded
(network blip, auth race at session start, API outage).

U15 will replace `console.warn` here with the structured logger; the
contract is otherwise stable.

### Catalog list cap (25)

The full PackRat catalog runs to thousands of items. Listing all of
them on every `resources/list` call would burn megabytes of context
for marginal value. `CATALOG_LIST_CAP = 25` is one screen of resource
entries in Claude.ai's resource browser; the model can still page
deeper via `packrat://search?q=...` or the
`packrat_search_gear_catalog` / `packrat_semantic_gear_search` tools.

Bumping the cap is cheap (single constant in `resources.ts`); revisit
if reviewer feedback says the initial surface is too narrow.

### Error envelope on resource reads

Resource read failures throw `McpError` (from
`@modelcontextprotocol/sdk/types.js`) so the SDK converts them to
proper JSON-RPC errors. Pre-U9, the read handlers returned errors as
JSON content blocks with no error flag — clients couldn't tell apart
"successful read of a JSON document that describes an error" from
"the read itself failed". U9 fixes that:

| Upstream status | JSON-RPC code            |
| --------------- | ------------------------ |
| 4xx (404, etc.) | `-32602` (InvalidParams) |
| 5xx / network   | `-32603` (InternalError) |

The `ReadResourceResult` type in MCP SDK 1.29 does NOT have an
`isError` field (unlike `CallToolResult`), which is why the resource
path diverges from the tool-call envelope U8 hardened — for resources
the JSON-RPC layer carries the error, not the result body.

## U10 elicitations

PackRat's MCP server prompts the user via MCP `elicitation/create` before
firing irreversible / high-blast-radius admin operations. The blast
radius is intentionally limited — only six tools elicit, matching the
plan's "destructive admin + ambiguous input" stance.

### Gated tools and confirmation tokens

| Tool                                              | Confirmation field | Required string  |
| ------------------------------------------------- | ------------------ | ---------------- |
| `packrat_admin_hard_delete_user`                  | User ID            | the target user_id (verbatim) |
| `packrat_admin_delete_pack`                       | Confirmation       | `DELETE`         |
| `packrat_admin_delete_catalog_item`               | Confirmation       | `DELETE`         |
| `packrat_admin_delete_trail_condition_report`     | Confirmation       | `DELETE`         |
| `packrat_create_app_pack_template`                | Confirmation       | `PUBLISH`        |
| `packrat_generate_pack_template_from_url`         | Confirmation       | `GENERATE`       |

For `packrat_admin_hard_delete_user` we ask the operator to retype the
user_id rather than a fixed token because the admin API has no GET-by-id
endpoint to enrich the prompt with the username/email pre-deletion
(`packages/api/src/routes/admin/index.ts` only exposes `/users-list` and
the DELETE itself). Retyping the id keeps the prompt deliberate without
introducing a fragile pre-read call. If a future API unit adds the GET
endpoint, swap the confirmation token to the username.

### agents@0.13 contract — `{ relatedRequestId }` is required

The U2 dependency bump pulled `agents` to `^0.13.2`. The 0.13 release
added a required second argument to `McpAgent.elicitInput`:

```ts
elicitInput(
  params: { message: string; requestedSchema: unknown },
  options?: { relatedRequestId?: RequestId },
): Promise<ElicitResult>;
```

Without `{ relatedRequestId: extra.requestId }`, the elicitation request
routes to a non-existent SSE stream and rejects with
`Elicitation request timed out` after the SDK's 60-second timeout —
silently from the user's perspective (no prompt ever appears).

Both helpers in `packages/mcp/src/elicit.ts` (`confirmAction`,
`chooseFromList`) always pass this option, sourcing `requestId` from the
tool handler's second argument (`extra: RequestHandlerExtra`).
`packages/mcp/src/__tests__/elicit.test.ts` asserts every call site
passes the option, so a future helper that forgets it fails CI rather
than failing silently in prod.

### Fallback for clients without elicitation support

When the connecting client (e.g. a custom MCP harness, or an older
Claude Desktop build) never advertised the `elicitation` capability in
its `initialize` handshake, the MCP SDK's
`Server.assertCapabilityForMethod` throws:

> `Client does not support elicitation (required for elicitation/create)`

The helpers catch this exact substring (plus the agents SDK's
`No active connections available for elicitation`, which fires when the
SSE stream has dropped) and return `reason: 'unsupported'`. Each gated
tool maps that into a structured error envelope:

| Helper reason | `structuredContent.error.code` | `retryable` |
| ------------- | ------------------------------ | ----------- |
| `cancelled`   | `user_cancelled`               | false       |
| `mismatch`    | `confirmation_mismatch`        | false       |
| `timeout`     | `confirmation_timeout`         | true        |
| `unsupported` | `elicitation_unsupported`      | false       |

The destructive API call is NOT fired in any of those branches. The
tool-handler tests in `packages/mcp/src/__tests__/tools-admin.test.ts`
assert that explicitly — the spy on the underlying Treaty endpoint sees
zero `delete`/`post` invocations on the cancel / mismatch / unsupported
paths.

### Ambiguous-search elicitation — deferred

The plan flagged `packrat_alltrails_search` as a possible candidate for
`chooseFromList`-style disambiguation. We deferred this because:

- `packrat_preview_alltrails_url` is the only alltrails tool today, and
  it takes a single URL — there's no multi-result step where the user
  has to pick between candidates.
- `packrat_search_trails` already returns a list of trails plus their
  OSM IDs, and the established pattern (`search_trails` →
  `get_trail(osm_id)` → `get_trail_geometry(osm_id)`) puts the
  disambiguation step squarely in front of the model + user with the
  IDs in hand. Layering an elicitation on top would duplicate that
  choice and add a round-trip without changing the outcome.

The `chooseFromList` helper is implemented, tested, and ready to wire
in the moment a real ambiguity surface arrives (likely a future
trail-name fuzzy-search endpoint). This is a connector-store nice-to-
have rather than a blocker, per the plan.

### Where the helpers live

`packages/mcp/src/elicit.ts` — `confirmAction`, `chooseFromList`, and
the `ElicitCapable` / `ElicitAgent` structural types. Designed to be
called with `(agent, extra, opts)` where `agent` is the live
`PackRatMCP` instance (which extends `McpAgent` and inherits
`elicitInput`) and `extra` is the second argument the SDK passes to
every tool handler.

`AgentContext.elicitInput` is optional (see `packages/mcp/src/types.ts`)
so unit tests can construct an agent stub without standing up a Durable
Object — both helpers short-circuit to `reason: 'unsupported'` when the
method is missing, mirroring the live-client missing-capability path.

## U12 legal pages

Anthropic's Software Directory Policy treats a missing or incomplete privacy
policy as an immediate-rejection cause. Both URLs below are reviewer-loaded
during connector intake; the MCP `/health` JSON now references them so the
listing surface, the worker, and the brand domain stay in lockstep.

### Canonical URLs

| Page | URL | Source |
| ---- | --- | ------ |
| Terms of Service | `https://packratai.com/terms-of-service` | `apps/landing/app/terms-of-service/page.tsx` |
| Privacy Policy | `https://packratai.com/privacy-policy` | `apps/landing/app/privacy-policy/page.tsx` |

The footer on every landing page surfaces both via
`siteConfig.footerLinks.legal` (`apps/landing/config/site.ts`); the support
contact (`hello@packratai.com`) is exposed via the new `siteConfig.support`
field on the same config.

### Privacy Policy — MCP addendum

The Privacy Policy includes a "MCP Connector & Third-Party Clients" section
that covers, at minimum:

- OAuth refresh tokens stored at rest in Cloudflare KV (encrypted by KV); 60-
  minute access tokens; 30-day rotating refresh tokens.
- What MCP clients see (only the scopes the user approved) and explicit
  callout that `mcp:admin` is restricted to PackRat admins.
- What MCP clients do NOT see (passwords; conversation content sent to MCP
  clients).
- Retention: grants deleted automatically when the refresh token expires, or
  immediately on revocation.
- Third-party clients (e.g. Claude.ai) — their own privacy policy governs
  their handling of PackRat data.
- Deletion path: account settings or `hello@packratai.com`.

If you add a new MCP data flow, update this section first — reviewers and
end users will read the Privacy Policy before they read the source.

### `/health` JSON references these URLs

`PackRatAuthHandler` (`packages/mcp/src/auth.ts`) now emits the legal +
support URLs from `/` and `/health`:

```jsonc
{
  "status": "ok",
  "service": "PackRat MCP",
  "version": "<from package.json>",
  "transport": "streamable-http",
  "endpoint": "/mcp",
  "docs": "https://packratai.com/mcp",
  "terms": "https://packratai.com/terms-of-service",
  "privacy": "https://packratai.com/privacy-policy",
  "support": "mailto:hello@packratai.com"
}
```

The auth.test.ts `/health` test asserts the three new fields; if you change
either URL, update both the JSON and the test in one commit so the listing
intake and the worker advertisement never drift.

### TODO (operator): jurisdiction in the Terms of Service

`apps/landing/app/terms-of-service/page.tsx` ships with a placeholder
governing-law / venue clause (Delaware, US federal + state courts) and a
`{/* TODO(operator): set jurisdiction */}` marker at that paragraph. Replace
it with the chosen jurisdiction once legal review completes. The smoke test
in `apps/landing/__tests__/legal.pages.test.ts` asserts the TODO marker is
still present — remove that assertion in the same commit that resolves the
TODO, so the marker can't be silently lost.

## U13 listing artifacts

The artifacts a Claude Connector Store reviewer interacts with — public
docs page, brand assets, the favicon Anthropic probes for domain
ownership, the reviewer test account — all land in U13. This section
documents where each one lives and how to refresh it.

### Public docs page

URL: <https://packratai.com/mcp>. Source:
[`apps/landing/app/mcp/page.tsx`](../../apps/landing/app/mcp/page.tsx).
The page is an RSC route in the landing site (`apps/landing`), styled
to match the existing privacy/terms pages (same container width, same
Tailwind tokens — no new component vocabulary).

Information architecture: hero → 3-step Claude.ai quickstart → scopes
table → 3 example prompts (read, multi-tool plan, write with
elicitation) → tool catalog (grouped by domain) → resources →
privacy & security → reviewer test account pointer → footer pointers
to the dev README, plan, and this runbook. Per the doc-review D6
finding, the catalog is **not** a flat 103-tool dump — it groups by
domain (Packs, Trips, Trails, Gear & Catalog, Admin & Analytics, …)
so reviewers and end-users can scan in chunks.

### Catalog regen

The public docs page reads its tool catalog from
`apps/landing/data/mcp-catalog.json`. **Rerun the dump after any tool
surface change** (new tool, rename, annotation tweak, scope
re-classification):

```bash
bun packages/mcp/scripts/dump-catalog.ts
```

Commit the regenerated JSON in the same PR as the tool change so
`packratai.com/mcp` stays in lockstep with the live worker. The script
uses the same recursive-Proxy stub as the U7 annotations test
(`packages/mcp/src/__tests__/annotations.test.ts`), so it picks up
every tool the worker registers without needing a Cloudflare runtime.

If the script exits with `dump-catalog: zero tools registered`, the
MCP SDK's internal `_registeredTools` field shape probably changed —
update both the dump script and the annotations test to use the new
accessor; they walk the same field.

### Brand assets

| Asset | Path | Notes |
| --- | --- | --- |
| MCP connector mark (SVG, 256×256 viewBox) | [`apps/landing/public/mcp-logo.svg`](../../apps/landing/public/mcp-logo.svg) | Used by the public docs page and listing materials. The MCP worker itself no longer renders any branded UI (the login page lived on the worker pre-refactor; the consent page now lives on api.packrat.world — see U1 of the 2026-05-25 refactor plan). If the brand mark changes, update this SVG and the favicon in the same commit so the listing surfaces don't drift. |
| 1024×1024 PNG fallback for the directory listing | not in repo — render from `mcp-logo.svg` at submission time | Operator action; tracked in `docs/mcp/submission-packet.md` § "Logo / favicon checklist". |
| Favicon (32×32 .ico) at the OAuth host | served at `https://mcp.packratai.com/favicon.ico` by the worker | Implementation: [`packages/mcp/src/favicon.ts`](../../packages/mcp/src/favicon.ts) (see "Favicon at OAuth domain" below). |
| Favicon at the brand domain | `apps/landing/public/favicon.ico` and `apps/landing/public/PackRat.ico` (legacy filename still referenced by `apps/landing/lib/metadata.ts`) | Both files exist for compat; the worker's embedded favicon is sourced from `favicon.ico`. |

### Favicon at OAuth domain (Anthropic domain-ownership probe)

Anthropic's domain-ownership verification probe hits
`mcp.packratai.com/favicon.ico` — **not** the landing site at
`packratai.com/favicon.ico`. The two domains are distinct from
Cloudflare's perspective, so the worker has to own the route.

Chosen mechanism (U13): embed the .ico as a base64 string at build
time. `packages/mcp/src/favicon.ts` exports `faviconResponse()`
which returns a `Response` with `Content-Type: image/x-icon`,
`Cache-Control: public, max-age=86400, immutable`, and a fresh
buffer per call. The route is wired up in
`packages/mcp/src/auth.ts` (`PackRatAuthHandler.fetch` —
`/favicon.ico` branch, immediately after `/health`).

Why embedded vs. a runtime fetch to the landing site:
- **Self-contained.** The worker has no extra binding and no
  cross-domain hop on cold start; the probe always succeeds.
- **Small.** ~4.2 KiB binary, ~5.7 KiB base64 — negligible bundle
  overhead.
- **No race on cold start.** A runtime fetch to `packratai.com`
  during a worker boot could 502 if the landing site is in the
  middle of a deploy; the embed avoids that failure mode entirely.

Refresh contract: if the brand icon changes, copy the new file to
`apps/landing/public/favicon.ico`, regenerate the base64 with
`base64 -w 0 < apps/landing/public/favicon.ico`, and paste the
result into `FAVICON_ICO_BASE64` in `packages/mcp/src/favicon.ts`.
The favicon test (`packages/mcp/src/__tests__/favicon.test.ts`)
asserts the `.ico` magic bytes and a non-zero size, so a
copy-paste mistake fails CI loudly.

## U14 rate limiting

PackRat's MCP Worker rate-limits authenticated tool calls via a single
Cloudflare Workers Rate Limiting binding:

| Surface | Backed by | Keyed by | Default budget |
| ------- | --------- | -------- | -------------- |
| Authenticated tool calls | Workers Rate Limiting binding `MCP_TOOLS_RL` | `${userId}:${toolName}` | 60 calls / 60s |
| Anonymous AS endpoints (`/authorize`, `/token`, `/register` on api.packrat.world) | **Zone-level WAF Rate Limiting Rules on the API host** (operator-applied; see TODO below) | client IP | 100 r/s/IP (target) |

The binding configuration lives in
[`packages/mcp/wrangler.jsonc`](../../packages/mcp/wrangler.jsonc) under the
`rate_limiting` block — present in both the top-level/dev base and the
`env.prod` and `env.dev` blocks. Block-key conventions follow
`packages/api/wrangler.jsonc:44`: the block is `rate_limiting` (not
`ratelimits`) and the per-binding field is `binding` (not `name`).

### Binding source change, key shape unchanged

Post-refactor, the **binding** (`MCP_TOOLS_RL`) and **key shape**
(`${userId}:${toolName}`) are unchanged. What changed is the source of
`userId`: the prior implementation read it from the OAuthProvider `props`
object (populated by the U5 `/callback` bridge); the new implementation
reads it from the JWT `sub` claim returned by `verifyMcpToken`. Same
counter independence, same budget, same envelope on exceed.

### Per-user/per-tool counter independence

`MCP_TOOLS_RL.limit({ key: '${userId}:${toolName}' })` runs **before** every
authenticated tool handler. The key shape makes counters independent across
both axes:

- One user spamming `packrat_get_pack` does NOT consume their own
  `packrat_list_trips` budget.
- Two different users both hitting `packrat_get_pack` do NOT share a
  counter — each user gets their own 60/60s slot.

On exceed, the wrapper short-circuits the handler and returns the canonical
U8 envelope `errResponse('rate_limited', 'Rate limit exceeded; try again in
a moment.', true)` — `retryable: true` so the model knows it can back off
and retry. The handler itself never runs.

### Dev fallback

When `env.MCP_TOOLS_RL` is undefined (local `vitest`, some `wrangler dev`
configurations), the call site returns "allowed" without consulting the
binding. Production deploys always bind it via `wrangler.jsonc`; the
fallback exists so onboarding engineers don't need a bound rate-limit
namespace to run the unit suite.

### Fail-open on binding error

`checkRateLimit` in `packages/mcp/src/rate-limit.ts` swallows binding-side
exceptions and returns `true`. The trade-off is documented at the call
site: a brief over-allow window during a Cloudflare-side rate-limit-API
hiccup is preferable to a hard outage of the MCP surface. U15
observability lets us alert on the error volume.

### KV-purge cron — removed

The previous `triggers.crons: ["0 4 * * *"]` block and the
`runScheduledPurge` handler are both gone post-refactor. The AS now lives
on `api.packrat.world` via `@better-auth/oauth-provider`, which handles
its own expiry / cleanup against the API's Postgres + `AUTH_KV`. No MCP
worker-side cron is needed.

### TODO (operator): zone-level WAF Rate Limiting Rules on api.packrat.world

The anonymous OAuth endpoints (`/api/auth/oauth/register`,
`/api/auth/oauth/authorize`, `/api/auth/oauth/token`) live on the API host
now. Apply WAF Rate Limiting Rules on the `packrat.world` zone (or via
Terraform) for that host:

| Path expression                                        | Rule              | Action   |
| ------------------------------------------------------ | ----------------- | -------- |
| `http.request.uri.path contains "/api/auth/oauth/"`    | > 100 r/s per IP  | Block 1m |

100 r/s is generous for legitimate use: a Claude.ai user starting a fresh
connection issues at most 3-4 requests across these endpoints. Tune
downward after observing real traffic for a week. Add an explicit
*allow* rule above the limits for Anthropic's IP ranges if reviewer
probes get blocked during intake — Anthropic publishes the ranges in
the connector-store docs.

### Refreshing the binding budget

The 60/60s default is configured in `wrangler.jsonc` under the
`rate_limiting` block. To change it:

1. Edit `simple.limit` and `simple.period` in the top-level, `env.prod`,
   and `env.dev` blocks.
2. `wrangler deploy --env prod`.
3. Update `docs/mcp/runbook.md` (this section) so the docs match the
   live config.

Changes take effect immediately on the next request after deploy — no
binding-side state to migrate.

### Reviewer test account

Credentials and the populated-data list live in
[`docs/mcp/submission-packet.md`](./submission-packet.md) § 4. The
file ships with `TODO (operator)` placeholders; the operator fills
them in **only** for the form-submission session and does **not**
commit the populated values to the repo.

The public docs page at `packratai.com/mcp` deliberately tells
reviewers the credentials are not on the public page and points
them at the submission-packet doc (which Anthropic receives via the
form, not via a public link).

### Footer link

`apps/landing/config/site.ts` adds `MCP Connector` to
`siteConfig.footerLinks.product` so the landing site's footer
exposes the public docs page. The landing-site smoke tests cover
the legal links; the MCP page itself is RSC-rendered and shipped
without a separate vitest assertion (the catalog JSON is the
build-time contract).

---

## U15 observability

The MCP Worker emits structured JSON logs via `console.log/warn/error`.
Workers Logs ingests them as structured events, and a Cloudflare-dashboard
**OTel pipeline** forwards them to Sentry's OTLP endpoint. There is NO
in-process Sentry SDK in the worker — by design (smaller bundle, no
SDK-version drift, no need to handle SDK initialisation in the DO
constructor).

### Operator TODO: enable the OTel → Sentry pipeline

Required dashboard click-path (do once per environment, after the U1
`SENTRY_DSN` secret is set):

1. **Cloudflare dashboard** → Workers & Pages → `packrat-mcp` (or
   `packrat-mcp-dev`).
2. **Observability** → **Telemetry** → **Add destination** →
   **OTLP**.
3. Endpoint: the Sentry OTLP ingest URL for your project (find it in
   Sentry → Settings → Projects → packrat-mcp → Client Keys (DSN) → use
   the "OTLP" tab).
4. Authentication: **Headers** → add `x-sentry-auth: sentry_key=<DSN
   public key>` (the public key is the segment of the DSN before `@`).
5. **Resource attributes** (recommended): `service.name=mcp`,
   `deployment.environment=prod` (or `dev`).
6. **Sampling**: 100% on `WARN`/`ERROR`; 5% on `INFO` (cost guardrail).
7. Save. The pipeline activates within ~1 minute. Verify by triggering a
   known WARN (e.g. `curl -X POST https://mcp.packratai.com/mcp` with no
   Authorization header — this emits `mcp.auth.jwt.denied
   reason=missing_bearer`) and watching Sentry's Issues view.

The `SENTRY_DSN` secret (set as a placeholder by U1) is **not** read by
the worker. It's surfaced in the runbook so operators have one canonical
place to look for the DSN value when configuring the pipeline; the
worker's logs reach Sentry exclusively via the OTLP pipeline.

### Log shape

Every log line is a single JSON object on one line:

```json
{
  "ts": "2026-05-22T04:00:00.000Z",
  "level": "info" | "warn" | "error" | "debug",
  "msg": "human-readable message",
  "correlationId": "ray-or-uuid-or-cron:timestamp",
  "service": "mcp",
  "...": "additional structured fields (allowlisted)"
}
```

`ts` is ISO-8601 UTC. `level` is the canonical lowercase severity.
`correlationId` and `service` are pinned on every line so Workers Logs
filters can pivot on them without per-call instrumentation.

### Correlation IDs

Each inbound request receives a correlation ID at the top of the outer
`fetch` wrapper (`packages/mcp/src/index.ts`):

- Prefers the `cf-ray` header (every Cloudflare-fronted request has one,
  and the value matches the upstream zone log so an operator can pivot
  between Workers Logs / Sentry / the Cloudflare dashboard for the same
  request).
- Falls back to `crypto.randomUUID()` for off-CF tests or the rare
  upstream-strip case.
- Stashed on the Request via a per-request `WeakMap` so deep handlers
  (the JWT verification path in `token-verify.ts`, the `/health`
  handler, etc.) can read it via `getCorrelationId(request)` without
  plumbing the id through every function signature. **Not
  AsyncLocalStorage** — Workers ALS support is still gated behind a
  compatibility flag we don't set.
- Echoed on every outbound response as `X-Correlation-Id: <id>` so the
  caller can quote it when reporting issues.

For code paths without an inbound Request (today only the scheduled
cron sweep), `syntheticCorrelationId('cron')` mints `cron:<unix-ms>`.

### Audit log shape

Admin tool invocations emit a structured audit line via
`audit(logger, '<action>', { actor, target, outcome, ... })`:

```json
{
  "ts": "...",
  "level": "info",
  "msg": "mcp.audit.admin_hard_delete_user",
  "action": "admin_hard_delete_user",
  "actor":  { "userId": "...", "scopes": ["mcp:admin", "mcp:write"] },
  "target": { "type": "user", "id": "u-42" },
  "outcome": "success" | "failure" | "declined",
  "error":   { "code": "...", "retryable": false },   // failure / declined only
  "correlationId": "session:<DO-id>",
  "service": "mcp"
}
```

The `mcp.audit.` prefix on `msg` is the operator-facing namespace filter
for Sentry / Workers Logs. Six tools currently audit:

- `packrat_admin_hard_delete_user`
- `packrat_admin_delete_pack`
- `packrat_admin_delete_catalog_item`
- `packrat_admin_delete_trail_condition_report`
- `packrat_create_app_pack_template` (PUBLISH gate)
- `packrat_generate_pack_template_from_url` (GENERATE gate)

`outcome: 'declined'` is used when the U10 elicitation surface returned
`confirmed: false` — the action did not run, but the intent was made
known to the server and is recorded with the canonical error code
(`user_cancelled`, `confirmation_mismatch`, `confirmation_timeout`,
`elicitation_unsupported`).

### Auth-failure WARN logs

The MCP worker is a pure protected resource post-refactor — token
issuance lives on `api.packrat.world`. The remaining auth-side WARN
surface on this worker is JWT validation:

| Surface              | `msg`                              | `reason` values                                                                           |
| -------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `POST /mcp` (JWT validation) | `mcp.auth.jwt.denied`      | `missing_bearer`, `bad_scheme`, `invalid_token`, `expired`, `bad_audience`, `bad_issuer`, `jwks_fetch_failed` |

Better Auth's OAuth-provider plugin emits its own structured errors on
the API side (see the API package's observability surface); reviewer
auth-failure analysis spans both workers.

### Redaction policy — no tokens, no PII, default-deny field allowlist

`packages/mcp/src/observability.ts` exports `scrubFields()`, which every
log line passes through before emit. The policy is **default-deny on a
top-level allowlist** (not a denylist):

- Allowed top-level keys: `correlationId`, `service`, `ts`, `level`,
  `msg`, `requestId`, `method`, `path`, `statusCode`, `duration`,
  `iteration`, `iterations`, `done`, `code`, `description`, `reason`,
  `retryable`, `oauthCode`, `oauthStatus`, `action`, `outcome`, `actor`,
  `target`, `error`, `grantsChecked`, `grantsPurged`, `tokensChecked`,
  `tokensPurged`, `cap`, `tool`, `toolName`.
- `actor` allows nested `userId`, `scopes`.
- `target` allows nested `type`, `id`.
- `error` allows nested `code`, `message`, `retryable`.
- **Anything else collapses to `'[redacted]'`** with the key preserved
  (so triage can see "the caller tried to log X but it was scrubbed").
- Functions are dropped entirely.

What is **never** logged: `betterAuthToken`, `props`, OAuth `code`,
bearer tokens, refresh tokens, passwords, email addresses, IP addresses,
full URLs (only bounded path/origin is okay), the request/response body,
the user's typed elicitation answer.

To add a field to the allowlist, edit `TOP_LEVEL_ALLOWLIST` in
`observability.ts`. **Every addition is a code-review event** — that's
the property we want for telemetry hygiene.

### Operator TODO: confirm Sentry routing

After enabling the OTel pipeline, verify end-to-end:

1. `curl -i -X POST https://mcp.packratai.com/mcp` (no Authorization).
2. The response includes `X-Correlation-Id: <ray-id>` and 401 +
   `WWW-Authenticate: Bearer resource_metadata=...`.
3. `wrangler tail --env prod --format pretty | grep jwt.denied`
   shows `{"ts":...,"level":"warn","msg":"mcp.auth.jwt.denied",
   "correlationId":"<ray-id>","reason":"missing_bearer",...}`.
4. Sentry Issues view receives a matching event tagged
   `service.name=mcp`, `correlationId=<ray-id>`, with the message
   `mcp.auth.jwt.denied`.

If steps 3 and 4 don't align within ~30 seconds, the OTel pipeline is
mis-configured (most often: missing `x-sentry-auth` header or a typo
in the OTLP endpoint).

---

## U16 /health + /status

Two unauthenticated read-only endpoints reviewers (and uptime probes)
hit to verify the Worker is healthy and to read its public metadata.

### `/health` — real dependency probe

`GET /health` (and `GET /`, which dispatches to the same handler) probes
the single upstream dependency (the API host that also serves the AS
metadata + JWKS) and returns 200 only when it succeeds:

| Probe | Mechanism                                                  | Pass = `'ok'`, fail = `'down'`  |
| ----- | ---------------------------------------------------------- | ------------------------------- |
| API   | `fetch(env.PACKRAT_API_URL + '/health')` with 3s timeout   | `res.ok` (HTTP 2xx)             |

The API probe hits the PackRat API's root `/health` endpoint
(`packages/api/src/index.ts:86`), **not** `/api/health` — Elysia mounts
the meta route at the worker root, so the canonical URL is
`${PACKRAT_API_URL}/health`. If we ever move the API to a versioned
path prefix, this URL needs to update in lockstep.

The prior `OAUTH_KV.list` probe is removed — the MCP worker no longer
binds KV.

Response body shape (stable — reviewers parse this):

```json
{
  "status": "ok" | "degraded",
  "service": "packrat-mcp",
  "version": "<from constants.ts>",
  "transport": "streamable-http",
  "endpoint": "/mcp",
  "docs":    "https://packratai.com/mcp",
  "terms":   "https://packratai.com/terms-of-service",
  "privacy": "https://packratai.com/privacy-policy",
  "support": "mailto:hello@packratai.com",
  "probes":  { "api": "ok" | "down" }
}
```

HTTP status: 200 when the probe is `'ok'`, 503 otherwise. The
legal/support URLs (U12) are surfaced on **both** the healthy and
degraded responses so a reviewer curling `/health` during an incident
still finds the contact surface.

### Cache strategy — 10s isolate-local

The probe result is cached in an isolate-local module slot
(`packages/mcp/src/auth.ts → healthCache`) for 10 seconds. Trade-offs:

- **Why cache at all?** Without it, an external uptime monitor polling
  every 5s would synthesize 12 API fetch calls/minute per isolate —
  easy to miss as a load source. 10s keeps the steady-state probe rate
  ≤6/min/isolate.
- **Why 10 seconds?** Short enough that a real outage surfaces within
  one cache-window of when it began (no reviewer waits 30s for /health
  to flip red). Long enough that consecutive uptime probes hit the
  cache.
- **Why per-isolate (not Worker-wide)?** A shared cache would mean an
  extra fetch round-trip on every probe — defeating the point of
  caching. Per-isolate scales with the isolate pool (single digits for
  our traffic shape) so worst-case the dependency surface sees ≤N
  probes/10s where N is the pool size.
- **Module-level `let healthCache`** (not WeakMap / LRU) is deliberate:
  the cache holds exactly one entry, and the simplest possible
  eviction story keeps future refactors honest. The
  `__resetHealthCacheForTests` helper is exported for vitest only —
  production code never calls it.

### Incident response

The `probes` field tells you which dependency tripped:

```bash
curl -s https://mcp.packratai.com/health | jq
# {"status":"degraded", ..., "probes":{"api":"down"}}
#                                              ^^^^^^^ → PackRat API outage
```

The degraded path also emits a WARN-level structured log:

```bash
wrangler tail --env prod --format pretty | grep mcp.health.degraded
# {"ts":"...","level":"warn","msg":"mcp.health.degraded","reason":"api_down","statusCode":503,...}
```

`reason` is `api_down`. The healthy path is silent so external uptime
probes don't fill Workers Logs with noise. If the probe fails, escalate
to the API on-call (the same probe failure also breaks JWT validation,
since `token-verify.ts` fetches JWKS from the same host).

### `/status` — public-safe extended metadata

`GET /status` returns a static metadata block — no upstream calls, no
503 path. Reviewers use this to verify a deployed Worker matches the
version + scope catalog they were promised.

```json
{
  "service": "packrat-mcp",
  "version": "<from constants.ts>",
  "transport": "streamable-http",
  "endpoint": "/mcp",
  "scopes_supported": ["mcp", "mcp:read", "mcp:write", "mcp:admin"],
  "docs":    "https://packratai.com/mcp",
  "terms":   "https://packratai.com/terms-of-service",
  "privacy": "https://packratai.com/privacy-policy",
  "support": "mailto:hello@packratai.com",
  "deployId": "<cloudflare version id>" | "unknown"
}
```

**No secrets ever**: the response only contains version + scopes +
public URLs + the Cloudflare deploy id. Adding a new field requires a code review
that explicitly notes the field is non-sensitive — the auth.test.ts
suite asserts a denylist of secret-looking keys is absent so a
careless refactor that surfaces `env` more broadly regresses visibly.

### `deployId` — no operator action needed

`/status` surfaces `deployId` from `env.CF_VERSION_METADATA.id` — the
Cloudflare `version_metadata` binding declared in `wrangler.jsonc`. The
runtime injects it on every deploy, so there is **nothing to set** at
deploy time: no `--var`, no CI step. It behaves identically under
`wrangler deploy` and Cloudflare Workers Builds.

`id` is the Cloudflare version UUID; Workers Builds maps it back to the
originating git commit in its dashboard. When the binding is absent
(`wrangler dev`, vitest) `/status` returns `deployId: "unknown"` —
expected for local, and harmless. A prod hostname returning `unknown`
means the `version_metadata` binding was dropped from the config.

### CORS interaction

Neither `/health` nor `/status` is annotated by the U6 CORS handler
(`applyCorsHeaders` short-circuits on a `/.well-known/` prefix check —
see `packages/mcp/src/cors.ts:48`). Reviewers curl them directly so no
CORS dance is needed; if Claude.ai ever needed to fetch them
cross-origin, the allowlist would have to extend.

Neither endpoint requires auth — they're explicitly public surfaces. JWT
validation only fires on `/mcp` (the MCP transport endpoint).

---

## U17 CI + integration tests

MCP uses the repository's shared CI gates rather than a bespoke PR
workflow:

- `.github/workflows/checks.yml` runs repo-wide Biome, custom lint rules,
  unsafe-cast checks, route-auth checks, and `bun check-types`.
- `.github/workflows/coverage.yml` runs the MCP test suite with coverage
  (`bun run --cwd packages/mcp test --coverage`) and includes it in the
  ratchet.
- `.github/workflows/api-tests.yml` runs the API suite, including the
  auth and admin guard tests that protect the OAuth/Admin side of the MCP
  contract.

`packages/mcp` still has a local `check-types` script
(`tsc --noEmit`). It now runs in ~1 GB / a few seconds: the
`tool()`/`prompt()` wrappers (`src/registerTool.ts`) erase the SDK's
`registerTool`/`registerPrompt` generics against `never`, so the
recursive Zod-shape instantiation that used to push tsc past 14 GB is
gone.

### Prod deploy — Cloudflare-native (no bespoke workflow)

There is no `mcp-deploy.yml`. The MCP Worker deploys the same way the API
Worker does — **Cloudflare Workers Builds** (the git-connected build in the
Cloudflare dashboard): connect the `packrat-mcp` Worker to this repo, set
the deploy command to `bun run --cwd packages/mcp deploy`
(`wrangler deploy --minify`), and CF rebuilds + deploys on the configured
branch. The shared PR gates above are what keep tested code flowing to
prod; there is no deploy-time re-run of the suite.

`deployId` on `/status` comes from the `version_metadata` binding
automatically (see § "`deployId` — no operator action needed") — no
`--var`, no SHA-stamping step, no tagged-commit resolution.

**Manual fallback** (operator, from `packages/mcp`):

```bash
wrangler deploy --env prod     # prod → mcp.packratai.com
bun run deploy:dev             # dev  → packrat-mcp-dev
```

Because deploys are no longer tag-triggered, there is no `mcp-v*` tag
convention and no `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` repo
secrets to provision for MCP. Workers Builds carries its own Cloudflare
auth; a manual `wrangler deploy` uses the operator's local `wrangler login`.

Both secrets must be set at the **repository** level (not the
environment level — the deploy workflow doesn't use a GitHub
Environment object, intentionally, to keep the trigger surface
small).

### Tag convention

```bash
# Bump version in packages/mcp/package.json + src/constants.ts (single
# source of truth — they MUST match; `auth.test.ts` asserts this).
git commit -am "chore(mcp): bump to v2.1.0"
git tag mcp-v2.1.0
git push origin main mcp-v2.1.0  # tag push triggers the deploy
```

Pre-deploy checklist (run locally before pushing the tag):

- `bun run --cwd packages/mcp test` — 1,123 tests must pass.
- Verify `version` in `packages/mcp/package.json` matches
  `ServiceMeta.Version` in `packages/mcp/src/constants.ts`.

### vitest-pool-workers integration suite — current state

`packages/mcp/vitest.workspace.ts` declares two projects:

- `mcp-unit` — Node-environment tests for pure modules (the existing
  1,123-test surface). Fast; no workerd.
- `mcp-integration` — wired but tests currently deferred as
  `it.todo`. The harness boots cleanly (`bun run --cwd packages/mcp
  test:integration` discovers all four integration files); the only
  reason real assertions don't run is the upstream blocker below.

**Why deferred:** the Worker entrypoint transitively imports the MCP
SDK, which loads `ajv@^8` at module-eval time. `ajv` does
`require('./refs/data.json')`, and workerd's CJS module-fallback path
treats JSON content as JS code — the worker won't boot inside
vitest-pool-workers until one of two upstream fixes lands:

1. vitest-pool-workers' `handleModuleFallbackRequest` learns to apply
   user-supplied `modulesRules` to bare JSON requires (currently the
   rules array is only applied via the vite RPC patch, not the
   workerd-side resolution chain).
2. The MCP SDK accepts an injected `jsonSchemaValidator` we can stub
   in tests — bypassing `ajv` entirely.

Until then the `it.todo` placeholders in
`packages/mcp/src/__tests__/integration/*.test.ts` preserve the
contract intent and `vitest run` reports the deferred-todo count so
the gap stays visible. Unit-level coverage of every deferred contract
exists in the corresponding `../*.test.ts` files (well-known →
`metadata.test.ts`, health/status → `auth.test.ts`, JWT validation →
`token-verify.test.ts`). The previous DCR-gate integration entry is
gone — DCR was deleted in U3+U4 of the 2026-05-25 refactor.

**First-invocation note (for when the integration tests light up):**
`@cloudflare/vitest-pool-workers` downloads `workerd` on first run
(~30s, one-time per machine + version). Subsequent runs are warm.

### Miniflare bindings for the deferred integration suite

Post-refactor (2026-05-25) the MCP worker no longer binds KV at all —
`OAUTH_KV` and `MCP_INITIAL_ACCESS_TOKEN` are gone. The integration
config (`packages/mcp/vitest.integration.config.ts`) accordingly carries
**no KV stubs and no DCR-token stub**; the only required binding when
the suite eventually swaps back to `defineWorkersProject` is
`PACKRAT_API_URL` (so `verifyMcpToken` can fetch the JWKS — either
against a mock-fetch or a locally-running API worker). The Durable
Object + rate-limit bindings come from `wrangler.jsonc` unchanged.

**No live Cloudflare creds are needed for the test run** — miniflare
synthesises the DO + RL bindings in-process, and the JWKS fetch is the
only outbound dependency to mock.

---

## U18 submission packet + readiness script

The last unit of the connector-store readiness plan ships two operator
surfaces: a programmatic pre-submission probe and a fully-resolved
submission packet document. Together they replace the "operator reads
13 different runbook sections and ad-hoc curls each one" pattern with a
single command + a single doc.

### `bun packages/mcp/scripts/submission-readiness.ts` — cross-origin probe

Default target is production. Post-refactor the AS and RS live on
different origins, so the legacy `--url` flag is gone — pass
`--rs-url` (MCP resource server) and `--as-url` (Better Auth AS) as
separate args when probing a non-prod environment. The script is
**a deployed-server probe** — it cannot run before both workers are
deployed, and it never mutates state.

```bash
# Default: probes https://mcp.packratai.com (RS), https://api.packrat.world (AS),
# and https://packratai.com (brand). Reads the catalog from apps/landing/data/mcp-catalog.json.
bun packages/mcp/scripts/submission-readiness.ts

# Against staging
bun packages/mcp/scripts/submission-readiness.ts \
  --rs-url https://packrat-mcp-dev.<acct>.workers.dev \
  --as-url https://packrat-api-dev.<acct>.workers.dev

# CI / machine-readable
bun packages/mcp/scripts/submission-readiness.ts --json
```

Exit codes: `0` = every check passed; `1` = at least one check failed;
`2` = bad CLI args. Default output is colour-coded one-line-per-check
plus an `N passed / M warned / K failed` summary; `--json` emits a
structured report suitable for piping into a CI job.

#### The checks at a glance

| # | What it asserts | Host | Failure recovery |
| - | --- | --- | --- |
| 1 | TLS + custom domain reachability — `GET /` returns 200 over HTTPS on the right host | RS | DNS not propagated; cert not provisioned; worker not deployed |
| 2 | `/mcp` returns 401 with `WWW-Authenticate: Bearer resource_metadata=..., scope=...` (RFC 9728 §5.1) | RS | `index.ts` outer fetch wiring drifted; PRM URL stale |
| 3 | `/.well-known/oauth-protected-resource` has `resource`, `authorization_servers`, all 4 scopes, `bearer_methods_supported: ['header']` | RS | `packages/mcp/src/metadata.ts` drifted from the plan |
| 4 | `/.well-known/oauth-authorization-server` advertises `S256`, `authorization_code`, `refresh_token`, `code` | AS | `@better-auth/oauth-provider` config drift; `allowPlainCodeChallengeMethod` flipped on |
| 5 | Pre-registered Claude client present in the AS `oauthClient` table — **always WARN** (no public client-list endpoint) | AS | Re-run `cd packages/api && bun run db:seed:oauth-clients` (idempotent — no-op if already registered) or inspect the `oauthClient` table directly |
| 6 | `/favicon.ico` returns 200 image/x-icon with the .ico magic bytes (Anthropic's domain-ownership probe) | RS | `packages/mcp/src/favicon.ts` corrupted; re-embed per the U13 contract |
| 7 | `packratai.com/mcp` renders with `PackRat`, `Claude.ai`, `scope` text present | brand | Landing site deploy failed; route 404'd |
| 8 | `/privacy-policy` and `/terms-of-service` return 200 AND contain `mcp` or `connector` | brand | Legal pages missing the MCP addendum — Anthropic immediate-reject cause |
| 9 | `/health` JSON includes `support: mailto:hello@packratai.com` | RS | U12 mapping drifted |
| 10 | `/health` returns `status: 'ok'` with `probes.api: ok` | RS | The API dependency is degraded; check `wrangler tail` |
| 10b | `/status` advertises `scopes_supported` with all 4 PackRat scopes | RS | U16 metadata drifted |
| 11 | Every tool in the catalog has `title` + `readOnlyHint` + `destructiveHint` (when not read-only) | local | Re-run `bun packages/mcp/scripts/dump-catalog.ts`; the U7 annotations test should have caught this |
| 12 | Tool descriptions contain no forbidden marketing words (`revolutionary`, `AI-powered` as a value claim, etc.) | local | Edit the offending description in `packages/mcp/src/tools/*.ts`; re-dump catalog |

The prior `dcr_gate` check (probe `POST /register` for 401) is **gone**:
post-refactor the MCP worker has no `/register` route and the AS has
`allowDynamicClientRegistration: false`, so there's nothing to probe.

#### Honest gaps in automation

- **Check 5** (pre-registered Claude client) cannot be automated:
  `@better-auth/oauth-provider` does not expose a public client-list
  endpoint and DCR is disabled, so the script always emits a WARN
  pointing at the seed script + the `oauthClient` table. Verify
  manually by re-running
  `cd packages/api && bun run db:seed:oauth-clients` (idempotent —
  no-op if already registered) or by querying the `oauthClient` table
  directly. This is the only check that does not assert by default.
- WAF rule audits are not probed — they require a non-Cloudflare-egress
  client to test, which a Worker-side script cannot synthesize. See
  § "TODO (operator): zone-level WAF Rate Limiting Rules" above.

### Catalog source for checks 12 and 13

The two catalog-shape checks read from
`apps/landing/data/mcp-catalog.json` (dumped by U13's
`scripts/dump-catalog.ts`). If the catalog file is missing or stale,
re-run the dump first:

```bash
bun packages/mcp/scripts/dump-catalog.ts
bun packages/mcp/scripts/submission-readiness.ts
```

Override the catalog path with `--catalog /tmp/other-catalog.json` if
you need to probe an older snapshot.

### Unit tests

The check primitives are pure and have a comprehensive unit suite at
`packages/mcp/src/__tests__/submission-readiness.test.ts` (62 tests).
The shared coverage workflow runs them alongside the rest of the MCP test
surface. If a check's output shape ever drifts (new severity level,
renamed status string), this suite fails loudly so the formatter, the
readiness probe, and this runbook stay in lockstep.

### Submission packet doc

[`docs/mcp/submission-packet.md`](./submission-packet.md) is the
operator's filing reference. It contains:

- The form URL (<https://clau.de/mcp-directory-submission>).
- A field-by-field mapping (every Anthropic form field → the
  copy-pasteable PackRat value).
- The 13-check pre-submission checklist with manual-verification
  fallbacks.
- The reviewer test account setup runbook.
- The known-limitations / explicitly-deferred section (SSO, integration
  `it.todo` cases, Tier 2 outputSchema tools, WAF rules, OTel pipeline).
- The rejection-recovery playbook (same-day fixable vs. multi-day
  re-architect).

The operator does not commit the populated reviewer credentials to the
repo — the doc carries `TODO (operator)` placeholders.

### CI: `workflow_dispatch` trigger

`.github/workflows/mcp-readiness.yml` runs the readiness script from
GitHub Actions on-demand. Use it before pushing the `mcp-v*` deploy tag
so the production probe runs against a CI-clean environment without
needing local wrangler / bun.

```
GitHub → Actions → "MCP Submission Readiness" → Run workflow →
  rs_url:       https://mcp.packratai.com   (default; override for staging)
  as_url:       https://api.packrat.world   (default; override for staging)
  brand_domain: https://packratai.com       (default)
  → Run
```

The job exits 0 on green / 1 on red so the workflow surfaces a clear
status badge. Re-run after every deploy that touches metadata, scope,
or annotation surfaces.

---

## Common operations

### Deploy

```bash
# Dev (manual)
bun run deploy:dev

# Prod — Cloudflare Workers Builds deploys on push (like the API).
# Manual fallback (no --var needed; deployId comes from version_metadata):
wrangler deploy --env prod
```

### Tail logs

```bash
wrangler tail --env prod --format pretty
```

### Rotate `PACKRAT_API_URL`

```bash
wrangler secret put PACKRAT_API_URL --env prod
# Forces the JWKS cache on the next request to re-fetch from the new URL.
# Use a benign env var bump alongside (per § "Forcing isolate rotation
# after a deploy") so existing isolates rotate immediately rather than
# waiting on natural isolate churn.
```

## Post-refactor dev verification (R11 gate)

Before tagging the prod release that lands the Better Auth OAuth consolidation
(plan: [`docs/plans/2026-05-25-001-refactor-mcp-auth-onto-better-auth-plan.md`](../plans/2026-05-25-001-refactor-mcp-auth-onto-better-auth-plan.md)),
the operator manually installs the connector in a real Claude.ai account
against the dev deploy URLs to confirm the cross-origin AS flow works
end-to-end. Anthropic has documented but unfixed issues with cross-origin
discovery in Claude.ai (`anthropics/claude-ai-mcp#82, #248, #291` —
closed-as-not-planned); this checklist catches them before prod.

The unit + integration tests cannot prove this works — the deferred
`it.todo` cases (per § "vitest-pool-workers integration suite — current
state" above) are blocked on an upstream ajv module-resolution fix, and
even when they light up they exercise the worker boundary, not Claude.ai's
actual discovery client. **This manual install IS the integration test
for the refactor.**

### Operator steps

1. Deploy to dev manually — `bun run deploy:dev` from `packages/mcp`
   (and the equivalent for the API worker) ships the current commit to
   `packrat-mcp-dev` + `packrat-api-dev`. Keep prod deploys (Workers
   Builds on the configured branch, or a manual `wrangler deploy --env
   prod`) until after this dev gate passes.
2. Open `https://claude.ai` in a fresh browser profile (no PackRat cookies
   from a prior session — the AS-domain switch should be visible in the
   address bar).
3. Settings → Connectors → Add custom connector → URL:
   `https://packrat-mcp-dev.<account>.workers.dev/mcp` (or whatever dev
   URL the deploy assigns).
4. Walk through the OAuth flow. Expected:
   - Claude fetches `/.well-known/oauth-protected-resource` from the dev MCP.
   - Reads `authorization_servers: ["https://packrat-api-dev.<account>.workers.dev"]`
     (or whatever the dev API URL is).
   - Fetches AS metadata from the dev API root
     (`/.well-known/oauth-authorization-server`).
   - Opens a browser to the dev API's `/oauth2/authorize`.
   - User sees the branded consent page (PackRat logo, Claude as the
     client name, scope checkboxes).
5. Sign in with the reviewer test account credentials (§ 4 of
   [`docs/mcp/submission-packet.md`](./submission-packet.md)).
6. Approve the consent screen. Confirm the scope list shows only the
   four MCP scopes (or fewer if the test account isn't admin — `mcp:admin`
   should be absent for non-admin users).
7. Confirm redirect back to Claude.ai succeeds without an error toast.
8. In Claude, ask a simple `mcp:read` prompt: *"List the packs I have on
   PackRat."* Confirm a tool call fires and returns expected output.
9. Ask a `mcp:write` prompt: *"Create a new pack called 'Dev Verification
   Test'."* Confirm the write succeeds.
10. **Test account with admin role:** ask a `mcp:admin` prompt that confirms
    admin tools are visible. **Test account without admin role:** confirm
    admin tools are absent from `tools/list`.
11. Wait at least 65 minutes (longer than the 60-min access token TTL) and
    confirm refresh-token grant happens transparently — another tool call
    works without re-consent.

### Failure mode catalog

If any step fails, escalate per the plan's HLD "Cross-origin failure-mode
catalog" table. Realistic fallback path if Claude.ai's cross-origin
discovery is broken: reverse-proxy the AS endpoints onto
`mcp.packratai.com` (documented as a follow-up plan, **not built** in this
refactor).

Common failure modes to look for:

- **CORS preflight failure on `/.well-known/oauth-authorization-server`
  from `https://claude.ai`** → API worker missing the AS host in its CORS
  allowlist for the well-known prefix. Fix on the API side.
- **Authorization header stripped on cross-origin redirect** → Claude.ai
  proxy stripping `Authorization` between the AS callback and the MCP
  worker. Catchable by inspecting the network panel in DevTools. No
  workaround within MCP/AS — fall back to the reverse-proxy plan.
- **`invalid_client` at `/oauth2/token`** → seed script wasn't run for
  this dev env, or the dev client_id Claude is using doesn't match.
  Re-run `cd packages/api && bun run db:seed:oauth-clients` against
  the dev DB.
- **`invalid_audience` or 401 from MCP after a successful token grant** →
  the AS isn't sending `resource` correctly, so an opaque token was
  issued instead of a JWT. Inspect the granted access token; if it's
  not a JWT (no three `.`-separated base64 segments), the AS is wrong.
- **Refresh-token rejection at the 65-min boundary** → Better Auth
  rotation policy diverged from Claude's expectation. Capture the
  rejection's `error` field and escalate.

### Tag prod on green

If verification passes: tag `mcp-vX.Y.Z` and CI deploys to prod. After the
prod deploy lands, run the operator cleanup per § "Deprovision the legacy
OAUTH_KV namespaces + DCR secret" above.

## Known issues / environment notes

- **`tsc --noEmit` (i.e. `bun run check-types`) OOMs on machines under ~16 GB
  RAM.** The MCP SDK's type surface is large; combined with the package's
  own types, type-checking needs `NODE_OPTIONS=--max-old-space-size=16384`
  or a workstation with more headroom. **Type validation is the CI pipeline's
  job** (U17); locally, rely on `bun test` (which runs vitest on the unit
  surface) and let CI catch type regressions.

## See also

- [`packages/mcp/.dev.vars.example`](../../packages/mcp/.dev.vars.example) — required env vars
- [`packages/mcp/wrangler.jsonc`](../../packages/mcp/wrangler.jsonc) — env / route / binding structure
- [The implementation plan](../plans/2026-05-22-001-feat-mcp-connector-store-readiness-plan.md)
