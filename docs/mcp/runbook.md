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

### Rate-limit hook (U14)

`checkLoginRateLimit(env, ip)` in `packages/mcp/src/auth.ts` now calls
`env.MCP_TOOLS_RL.limit({ key: \`login:${ip || cfRay}\` })` via the
shared `checkRateLimit` helper in `packages/mcp/src/rate-limit.ts`. See
the "U14 rate limiting + KV purge" section below for the full
enforcement-surfaces table, the dev-fallback contract, and the
fail-open trade-off. The handler call site at `handleLoginPost`
prefers `cf-connecting-ip`, falling back to `x-forwarded-for` then
`cf-ray` so missing-IP requests don't all collapse to one global
counter.

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
| MCP connector mark (SVG, 256×256 viewBox) | [`apps/landing/public/mcp-logo.svg`](../../apps/landing/public/mcp-logo.svg) | Vector copy of the inline backpack mark in `packages/mcp/src/login-page.ts`. If the brand mark changes, update **all three** (`login-page.ts`, this SVG, and the favicon) in the same commit so the surfaces don't drift. |
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

## U14 rate limiting + KV purge

PackRat's MCP Worker has **two distinct rate-limit enforcement surfaces**,
deliberately split per the connector-store plan's K.T.D. "Rate-limit split":

| Surface | Backed by | Keyed by | Default budget |
| ------- | --------- | -------- | -------------- |
| Authenticated tool calls | Workers Rate Limiting binding `MCP_TOOLS_RL` | `${props.userId}:${toolName}` | 60 calls / 60s |
| `/login` POST            | Same binding `MCP_TOOLS_RL`                  | `login:${ip \|\| cfRay}`      | 60 attempts / 60s |
| Anonymous discovery endpoints (`/register`, `/authorize`, `/token`) | **Zone-level WAF Rate Limiting Rules** (operator-applied; see TODO below) | client IP | 100 r/s/IP (target) |

The binding configuration lives in
[`packages/mcp/wrangler.jsonc`](../../packages/mcp/wrangler.jsonc) under the
`rate_limiting` block — present in both the top-level/dev base and the
`env.prod` block. Block-key conventions follow
`packages/api/wrangler.jsonc:44`: the block is `rate_limiting` (not
`ratelimits`) and the per-binding field is `binding` (not `name`).

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
configurations), both call sites return "allowed" without consulting the
binding. Production deploys always bind it via `wrangler.jsonc`; the
fallback exists so onboarding engineers don't need a bound rate-limit
namespace to run the unit suite.

### Fail-open on binding error

`checkRateLimit` in `packages/mcp/src/rate-limit.ts` swallows binding-side
exceptions and returns `true`. The trade-off is documented at the call
site: a brief over-allow window during a Cloudflare-side rate-limit-API
hiccup is preferable to a hard outage of the MCP surface. U15 will add
structured observability so we can alert on the error volume.

### KV purge cron — 04:00 UTC daily

`packages/mcp/wrangler.jsonc` declares `triggers.crons: ["0 4 * * *"]`
in the top-level/dev base AND in `env.prod`. The `scheduled()` arm of the
Worker default export (in `packages/mcp/src/index.ts`) delegates to
`runScheduledPurge` (in `packages/mcp/src/scheduled.ts`), which loops:

```ts
while (!done && iterations < CRON_PURGE_MAX_ITERATIONS /* = 50 */) {
  const result = await oauthProvider.purgeExpiredData(env, { batchSize: 100 });
  done = result.done;
  iterations += 1;
}
```

The purge sweeps **orphaned grants** (grants whose client was deleted)
and **expired grants** + tokens as defense-in-depth for KV TTLs. KV TTLs
alone handle most expiry; the cron is the operator-visible cleanup
surface and the safety net against orphaned records that survived a
client deletion.

#### 30s CPU budget caveat

