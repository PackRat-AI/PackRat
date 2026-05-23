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

## One-time operator setup

These steps are required before `wrangler deploy --env prod` can succeed.
They live outside the codebase because they touch Cloudflare account state.

### 1. Create KV namespaces

```bash
# Production namespace
wrangler kv namespace create OAUTH_KV
# Note the returned id and replace __TODO_OAUTH_KV_PROD_ID__ in
# packages/mcp/wrangler.jsonc → env.prod.kv_namespaces[0].id

# Dev namespace (also serves as preview_id for `wrangler dev`)
wrangler kv namespace create OAUTH_KV --preview
# Replace __TODO_OAUTH_KV_DEV_ID__ in both the top-level kv_namespaces
# and env.dev.kv_namespaces (used for id and preview_id).
```

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
# value: https://api.packrat.world

wrangler secret put MCP_INITIAL_ACCESS_TOKEN --env prod
# value: a random 32-byte bearer used to authorize POST /register;
# generate via `openssl rand -hex 32`. Without it set, /register
# returns 401 to every caller.

# Optional (used by U15)
wrangler secret put SENTRY_DSN --env prod
```

Repeat for `--env dev` with dev values.

### 4. Pre-register Claude as a trusted OAuth client (U4)

Once the worker is deployed and `MCP_INITIAL_ACCESS_TOKEN` is set, run:

```bash
# From repo root:
bun packages/mcp/scripts/register-claude-clients.ts --env prod

# Dev worker (URL must be passed explicitly — no canonical *.workers.dev URL):
bun packages/mcp/scripts/register-claude-clients.ts --env dev \
  --url https://packrat-mcp-dev.<your-account>.workers.dev
```

Token resolution order: `--token <value>` flag → `MCP_INITIAL_ACCESS_TOKEN`
env var → `packages/mcp/.dev.vars`. The script POSTs to `/register` twice
(once for `https://claude.ai/api/mcp/auth_callback`, once for
`https://claude.com/api/mcp/auth_callback`) and prints the issued
`client_id` + `client_secret` for each — record both immediately if you
need to reuse them, because the Worker only retains the secret's hash.

The script is idempotent: HTTP 409 or any "already exists" / "duplicate"
response is treated as a skip, not a failure.

### DCR gating contract (U4)

Every `POST /register` request is gated by an outer fetch wrapper in
`packages/mcp/src/index.ts` that calls `dcrRegisterGate` from
`packages/mcp/src/auth.ts` *before* the OAuthProvider sees the request.
The gate is **fail-closed**:

| Authorization header                          | Result |
| --------------------------------------------- | ------ |
| Missing                                       | 401    |
| Wrong scheme (`Basic ...`)                    | 401    |
| `Bearer` but no token value                   | 401    |
| `Bearer <wrong-token>`                        | 401    |
| `Bearer <correct-token>`, env var **unset**   | 401    |
| `Bearer <correct-token>`, env var matching    | passes through to `OAuthProvider.handleClientRegistration` |

The same 401 is returned for non-POST `/register` requests, so an attacker
cannot probe whether `MCP_INITIAL_ACCESS_TOKEN` is set by varying the
method.

The library option `disallowPublicClientRegistration: true` is also set
inside the OAuthProvider config as defense-in-depth: even if the gate were
removed, public clients (`token_endpoint_auth_method: 'none'`) would still
be rejected.

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

## Login form security (U6)

The MCP `/login` POST has three independent checks before it forwards
credentials to Better Auth:

| Check | Failure mode |
| ----- | ------------ |
| `Origin` matches `https://mcp.packratai.com` or the request URL's own origin, **or is missing** | 403 |
| Cookie `__Host-PR_CSRF` is present and equals the form's hidden `csrf` field | 400 |
| The same CSRF value is present in KV under `csrf:<stateKey>` (set at `/authorize`) | 400 |
| `checkLoginRateLimit(env, ip)` returns `true` (today stubbed; U14 wires the binding) | 429 |

The KV anchor is the load-bearing CSRF defense — a pure double-submit
cookie can be forged by a subdomain XSS, but an attacker can't fabricate
a matching `csrf:<stateKey>` entry without controlling the worker's KV.

The Origin check is intentionally permissive when the header is missing:
some MCP-flow user agents (CLI clients, headless flows) don't send an
`Origin` header, and rejecting them would break legitimate flows. The
CSRF and KV checks still apply.

### Rate-limit hook stub (U14 swap point)

`checkLoginRateLimit(env, ip)` in `packages/mcp/src/auth.ts` today always
returns `true`. U14 will swap the body to call
`env.MCP_TOOLS_RL.limit({ key: \`login:${ip}\` })` once the Workers Rate
Limiting binding is wired up in `wrangler.jsonc`. The signature
(`(env, ip): Promise<boolean>`) is stable, so U14 only edits the
function body — not the `handleLoginPost` flow.

### Better Auth response mapping

`/login` POST maps Better Auth's HTTP status to user-facing copy via
`betterAuthErrorCopy(status)`:

