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

## Better Auth trustedOrigins (U6)

The MCP Worker calls Better Auth (in `packages/api`) for password sign-in
during the OAuth flow. Better Auth rejects calls whose `Origin` is not on
its `trustedOrigins` list — so `https://mcp.packratai.com` must appear in
that list, or every MCP-driven sign-in will fail with an untrusted-origin
error.

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