Scheduled handlers have ~30s of worker CPU time. Each `purgeExpiredData`
call does up to ~200 KV subrequests (100 keys × ~2 reads). The
50-iteration cap is the load-bearing safety: if a pathological state
keeps returning `done: false`, the cron exits cleanly and the next
day's tick picks up where this one stopped. `purgeExpiredData` is safe
to call repeatedly per its library docstring: "deleted records
disappear from KV, so subsequent invocations naturally process fresh
records without needing a persisted cursor."

#### Why `batchSize: 100` (vs. library default of 50)

We have headroom in a daily cron and want to drain backlog quickly.
Cloudflare's 1000-subrequest-per-invocation soft limit is the real
ceiling; 100 keys × ~2 reads = ~200 subrequests/pass, comfortably under.

#### Why call the provider instance, not `env.OAUTH_PROVIDER`

`env.OAUTH_PROVIDER` is the *helpers* object — injected by the library
per-request and not available in a scheduled handler. The provider
instance itself exposes a `purgeExpiredData(env, options)` overload for
exactly this case (see
`@cloudflare/workers-oauth-provider/dist/oauth-provider.d.ts:1191`).

### Verifying the cron ran

After a deploy, after the next 04:00 UTC tick:

```bash
wrangler tail --env prod --format pretty | grep mcp.cron.purge
# The U15 logging emits a `mcp.cron.purge.start`, one
# `mcp.cron.purge.batch` per iteration with `grantsPurged`/`tokensPurged`,
# and a `mcp.cron.purge.complete` line. A `mcp.cron.purge.cap_reached`
# WARN means the 50-iteration safety cap fired without `done: true` —
# investigate the KV scan volume.
```

If the purge ever throws, the `scheduled` arm propagates the error and
Cloudflare records the failed cron invocation in the dashboard
(Workers & Pages → packrat-mcp → Triggers → Cron). A repeated failure
there is a real incident — check the `OAUTH_KV` namespace bindings
first.

### TODO (operator): zone-level WAF Rate Limiting Rules

Workers Rate Limiting only protects **authenticated** tool calls and the
login form. The anonymous OAuth endpoints (`/register`, `/authorize`,
`/token`) are unauthenticated — they're the DoS surface. Apply
WAF Rate Limiting Rules on the `packratai.com` zone (or via Terraform):

| Path expression            | Rule | Action |
| -------------------------- | ---- | ------ |
| `http.request.uri.path eq "/register"`    | > 100 r/s per IP | Block 1m |
| `http.request.uri.path eq "/authorize"`   | > 100 r/s per IP | Block 1m |
| `http.request.uri.path eq "/token"`       | > 100 r/s per IP | Block 1m |

100 r/s is generous for legitimate use: a Claude.ai user starting a fresh
connection issues at most 3-4 requests across these endpoints. Tune
downward after observing real traffic for a week. Add an explicit
*allow* rule above the limits for Anthropic's IP ranges if reviewer
probes get blocked during intake — Anthropic publishes the ranges in
the connector-store docs.

### Refreshing the binding budget

The 60/60s default is configured in `wrangler.jsonc` under the
`rate_limiting` block. To change it:

1. Edit `simple.limit` and `simple.period` in both the top-level and
   `env.prod` blocks.
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
6. **Sampling**: 100% on `WARN`/`ERROR`; 5% on `INFO` (cost guardrail —
   per-batch cron INFO is high-volume but low-value individually).
