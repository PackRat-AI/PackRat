# Local Maestro E2E — API Setup

Run the full Maestro e2e suite against a local Postgres database and a local
`wrangler dev` API — no Neon cloud, no shared dev DB.

## Prerequisites

| Tool | Notes |
|------|-------|
| Docker Desktop | Must be running |
| Bun | Already required by the monorepo |
| Maestro CLI | `curl -Ls https://get.maestro.mobile.dev \| bash` |
| iOS Simulator | Xcode installed + at least one simulator booted |

## Quick start

```bash
# 1. One-time setup: generate .dev.vars.e2e from your existing .dev.vars
cd packages/api
bun run dev:e2e:init

# 2. Start Postgres + run migrations + seed e2e user + launch wrangler dev
bun run dev:e2e
```

The API is now live at **http://localhost:8787**.

## How the stack connects

```
iOS Simulator ──────► localhost:8787 (wrangler dev)
                                │
                                ▼
                     localhost:5435 (Docker Postgres — packrat_e2e)
```

The iOS Simulator on macOS shares the Mac's loopback, so `localhost` works
without any special network config. For a real device on the same Wi-Fi, use
your Mac's LAN IP and rebuild the app with:

```
EXPO_PUBLIC_API_URL=http://<mac-lan-ip>:8787
```

## Running Maestro flows

```bash
# In another terminal — wrangler dev must be running first
maestro test .maestro/master-flow.yaml \
  --env TEST_EMAIL=e2e@packrattest.local \
  --env TEST_PASSWORD=E2eTestPass123!
```

Or with the full suite runner:

```bash
bash .maestro/run-suite.sh
```

## Stopping

```bash
bun run --filter @packrat/api dev:e2e:stop           # keep Postgres data
bun run --filter @packrat/api dev:e2e:stop -- --volumes  # wipe DB too
```

## Full reset (wipe DB + restart)

```bash
bun run --filter @packrat/api dev:e2e:reset
```

## How vars are layered

`e2e-local-start.sh` passes `--env-file .dev.vars.e2e` to `wrangler dev`.
Wrangler merges the env file on top of any `.dev.vars` present, so e2e
overrides win. The key overrides are:

| Var | Local value |
|-----|-------------|
| `NEON_DATABASE_URL` | `postgres://e2e_user:e2e_pass@localhost:5435/packrat_e2e` |
| `NEON_DATABASE_URL_READONLY` | same as above |
| `EXPO_PUBLIC_API_URL` | `http://localhost:8787` |
| `BETTER_AUTH_URL` | `http://localhost:8787` |

All other vars (AI keys, R2, email) come from your base `.dev.vars`.

## DB connection — why no wsproxy?

The `db/index.ts` `createConnection` helper detects a standard `postgres://`
URL (not on `neon.tech`/`neon.com`) and automatically switches to `pg.Pool`
(node-postgres) instead of the Neon serverless WebSocket driver. No wsproxy
needed locally.
