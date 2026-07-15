# Portless Local Dev Workflow

[portless](https://github.com/vercel-labs/portless) gives every local dev server a
stable, per-worktree `.localhost` URL instead of a hardcoded port — so 50+ parallel
agents (and humans) stop colliding on `:3001`/`:8787`/`:8081`.

## One-time host setup

```bash
bun run portless:setup     # trusts the local CA (one sudo for the trust store)
```

Then start the proxy **as your user** (see the port note below). The host setup is
once per machine; re-run `portless:setup` after a node version bump (mise moves the
node binary).

> **Never run the proxy under sudo.** A root-owned proxy uses root's `~/.portless`
> state, which is disjoint from your user's — it answers requests but **404s every
> backend** your dev servers register. If a root proxy is squatting `:443`:
> `sudo portless proxy stop` once, then start it as your user.

### Clean `:443` URLs vs no-sudo `:1355`

portless 0.13.1 hardcodes a sudo elevation for `:443` (it ignores the
`cap_net_bind_service` capability). Pick one:

- **No-sudo (default):** let portless fall back to a user-owned proxy on `:1355`.
  Fully solves port collisions; URLs carry `:1355`. Just run `portless`.
- **Clean `:443`:** needs sudo at proxy start, kept user-context via one of:
  `sudo -E portless proxy start` (preserves `HOME` so it shares your `~/.portless`),
  a passwordless-sudo rule scoped to `portless proxy start`, or `portless service
  install` (verify it runs as your user).

## Normal multi-agent workflow

```bash
portless                   # from repo root: starts all workspace apps via turbo,
                           # each at https://[<worktree>.]<app>.localhost[:port]
bun run portless:urls      # print this worktree's service URLs
```

- **Naming:** apps resolve as `web`, `admin`, `guides`, `landing`, `trails`, `api`,
  `mcp` (see `portless.json`). In a linked worktree the branch is prepended:
  `feat-x.web.localhost`.
- **Discovery:** each dev process is handed its own `PORTLESS_URL`. Use
  `bun run portless:urls` or `portless get <name>` to look up a sibling service.
- **Always use the worktree-aware form** (`portless` / `portless run`), never the
  explicit `portless <name> <cmd>` form — the latter skips worktree prefixing and
  the proxy 404s it.

### How services find each other

- **Web → API:** `apps/web` derives the API origin from its own page origin
  (`web.localhost` → `api.localhost`), carrying the worktree prefix and port
  automatically. No per-worktree env wiring. An explicit `NEXT_PUBLIC_API_URL` still
  wins. See `apps/web/lib/getApiBaseUrl.ts`.
- **Auth/CORS:** the API trusts `https://*.localhost[:*]` origins in development
  (`packages/api/src/utils/cors-origins.ts` and better-auth `trustedOrigins`), so
  login works through the proxy. These relaxations are dev-gated — never production.
- **`$PORT`:** dev scripts honor portless's injected `PORT`
  (`next dev --port ${PORT:-…}`, `wrangler dev --port ${PORT:-8787}`); running a
  script directly (no portless) falls back to its conventional port.

## Expo (simulator + physical device)

> Status: planned (U7–U9). Requires a real simulator/emulator/device to validate.

- **Simulator/emulator:** point `EXPO_PUBLIC_API_URL` at the named local API; Android
  emulator keeps the `10.0.2.2` mapping (`apps/expo/lib/api/getBaseUrl.ts`).
- **Physical device (LAN):** enable portless LAN mode (`PORTLESS_LAN=1`) so services
  bind LAN-reachably; the device must trust the portless CA and be on the same subnet.
  `.localhost` is loopback-only and is **not** used by devices — they reach the API by
  its LAN-reachable name/IP.

## Recovery (stale processes / wedged proxy)

```bash
bun run portless:clean     # portless prune — kill orphaned dev servers from crashes
portless list              # show active routes
portless clean             # full reset: remove portless state, CA trust, hosts entries
```

If a dev server is wedged on a port but `portless prune` reports 0 killed (a
reparented worker the proxy no longer tracks), kill it directly:

```bash
fuser -k 4567/tcp          # or: lsof -ti:4567 | xargs kill -9
```

## Out of scope / leave alone

- The Neon HTTP proxy (`db.localtest.me`, `packages/api/src/index.ts`) is a separate,
  already-working concern — portless does not touch it.
- Don't dockerize the web/Worker dev servers: containers can't resolve the host's
  `.localhost` names.