7. Save. The pipeline activates within ~1 minute. Verify by triggering a
   known WARN (e.g. `curl -X POST https://mcp.packratai.com/register`
   with no Authorization header — this emits `mcp.auth.dcr_register.denied
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
  (`dcrRegisterGate`, `handleLoginPost`, `handleCallback`) can read it
  via `getCorrelationId(request)` without plumbing the id through every
  function signature. **Not AsyncLocalStorage** — Workers ALS support is
  still gated behind a compatibility flag we don't set.
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

Every rejection path on the unauthenticated auth surface emits a
WARN-level structured log (helpful for spotting brute-force probes):

| Surface              | `msg`                              | `reason` values                                                                           |
| -------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `POST /register`     | `mcp.auth.dcr_register.denied`     | `disabled`, `missing_bearer`, `token_mismatch`                                            |
| `POST /login`        | `mcp.auth.login.denied`            | `bad_origin`, `csrf_missing`, `csrf_kv_missing`, `csrf_mismatch`, `missing_state`, `rate_limited`, `better_auth_failed` |
| `/callback` Better Auth lookup | `mcp.auth.role_lookup.{denied,failed}` | `timeout`, `transport_error`, `non_ok_response`, `malformed_body`                |
| OAuthProvider errors | `mcp.oauth.error`                  | Library-defined `oauthCode` (e.g. `invalid_grant`, `invalid_client`)                      |

The OAuthProvider hook is wired via the `onError` callback in
`packages/mcp/src/index.ts`. The v0.7.0 signature is
`({ code, description, status, headers, internal? }) => Response | void`;
we log `oauthCode`, `oauthStatus`, `description` (and the `internal`
`{ category, reason }` when present) and return `void` so the library's
default RFC 6749 error envelope reaches the client unchanged.

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

1. `curl -i https://mcp.packratai.com/register` (no Authorization).
2. The response includes `X-Correlation-Id: <ray-id>` and 401 +
   `WWW-Authenticate: Bearer resource_metadata=...`.
3. `wrangler tail --env prod --format pretty | grep dcr_register`
   shows `{"ts":...,"level":"warn","msg":"mcp.auth.dcr_register.denied",
   "correlationId":"<ray-id>","reason":"missing_bearer",...}`.
4. Sentry Issues view receives a matching event tagged
   `service.name=mcp`, `correlationId=<ray-id>`, with the message
   `mcp.auth.dcr_register.denied`.

If steps 3 and 4 don't align within ~30 seconds, the OTel pipeline is
mis-configured (most often: missing `x-sentry-auth` header or a typo
in the OTLP endpoint).

---

## U16 /health + /status

Two unauthenticated read-only endpoints reviewers (and uptime probes)
hit to verify the Worker is healthy and to read its public metadata.

### `/health` — real dependency probe

`GET /health` (and `GET /`, which dispatches to the same handler) runs
two probes in parallel and returns 200 only when both succeed:

| Probe | Mechanism                                                  | Pass = `'ok'`, fail = `'down'`  |
| ----- | ---------------------------------------------------------- | ------------------------------- |
| KV    | `env.OAUTH_KV.list({ limit: 1 })` — cheap binding ping     | Call resolved (any keys is OK)  |
| API   | `fetch(env.PACKRAT_API_URL + '/health')` with 3s timeout   | `res.ok` (HTTP 2xx)             |

The API probe hits the PackRat API's root `/health` endpoint
(`packages/api/src/index.ts:86`), **not** `/api/health` — Elysia mounts
the meta route at the worker root, so the canonical URL is
`${PACKRAT_API_URL}/health`. If we ever move the API to a versioned
path prefix, this URL needs to update in lockstep.

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
  "probes":  { "kv": "ok" | "down", "api": "ok" | "down" }
}
```

HTTP status: 200 when both probes are `'ok'`, 503 otherwise. The
legal/support URLs (U12) are surfaced on **both** the healthy and
degraded responses so a reviewer curling `/health` during an incident
still finds the contact surface.

### Cache strategy — 10s isolate-local

The probe result is cached in an isolate-local module slot
(`packages/mcp/src/auth.ts → healthCache`) for 10 seconds. Trade-offs:

- **Why cache at all?** Without it, an external uptime monitor polling
  every 5s would synthesize 12 KV.list + 12 API fetch calls/minute per
  isolate — easy to miss as a load source. 10s keeps the steady-state
  probe rate ≤6/min/isolate.
- **Why 10 seconds?** Short enough that a real outage surfaces within
  one cache-window of when it began (no reviewer waits 30s for /health
  to flip red). Long enough that consecutive uptime probes hit the
  cache.
- **Why per-isolate (not Worker-wide)?** A shared cache would mean an
  extra KV read on every probe call — defeating the point of caching
  to avoid load. Per-isolate scales with the isolate pool (single
  digits for our traffic shape) so worst-case the dependency surface
  sees ≤N probes/10s where N is the pool size.
- **Module-level `let healthCache`** (not WeakMap / LRU) is deliberate:
  the cache holds exactly one entry, and the simplest possible
  eviction story keeps future refactors honest. The
  `__resetHealthCacheForTests` helper is exported for vitest only —
  production code never calls it.

### Incident response

The `probes` field tells you which dependency tripped:

```bash
curl -s https://mcp.packratai.com/health | jq
# {"status":"degraded", ..., "probes":{"kv":"ok","api":"down"}}
#                                                    ^^^^^^^ → PackRat API outage
```

The degraded path also emits a WARN-level structured log:

```bash
wrangler tail --env prod --format pretty | grep mcp.health.degraded
# {"ts":"...","level":"warn","msg":"mcp.health.degraded","reason":"api_down","statusCode":503,...}
```

`reason` is one of `kv_down`, `api_down`, `kv_and_api_down`. The healthy
path is silent so external uptime probes don't fill Workers Logs with
noise. If both probes fail, check the Cloudflare status page first
(KV outages are usually region-level and self-resolve in minutes); if
only `api` is down, escalate to the API on-call.

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
  "commitSha": "a06b296" | "unknown"
}
```