| Better Auth status | Rendered status | Copy |
| ------------------ | --------------- | ---- |
| 429 | 429 | "Too many sign-in attempts. Please wait a minute and try again." |
| 423 | 423 | "This account is locked. Check your email for a reset link or contact support." |
| 401 / other 4xx | 401 | "Invalid email or password." |
| 5xx | 502 | "PackRat sign-in is temporarily unavailable. Try again shortly." |

The non-401 4xx collapse is deliberate: don't leak "user exists but
wrong password" vs. "no such user".

## CORS allowlist on /.well-known/* (U6)

The two well-known endpoints (`/.well-known/oauth-protected-resource`
and `/.well-known/oauth-authorization-server`) accept cross-origin GET
and OPTIONS requests **only** from:

- `https://claude.ai`
- `https://claude.com`

Everything else gets the upstream OAuthProvider response unmodified
(default-deny). The allowlist + GET annotation + OPTIONS short-circuit
all live in `packages/mcp/src/cors.ts` (`applyCorsHeaders`), invoked by
the outer fetch wrapper in `index.ts` — we can't add CORS inside
`PackRatAuthHandler` because the OAuthProvider library routes the
well-known paths before the defaultHandler dispatch (same constraint
U4's `/register` gate hit).

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

## U11 login UX

The login page renderer is extracted to `packages/mcp/src/login-page.ts`
(263 lines). `renderLoginPage({ state, csrf, error?, clientName?, ssoEnabled? })`
returns a complete HTML document. The presentation has room to breathe
without dragging the OAuth handler internals along for the ride.

### What shipped

- **Brand mark + name** (inline SVG, no extra HTTP round-trip; replaceable
  with the U13 public asset via a one-line change in `login-page.ts`).
- **OAuth client-name disclosure** when `renderLoginPage({ ..., clientName: 'Claude' })`
  is invoked — falls back to a generic "An MCP client is requesting access…"
  line when omitted. `clientName` is HTML-escaped because it originates in
  DCR metadata for non-pre-registered clients.
- **Password-reset link** to `mailto:hello@packratai.com?subject=PackRat%20password%20reset`.
  Better Auth's reset endpoint is POST-only with no public web page; mailto
  is the most honest path until a web reset surface ships.
- **Legal footer** links to Terms (U12), Privacy (U12), and Support
  (`hello@packratai.com`). All three targets are on `packratai.com`.
- **Accessibility**: `<main>` landmark, skip link, labelled inputs with
  `autocomplete` hints, `role="alert"` on the error banner only when present,
  `autofocus` on the email field, `prefers-color-scheme: dark` palette,
  `noindex,nofollow` meta.

### Stable signature for the SSO follow-up

`renderLoginPage` accepts `ssoEnabled?: boolean` today; the field is
parsed-and-ignored so the follow-up SSO PR can flip it without touching
the handler call sites. The test suite asserts SSO buttons are NOT rendered
in v1 (locks in the deferral).

### What was NOT wired and why

- **`clientName` is not threaded through at call sites yet.** The
  `OAuthStateSchema` captures `clientId` but not the client name; to surface
  the name in the disclosure copy, `handleAuthorize` would need to call
  `env.OAUTH_PROVIDER.lookupClient(clientId)` and persist the name in KV
  alongside the OAuth state. That's a one-screen change but it's not
  required for the connector listing — Claude's name appears in the
  consent screen Anthropic renders, not on our login form. Follow-up:
  thread it through if a user reports the missing disclosure copy.
- **Google + Apple SSO buttons.** Deferred per the U11 conditional
  decision. Cookie-domain blocker: Better Auth's session cookie is
  host-locked to `api.packrat.world`; the MCP worker at `mcp.packratai.com`
  can't read it, and `packratai.com` and `packrat.world` share no parent
  domain so `crossSubDomainCookies` doesn't bridge them. Realistic
  follow-up options:
  1. Move the API to a subdomain of `packratai.com` (e.g.
     `api.packratai.com`) so cookies can be set on `.packratai.com`.
  2. Extend Better Auth to encode the session token in the `callbackURL`
     query string for the social flow (workaround for the cookie limit).
  3. Introduce a one-time auth-code exchange endpoint between MCP and
     the API: MCP redirects through API → API mints a short-lived code
     bound to the Better Auth session → MCP exchanges the code for the
     bearer server-to-server.
  All three are non-trivial; (1) is the cleanest long-term but has
  blast radius beyond the MCP. Worth a follow-up planning conversation.

### Tests

`packages/mcp/src/__tests__/login-page.test.ts` covers: document shape,
branding, client-name disclosure (including the XSS escape), hidden-field
escaping, helper + legal links, accessibility, and the SSO deferral
contract. 20 tests total.

## Common operations

### Deploy

```bash
# Dev (manual)
bun run deploy:dev

# Prod (CI on tag in U17; manual fallback below)
wrangler deploy --env prod
```

### Tail logs

```bash
wrangler tail --env prod --format pretty
```

### Rotate `MCP_INITIAL_ACCESS_TOKEN`

```bash
wrangler secret put MCP_INITIAL_ACCESS_TOKEN --env prod
# Re-run the register-claude-clients.ts script if any pre-registered
# clients need to be rotated alongside the token (rare — the token
# only governs /register, not active OAuth grants).
```

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
