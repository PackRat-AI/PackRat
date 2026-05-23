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