**No secrets ever**: the response only contains version + scopes +
public URLs + the build SHA. Adding a new field requires a code review
that explicitly notes the field is non-sensitive — the auth.test.ts
suite asserts a denylist of secret-looking keys is absent so a
careless refactor that surfaces `env` more broadly regresses visibly.

### `MCP_COMMIT_SHA` — operator TODO at deploy time

`/status` surfaces `commitSha` from `env.MCP_COMMIT_SHA`, a `var` (not a
secret) injected at deploy time. Two paths:

**Manual deploy:**

```bash
wrangler deploy --env prod --var MCP_COMMIT_SHA:$(git rev-parse --short HEAD)
```

**CI (U17, `.github/workflows/mcp-deploy.yml`):** the workflow passes
the same flag automatically using the tagged commit's short SHA.

When the var is unset (`wrangler dev`, vitest, manual deploy without
the flag) `/status` returns `commitSha: "unknown"` — acceptable for
dev, never for prod. If `/status` returns `unknown` on a prod
hostname, the last deploy bypassed the convention; re-run with the
flag.

### CORS + DCR gate interaction

Neither `/health` nor `/status` is annotated by the U6 CORS handler
(`applyCorsHeaders` short-circuits on a `/.well-known/` prefix check —
see `packages/mcp/src/cors.ts:48`). Reviewers curl them directly so no
CORS dance is needed; if Claude.ai ever needed to fetch them
cross-origin, the allowlist would have to extend.

Neither endpoint is gated by `dcrRegisterGate` either — the gate
short-circuits on a `/register` pathname check
(`packages/mcp/src/auth.ts:dcrRegisterGate`) and falls through cleanly
for every other path.

---

## U17 CI + integration tests

### `.github/workflows/mcp-test.yml` — PR gate

Triggers on `pull_request` (and `push` to `main` / `development`) when
any of these paths change:

- `packages/mcp/**` — the Worker source
- `packages/api-client/**` — every tool wraps the Eden Treaty client
- `packages/api/src/auth/**` — the OAuth-token-to-Better-Auth bridge
- `packages/api/src/routes/admin/**` — the U5 scope-based admin gate
  calls into these
- `.github/workflows/mcp-test.yml` — self-trigger so workflow edits
  are validated against the suite they gate

Steps:

1. Biome (`bun biome check packages/mcp`) — lint + format on the
   MCP package only. Cheap, runs in <5s.
2. Type-check (`bun run --cwd packages/mcp check-types`) with
   `NODE_OPTIONS=--max-old-space-size=14336`. The MCP SDK + zod + the
   api-client type surface together need >8 GB of v8 heap to fit. The
   GitHub Actions `ubuntu-latest` runner has 16 GB; we use 14 GB and
   leave headroom for tsc's other allocations. **This is the official
   type-validation surface** — `bun run check-types` OOMs on most
   developer workstations and the CI run is the canonical pass/fail.
3. MCP test suite (`bun run --cwd packages/mcp test`) — runs both the
   `mcp-unit` project (1,134 tests) and the `mcp-integration` project
   (currently 21 deferred `it.todo` placeholders; see below).
4. API unit suite (`bun run --cwd packages/api test:unit`) — re-runs
   the auth + admin guard tests so a MCP-side scope-model change
   can't silently break the API-side enforcement contract.

### `.github/workflows/mcp-deploy.yml` — tag-triggered prod deploy

Triggers on `push` of any tag matching `mcp-v*` (e.g. `mcp-v2.1.0`).
The intentional friction of a separate tag keeps prod deploys
explicit; main-branch merges only redeploy the dev env (manual
`bun run deploy:dev` for now).

Steps:

1. Re-run the MCP test suite (gates the deploy on tests passing — in
   case a tag was pushed without a PR).
2. Resolve the short SHA of the tagged commit so the worker bundle is
   stamped with it.
3. `wrangler deploy --env prod --var MCP_COMMIT_SHA:<short>` via the
   `cloudflare/wrangler-action@v3` action. The MCP_COMMIT_SHA `var`
   shows up on `/status` (see § "U16 /health + /status" above).

### One-time operator setup — repo secrets

The deploy workflow needs two repo secrets:

| Secret | What it is | Where to get it |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Scoped API token with `Workers Scripts: Edit` + `Account Settings: Read` on the PackRat account | https://dash.cloudflare.com/profile/api-tokens → "Create Custom Token" → use the "Edit Cloudflare Workers" template. **TODO (operator):** issue once, store at https://github.com/andrewbierman/PackRat/settings/secrets/actions, rotate annually. |
| `CLOUDFLARE_ACCOUNT_ID` | The PackRat Cloudflare account ID | Visible on every page of the Cloudflare dashboard's right sidebar. Or via `wrangler whoami` if logged in locally. **TODO (operator):** copy once, store as above. |

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

- `bun run --cwd packages/mcp test` — 1,134 tests must pass.
- Verify `version` in `packages/mcp/package.json` matches
  `ServiceMeta.Version` in `packages/mcp/src/constants.ts`.

### vitest-pool-workers integration suite — current state

`packages/mcp/vitest.workspace.ts` declares two projects:

- `mcp-unit` — Node-environment tests for pure modules (the existing
  1,134-test surface). Fast; no workerd.
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
`metadata.test.ts`, DCR gate + health/status → `auth.test.ts`).

**First-invocation note (for when the integration tests light up):**
`@cloudflare/vitest-pool-workers` downloads `workerd` on first run
(~30s, one-time per machine + version). Subsequent runs are warm.

### `OAUTH_KV` placeholder + miniflare synthesis

The integration config (when switched back to
`defineWorkersProject`) sets `miniflare.kvNamespaces: ['OAUTH_KV']`,
which gives the Worker an in-memory KV binding bypassing the
`__TODO_OAUTH_KV_DEV_ID__` placeholder in `wrangler.jsonc`. **No
real KV namespace ID is needed for the test run** — the placeholder
stays harmless and the live-deploy operator-setup remains the only
place a real ID is required.

---

## U18 submission packet + readiness script

The last unit of the connector-store readiness plan ships two operator
surfaces: a programmatic pre-submission probe and a fully-resolved
submission packet document. Together they replace the "operator reads
13 different runbook sections and ad-hoc curls each one" pattern with a
single command + a single doc.

### `bun packages/mcp/scripts/submission-readiness.ts` — 13-check probe

Default target is production; pass `--url` to probe a dev or staging
URL. The script is **a deployed-server probe** — it cannot run before
the Worker is actually deployed, and it never mutates KV (`/register`
is probed for rejection only).

```bash
# Default: probes https://mcp.packratai.com and packratai.com/mcp
bun packages/mcp/scripts/submission-readiness.ts

# Against a staging worker
bun packages/mcp/scripts/submission-readiness.ts --url https://packrat-mcp-dev.<acct>.workers.dev

# CI / machine-readable
bun packages/mcp/scripts/submission-readiness.ts --json

# With a pre-registered Claude client_id (lights up check 5)
bun packages/mcp/scripts/submission-readiness.ts --claude-client-id <id>
```

Exit codes: `0` = every check passed; `1` = at least one check failed;
`2` = bad CLI args. Default output is colour-coded one-line-per-check
plus a `N/13 passed` summary; `--json` emits a structured report
suitable for piping into a CI job.

#### The 13 checks at a glance

| # | What it asserts | Failure recovery |
| - | --- | --- |
| 1 | TLS + custom domain reachability — `GET /` returns 200 over HTTPS on the right host | DNS not propagated; cert not provisioned; worker not deployed |
| 2 | `/mcp` returns 401 with `WWW-Authenticate: Bearer resource_metadata=..., scope=...` (RFC 9728 §5.1) | OAuthProvider misconfigured; metadata wiring drifted |
| 3 | `/.well-known/oauth-protected-resource` has `resource`, `authorization_servers`, all 4 scopes, `bearer_methods_supported: ['header']` | `packages/mcp/src/metadata.ts` drifted from the plan |
| 4 | `/.well-known/oauth-authorization-server` advertises `S256`, `authorization_code`, `refresh_token`, `code` | OAuthProvider version mismatch; `allowPlainPKCE` flipped on |
| 5 | Pre-registered Claude client_id resolves at `/authorize` (WARN without `--claude-client-id` — no public list endpoint exists) | Re-run `scripts/register-claude-clients.ts` |
| 6 | `/register` DCR gate returns 401 to no-auth AND fake-bearer probes | `dcrRegisterGate` short-circuit broken; `MCP_INITIAL_ACCESS_TOKEN` exposed |
| 7 | `/favicon.ico` returns 200 image/x-icon with the .ico magic bytes (Anthropic's domain-ownership probe) | `packages/mcp/src/favicon.ts` corrupted; re-embed per the U13 contract |
| 8 | `packratai.com/mcp` renders with `PackRat`, `Claude.ai`, `scope` text present | Landing site deploy failed; route 404'd |
| 9 | `/privacy-policy` and `/terms-of-service` return 200 AND contain `mcp` or `connector` | Legal pages missing the MCP addendum — Anthropic immediate-reject cause |
| 10 | `/health` JSON includes `support: mailto:hello@packratai.com` | U12 mapping drifted |
| 11 | `/health` returns `status: 'ok'` with `kv: ok` + `api: ok` | One dependency is degraded; check `wrangler tail` |
| 11b | `/status` advertises `scopes_supported` with all 4 PackRat scopes | U16 metadata drifted |
| 12 | Every tool in the catalog has `title` + `readOnlyHint` + `destructiveHint` (when not read-only) | Re-run `bun packages/mcp/scripts/dump-catalog.ts`; the U7 annotations test should have caught this |
| 13 | Tool descriptions contain no forbidden marketing words (`revolutionary`, `AI-powered` as a value claim, etc.) | Edit the offending description in `packages/mcp/src/tools/*.ts`; re-dump catalog |

#### Honest gaps in automation

- **Check 5** (pre-registered Claude client) cannot be fully automated:
  `@cloudflare/workers-oauth-provider` does not expose a public
  client-list endpoint, so the script probes `/authorize` instead. When
  `--claude-client-id` is omitted, the check WARNs with a gap-note
  directing the operator to verify manually via
  `wrangler kv key list ... | grep client`. This is the only check that
  does not assert by default.
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
The PR-gate `mcp-test.yml` runs them alongside the existing 1,134-test
surface. If a check's output shape ever drifts (new severity level,
renamed status string), this suite fails loudly so the formatter, the
CI workflow, and this runbook stay in lockstep.

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
  target_url: https://mcp.packratai.com  (default; override for staging)
  claude_client_id: <optional — lights up check 5>
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
