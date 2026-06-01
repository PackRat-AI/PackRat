---
date: 2026-06-01
type: feat
status: active
title: "feat: Portless Turborepo dev workflow (named local URLs for 50+ parallel agents)"
origin: docs/brainstorms/2026-05-22-portless-turborepo-dev-workflow-requirements.md
plan_depth: deep
base_branch: feat/turbo-l4
worktree: .worktrees/explore/portless-packrat
---

# feat: Portless Turborepo Dev Workflow

Adopt [portless](https://github.com/vercel-labs/portless) as PackRat's local-dev front door so services get stable, per-worktree named URLs instead of fixed colliding ports — fixing the port-collision storm from 50+ parallel host-side agents, and extending named-URL targeting to Expo (simulator first, physical-device LAN before "complete").

Origin requirements: `docs/brainstorms/2026-05-22-portless-turborepo-dev-workflow-requirements.md` (full canonical scope, R1–R15).

---

## Problem Frame

PackRat is routinely developed by 50+ AI coding agents (plus their subagents) running concurrently in sibling host worktrees, with Docker used for specific services but no agent sandboxing. Every agent that boots a dev server reaches for the same hardcoded default ports — `apps/web` (`next dev --port 3001`), `apps/admin` (`next dev --port 3002`), `packages/api` and `packages/mcp` (`wrangler dev` → `:8787`), Expo Metro (`:8081`). The second agent to start any server collides with the first, or worse, silently shares a port. The blast radius scales with agent count — the opposite of what PackRat wants as it leans into parallel-agent development.

The Turborepo migration (this `feat/turbo-l4` base) is the natural integration point: portless delegates to `turbo run` when `turbo.json` is present and injects per-process `PORT`/`HOST`/`PORTLESS_URL`. Expo raises the bar beyond browser-only dev — the mobile app consumes a configured API URL, and local readiness is incomplete if web/API have named URLs but Expo still depends on manual API-URL juggling (`getApiBaseUrl()`'s `10.0.2.2` swap, physical-device LAN IPs).

A second pain rides along: bare `localhost` gives no real HTTPS, so secure-context behavior (cookies, service workers, webauthn) is fudged in dev. Portless serves HTTPS via a local CA by default.

---

## Actors

- A1. **Human developer** (origin A1): starts local workflows, may run Expo on simulator or physical devices.
- A2. **Coding agent / subagent** (origin A2): starts and tests services in a worktree without manual port coordination.
- A3. **PackRat local services** (origin A3): web apps, Cloudflare Worker services (API, MCP), Expo Metro.
- A4. **Mobile device or simulator** (origin A4): runs the Expo app, connects to the local API during development.

---

## Key Flows (carried from origin)

- **F1. Multi-agent web/API development** (origin F1; covered by U2, U3, U4, U6auth) — services start through the Turbo dev workflow, each gets a stable named URL, agents use names not ports; multiple worktrees run simultaneously without collisions.
- **F2. Expo simulator local API development** (origin F2; covered by U7, U8) — local API starts with a named portless URL, Expo receives a matching local API URL, simulator/emulator makes authenticated calls.
- **F3. Expo physical-device local API development** (origin F3; covered by U9) — portless LAN mode exposes the local API through a device-reachable name, Expo uses it, iOS/Android networking requirements satisfied.

---

## Key Technical Decisions

- **Integrate with Turbo, not before it.** Portless's Turbo delegation (`turbo run` + `PORT`/`HOST`/`PORTLESS_URL` injection) is the cleanest seam, and this base already has `turbo.json`. (origin Key Decisions; advances R2)
- **`$PORT` adoption is the load-bearing change, not the install.** Port collisions only disappear once dev scripts stop hardcoding ports. Tool behavior differs:
  - **Next.js reads `$PORT` natively** → drop the `--port 3001/3002` flags from `apps/web` and `apps/admin`; `guides`/`landing`/`trails` are already bare `next dev`.
  - **Wrangler does NOT read `$PORT`** → change `wrangler dev -e=dev` to `wrangler dev -e=dev --port ${PORT:-8787}` for `packages/api` and `packages/mcp` (fallback preserves the direct-run contract).
  - **Expo `--port`/`--host` are auto-injected by portless** → no script change needed for Metro.
- **Stable base names + branch-prefixed worktrees.** Root `portless.json` `apps` map pins canonical names (`web`, `admin`, `guides`, `landing`, `trails`, `api`, `mcp`); portless auto-prepends the branch as a subdomain in linked worktrees, so 50 agents get distinct URLs with zero per-agent config. (advances R1, R4, R5; AE1)
- **Wire auth for portless origins now** (user decision). Better-auth `baseURL`/`trustedOrigins` and the Elysia `cors()` allowlist must accept the `.localhost` HTTPS origins *including per-worktree branch subdomains*, or login breaks under portless. Today these pin `http://localhost:8787` (`packages/api/src/auth/auth.config.ts`).
- **Keep native on its own rails, extended by LAN mode.** `getApiBaseUrl()`'s `10.0.2.2`/device-IP path stays; portless LAN mode (`PORTLESS_LAN=1`, which omits the loopback `HOST` override for Expo) is what makes a device-reachable named URL possible. `.localhost` is loopback-only and is NOT used by devices. (advances R8, R10, R11)
- **Preserve a bypass path** (R3, R14): every dev script must remain runnable directly (the `${PORT:-default}` fallbacks ensure this).
- **Leave `db.localtest.me` alone.** The local Neon HTTP proxy is a separate, already-solved concern; the spike (U1) only *validates* it still works under portless.

---

## Output / Config Surface

New or modified config the plan introduces:

```text
portless.json                      # NEW — root: apps name map, wildcard/worktree config
package.json                       # MOD — root: dev orchestration entry for portless
apps/web/package.json              # MOD — drop --port 3001
apps/admin/package.json            # MOD — drop --port 3002
packages/api/package.json          # MOD — wrangler dev --port ${PORT:-8787}
packages/mcp/package.json          # MOD — wrangler dev --port ${PORT:-8787}
packages/api/src/auth/auth.config.ts   # MOD — trustedOrigins/baseURL accept portless origins
packages/api/src/index.ts          # MOD — cors() allowlist for portless origins
apps/web/lib/{api,auth-client}.ts  # MOD — derive origin (PORTLESS_URL) not pinned :8787
scripts/portless-clean.ts (or .sh) # NEW — stale-process recovery wrapper
docs/ (dev workflow doc)           # NEW/MOD — normal + simulator + LAN + recovery
```

The tree is a scope declaration, not a constraint — per-unit `**Files:**` are authoritative.

---

## Implementation Units

### U1. Coexistence spike: portless :443 + local CA vs wrangler & Neon proxy

- **Goal:** De-risk before any rollout — prove portless's `:443` bind, sudo elevation, and local CA (`~/.portless/ca.pem`, injected as `NODE_EXTRA_CA_CERTS`) do not break `wrangler dev`, Worker-to-Worker service bindings, or the `db.localtest.me` Neon HTTP proxy.
- **Requirements:** R13; AE5 (worker reachable via named URL, not a stale process)
- **Dependencies:** none (runs first)
- **Files:** none committed — findings recorded inline in this plan's verification and, if notable, a `docs/solutions/` note
- **Approach:** Start portless, run `packages/api` through it, confirm: (a) the worker responds at its named URL; (b) `db.localtest.me` DB calls still resolve (host special-casing in `packages/api/src/db/index.ts` and `src/index.ts` unaffected); (c) no CA/TLS conflict with wrangler's own inspector/dev TLS. Document the `--no-tls` fallback if a conflict surfaces.
- **Execution note:** This is a validation spike — capture results before proceeding to U3+. If a hard conflict exists, surface it before rollout rather than coding around it.
- **Test scenarios:**
  - Covers AE5. Given portless is running, when an agent requests the API's named URL, the request reaches the intended worker (verify via a known route's response), not a stale/unrelated process.
  - Given portless has installed its CA and bound `:443`, when `wrangler dev` starts and serves a DB-backed route, the `db.localtest.me` proxy call succeeds (row returned).
  - Given two workers (api + mcp) under portless, when one calls the other via service binding, the call succeeds.
- **Verification:** API + MCP reachable by name; a DB-backed route returns real data; no TLS/CA errors in wrangler output. Conflicts, if any, documented with mitigation.
- **Spike result (2026-06-01) — mechanism verified; end-to-end serving gated on proxy ownership; a separate wrangler blocker found:**
  - portless 0.13.1 installs without sudo (mise node prefix). After a one-time `setcap cap_net_bind_service` + CA trust, it assigns stable worktree-prefixed URLs (observed: `https://portless-packrat.packrat-web-app.localhost`) and injects `PORT`/`HOST`/`PORTLESS_URL`/`NODE_EXTRA_CA_CERTS`. Verified live: `apps/web` started via `portless run`, Next honored the injected `PORT` (bound `:4456`), the backend served real responses (`307`), and the route registered correctly.
  - **END-TO-END VERIFIED (user-context proxy):** with a user-owned proxy, `apps/web` via `portless run` served a real app response through the proxy — `GET https://portless-packrat.packrat-web-app.localhost:1355/` → `HTTP/2 307`, `x-portless: 1`, `location: /auth` (the app's genuine unauthenticated redirect). The full chain works: portless.json naming + worktree prefix + `$PORT` injection + proxy → backend.
  - **Proxy-ownership pitfall (caused every proxied 404 during the spike):** the `:443` daemon had been started **as root** (via the initial sudo CA step) while dev servers register routes as the non-root user; root's `~/.portless` state is disjoint from the user's, so the root proxy answers (`x-portless: 1`) but **404s every user-registered backend**. **The proxy MUST run as the same user as the dev servers. Never `sudo portless proxy start`.**
  - **`:443` vs `:1355` — a real bootstrap fork (portless 0.13.1):** the `setcap cap_net_bind_service` capability genuinely lets the user's node bind `:443` (verified: a bare `node ... listen(443)` succeeds), but **portless 0.13.1 ignores the cap and hardcodes a sudo elevation for `:443`**. Consequences:
    - **No-sudo path (recommended default):** let portless fall back to a **user-owned `:1355`** proxy. Works end-to-end, zero sudo, fully solves the 50-agent collision problem; cost is `:1355` in URLs.
    - **Clean-`:443` path:** requires sudo at proxy start. To keep it user-context (avoid the split-brain) *and* clean, options to evaluate: `sudo -E portless proxy start` (preserves `HOME` so root proxy shares the user's `~/.portless` state), a passwordless-sudo rule scoped to `portless proxy start`, or `portless service install` (verify it runs as the user). The plain `setcap` route does NOT achieve no-sudo `:443` with this portless version.
  - **Blocker (independent of portless, but gates the agent workflow):** `packages/api` `wrangler dev` runs in **remote mode** because of its `containers` + `durable_objects` bindings, so in non-interactive/agent contexts it fails with *"More than one account available"* unless `CLOUDFLARE_ACCOUNT_ID` is **exported into the process env**. The value exists in `packages/api/.dev.vars` and root `.env.local` but is not auto-exported to wrangler's CLI. This bites every one of the 50+ agents regardless of portless. Resolution moved into U3. Secondary concern: 50 agents each open a *remote* CF dev session (possible account-side limits) — see Risk table.
  - `db.localtest.me` coexistence was not exercised: the worktree's `.dev.vars` points NEON at cloud Neon, not the local proxy, so that sub-risk only applies if someone switches NEON to `db.localtest.me`.

### U2. Install portless + host bootstrap (privileged setup) + root naming config

- **Goal:** Add portless to the repo with stable canonical service names and worktree-aware routing, plus a one-time host-bootstrap path that needs no sudo after first run.
- **Requirements:** R1, R4, R5
- **Dependencies:** U1
- **Files:** `portless.json` (new), root `package.json` (dev orchestration entry + `portless:setup` script + non-privileged postinstall readiness check), `scripts/portless-setup.sh` (new, host bootstrap), `.gitignore` (portless state if any), `docs/` (brief "what portless is" note — expanded in U10)
- **Approach:** Root `portless.json` with an `apps` map binding `apps/web`→`web`, `apps/admin`→`admin`, `apps/guides`→`guides`, `apps/landing`→`landing`, `apps/trails`→`trails`, `packages/api`→`api`, `packages/mcp`→`mcp`. Rely on portless auto-discovery of Bun workspaces for anything unlisted, and on branch-prefixed subdomains for linked worktrees (enable `--wildcard` / `PORTLESS_WILDCARD=1` so worktree subdomains resolve). Confirm project-name inference (`@packrat` scope) yields the intended base.
- **Host bootstrap (verified CLI, run once per machine):** the privileged setup is `sudo setcap 'cap_net_bind_service=+ep' "$(readlink -f "$(command -v node)")"` (node binds `:443` without sudo thereafter) + `portless trust` (CA into system trust store) + optionally `portless service install` (proxy auto-starts on OS boot — recommended for the 50-agent host). NOTE: `portless ca install` is **not** a command; the CA is trusted by `portless trust` or automatically on first `portless proxy start`. Package this as `bun run portless:setup` (idempotent) rather than a `postinstall` — privileged ops must never run in `postinstall`/CI/non-TTY. The postinstall step is limited to a **non-privileged readiness check** that prints "run `bun run portless:setup`" when the cap/CA are absent. **mise gotcha:** node lives under `~/.local/share/mise/...`, so a node version bump moves the binary and silently drops the `setcap` (portless then falls back to `:1355`) — the setup script must be re-runnable and the readiness check should detect this. `setcap` on node lets any node process bind low ports — note this deliberate loosening in the script.
- **Docker/static routes:** `portless alias <name> <port>` registers a static route for a non-portless-managed process (e.g. the Neon proxy container on `:4444`) if it ever needs a named URL — not required for default cloud-Neon config, but available.
- **Patterns to follow:** Bun workspace layout in root `package.json` `workspaces`; existing per-app script naming; existing `scripts/` conventions.
- **Test scenarios:**
  - Given `portless.json` is present, when portless starts in the main worktree, each app is reachable at its canonical `<name>.<project>.localhost` URL.
  - Covers AE1 (partial). Given a second worktree on branch `X`, when portless starts there, services resolve at `x.<name>.<project>.localhost` distinct from main.
- **Verification:** Named URLs resolve for all seven services in the main worktree; a linked worktree yields branch-prefixed URLs.

### U3. Make dev scripts honor injected `$PORT` (Next + wrangler) with bypass fallback

- **Goal:** Eliminate hardcoded ports so per-process `PORT` injection actually prevents collisions, without breaking direct `bun run dev`.
- **Requirements:** R2, R3, R12, R14; AE2
- **Dependencies:** U2
- **Files:** `apps/web/package.json` (drop `--port 3001`), `apps/admin/package.json` (drop `--port 3002`), `packages/api/package.json` (`wrangler dev -e=dev --port ${PORT:-8787}`), `packages/mcp/package.json` (`wrangler dev -e dev --port ${PORT:-8787}`), wrangler account-id wiring (see below)
- **Approach:** Next reads `$PORT` natively, so removing the `--port` flag lets injection work and falls back to Next's default when run directly. Wrangler ignores `$PORT`, so use shell default expansion `${PORT:-8787}` — portless injects `PORT`; a direct run uses `8787`. Verify Turbo dependency ordering is preserved when portless delegates to `turbo run`.
- **Non-interactive wrangler account selection (from U1 spike):** `packages/api` runs `wrangler dev` in **remote mode** (its `containers`/`durable_objects` bindings force it), so in agent/non-interactive contexts it needs `CLOUDFLARE_ACCOUNT_ID` in the **process env**. It currently sits in `.dev.vars`/`.env.local` (worker-runtime + Bun-loaded) but is not exported to wrangler's CLI. Fix by pinning `account_id` in `packages/api/wrangler.jsonc` (cleanest — deterministic, no env reliance) **or** exporting `CLOUDFLARE_ACCOUNT_ID` ahead of `wrangler dev` in the dev script. Pinning in `wrangler.jsonc` is preferred so all 50 agents behave identically. Apply the same to `packages/mcp` if it is also remote.
- **Patterns to follow:** existing bare `next dev` in `apps/guides`/`landing`/`trails` (already PORT-friendly); existing `wrangler.jsonc` config blocks.
- **Test scenarios:**
  - Covers AE2. Given a contributor runs `bun run --cwd apps/web dev` directly (no portless), the app still starts on its default port via fallback.
  - Covers AE1 (partial). Given two worktrees each run the API through portless, both `wrangler dev` processes bind distinct injected ports with no "address in use" error.
  - Given `apps/web` runs under portless, when injected `PORT=47xx`, Next serves on that port and the named URL proxies to it.
  - Given a non-interactive agent shell, when `wrangler dev` starts for `packages/api`, account selection succeeds (no "More than one account available" error) because `account_id` is pinned / exported.
- **Verification:** Direct runs work on defaults; portless runs get injected ports; no collisions across two simultaneous worktrees; `wrangler dev` starts cleanly in a non-interactive shell; `turbo run dev` ordering intact.

### U4. Agent URL discovery via `PORTLESS_URL`

- **Goal:** Let agents/subagents obtain their own instance URL without scraping another process's terminal output.
- **Requirements:** R6; AE1
- **Dependencies:** U3
- **Files:** `docs/` (agent-facing note), optionally a tiny helper script under `scripts/` that prints resolved service URLs for the current worktree
- **Approach:** Document that each dev process receives `PORTLESS_URL` (its public URL) and that branch-prefixed names are derivable from the current branch. Provide a one-shot command/script an agent can call to print the active named URLs for this worktree.
- **Test scenarios:**
  - Covers AE1. Given an agent starts services in a worktree, when it reads `PORTLESS_URL` / runs the helper, it gets the correct reachable URL for its instance without reading another agent's output.
- **Verification:** The documented discovery path returns the correct per-worktree URL in a fresh worktree.

### U5. Wire better-auth + CORS for portless origins (incl. per-worktree wildcards)

- **Goal:** Make login work under portless by accepting `.localhost` HTTPS origins and per-worktree branch subdomains.
- **Requirements:** R8 (support), R12; AE1 (auth'd flows)
- **Dependencies:** U3
- **Files:** `packages/api/src/auth/auth.config.ts` (`baseURL`, `trustedOrigins`), `packages/api/src/index.ts` (Elysia `cors()` config), `packages/api/src/utils/env-validation.ts` (`BETTER_AUTH_URL` default), `packages/api/src/utils/openapi.ts` (dev server URL)
- **Approach:** Extend `trustedOrigins` and the CORS allowlist to include the portless API origin(s). Because worktrees produce `*.api.<project>.localhost`, support a wildcard/suffix match for trusted origins in local/dev mode rather than a single literal. Keep `packrat://` (native scheme) and the existing `localhost:8787` for the bypass path. Drive values from env (`BETTER_AUTH_URL` / a portless-aware origin) so production config is untouched. Gate the wildcard relaxation to development to avoid weakening production auth.
- **Patterns to follow:** existing `trustedOrigins` array and `cors()` usage; env-driven config in `env-validation.ts`. Cross-origin auth learnings in `docs/solutions/` (web cross-origin auth + local neon-proxy note).
- **Test scenarios:**
  - Given dev mode and a portless API origin, when the web app posts to `auth.login`, the request passes CORS preflight and sets the session cookie.
  - Given a per-worktree origin `feat-x.api.<project>.localhost`, when auth is attempted, the wildcard trusted-origin match accepts it.
  - Given production config, when a non-trusted origin calls auth, it is rejected (wildcard relaxation does not leak to prod).
  - Given the bypass path (`localhost:8787`), auth still works unchanged.
- **Verification:** Login succeeds end-to-end under portless in main and a linked worktree; production origin behavior unchanged; bypass path intact.

### U6. Web app origin derivation (drop pinned `:8787`)

- **Goal:** Web apps target the portless API origin instead of a hardcoded `localhost:8787`, so a per-worktree dynamic API origin doesn't break calls.
- **Requirements:** R12; AE1
- **Dependencies:** U5
- **Files:** `apps/web/lib/api.ts`, `apps/web/lib/auth-client.ts`, `apps/web/app/auth/page.tsx`, `apps/web/components/screens/ai-screen.tsx` (and `apps/admin` equivalents if pinned)
- **Approach:** Derive the API base from `NEXT_PUBLIC_API_URL` populated from `PORTLESS_URL`/portless config in dev, keeping the `?? 'http://localhost:8787'` fallback for direct runs. No client redesign — only origin selection changes.
- **Patterns to follow:** existing `NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'` pattern; `@packrat/api-client` `createApiClient` (`baseUrl` = same origin when proxied).
- **Test scenarios:**
  - Given portless assigns a per-worktree API origin, when the web app makes an API call, it resolves against that origin (not a stale `:8787`) and succeeds.
  - Given a direct run without portless, the fallback origin is used and calls succeed.
- **Verification:** Web → API calls succeed under portless in a linked worktree; direct-run fallback unaffected.

### U7. Expo simulator targets the named local API

- **Goal:** Expo on simulator/emulator hits the local API by its named portless URL with no manual port editing — part of the first usable slice.
- **Requirements:** R8, R9, R11; AE3
- **Dependencies:** U5
- **Files:** `apps/expo/lib/api/getBaseUrl.ts` (reconcile `10.0.2.2` swap with named URL), `packages/env/src/expo-client.ts` (`EXPO_PUBLIC_API_URL`), `apps/expo/.env*`/env wiring
- **Approach:** Set `EXPO_PUBLIC_API_URL` to the portless API URL for simulator/emulator runs. Reconcile `getApiBaseUrl()`: on iOS simulator the host loopback is reachable; on Android emulator keep the `10.0.2.2` mapping (or use portless LAN host). No broad API-client redesign (R11) — only base-URL selection. Confirm Metro's portless `--port`/`--host` auto-injection doesn't conflict with the API URL config (Metro ≠ API).
- **Patterns to follow:** existing `getApiBaseUrl()` platform branch; `clientEnvs.EXPO_PUBLIC_API_URL` usage in `rpcTransport.ts`/`client.ts`.
- **Test scenarios:**
  - Covers AE3. Given the API runs through portless, when the Expo app runs in iOS simulator, authenticated API calls reach the local API without editing a hardcoded port.
  - Given Android emulator, when the app calls the API, the `10.0.2.2`/LAN mapping resolves to the running local API.
  - Given no portless (direct run), `EXPO_PUBLIC_API_URL` fallback still works.
- **Verification:** Simulator and emulator both make successful authenticated calls to the local API via the named/derived URL; direct-run path intact.

### U8. Expo simulator auth parity check

- **Goal:** Ensure auth works from Expo simulator against the portless API (cookies/origins differ from web).
- **Requirements:** R8, R9; AE3
- **Dependencies:** U5, U7
- **Files:** none expected beyond U5/U7; otherwise minor `apps/expo` auth wiring
- **Approach:** Verify the native `packrat://` scheme + portless API origin combination authenticates. Confirm `trustedOrigins` from U5 covers the native case.
- **Test scenarios:**
  - Given the simulator app and portless API, when the user logs in, the session is established and protected routes succeed.
- **Verification:** Login + a protected call succeed from simulator.

### U9. Expo physical-device LAN mode

- **Goal:** A physical phone/tablet on the same network reaches the local API via a LAN-reachable named URL — required before the workflow is "complete." (The risky unit.)
- **Requirements:** R10; AE4
- **Dependencies:** U7
- **Files:** `apps/expo` env/config for LAN host, `docs/` (LAN setup), possibly `apps/expo/lib/api/getBaseUrl.ts`
- **Approach:** Enable portless LAN mode (`PORTLESS_LAN=1`) so services bind LAN-reachably and Expo's `HOST` override is omitted. Determine the exact iOS and Android networking config needed (App Transport Security / cleartext or trusted-cert handling for the portless CA on device; same-subnet requirement). Point `EXPO_PUBLIC_API_URL` at the LAN-reachable name/IP for device runs.
- **Execution note:** Treat as a spike-then-implement — device networking + the portless CA on a physical device is the least-documented area; validate reachability before finalizing config.
- **Test scenarios:**
  - Covers AE4. Given portless LAN mode and a phone on the same network, when the Expo app runs on the phone, it reaches the local API through a LAN-reachable URL.
  - Given iOS device, the portless CA / ATS configuration permits the API call (no cert/cleartext rejection).
  - Given Android device, the network-security-config permits the API call.
- **Verification:** A physical iOS and Android device each complete an authenticated API call against the LAN local API.

### U10. Stale-process recovery + documentation

- **Goal:** Provide cleanup/recovery for abandoned agent sessions and document the full workflow.
- **Requirements:** R7, R15
- **Dependencies:** U2, U3, U7, U9
- **Files:** `scripts/portless-clean.ts` or `.sh` (wrapper over `portless clean`/proxy stop), `docs/` workflow doc (normal, simulator, physical-device LAN, recovery), root `package.json` script entry
- **Approach:** Wrap `portless clean` / proxy restart with PackRat-friendly defaults and document when to use it (stale `/etc/hosts` entries, abandoned worktree routes, CA reset). Document the normal multi-agent workflow, Expo simulator workflow, physical-device LAN workflow, and recovery steps. Note the no-silent-caps expectation: if 50 concurrent agents hit a portless limit, surface it.
- **Test scenarios:**
  - Given stale routes from an abandoned worktree, when the cleanup script runs, routes/processes are cleared and a fresh start succeeds.
  - `Test expectation: docs unit — validated by following the written steps end-to-end in a clean worktree.`
- **Verification:** Cleanup script recovers a wedged local state; a new contributor can follow the docs to run web, simulator, and device workflows.

---

## Scope Boundaries

### Deferred for later (origin scope sequencing)

- Physical-device LAN (U9) may land after the simulator slice (U7/U8), but stays in this plan's scope so it doesn't disappear (origin Key Decisions).

### Deferred to Follow-Up Work (plan-local)

- Remote Turbo cache configuration (orthogonal to portless).
- Migrating Turbo itself onto `development` (separate effort; this plan rides the `feat/turbo-l4` base).
- **Portless API-origin parity for `apps/admin`, `apps/trails`, `apps/guides`** (surfaced in U6 code review). U6 wired `apps/web` only. These need their own care, not a regression from U6: `apps/admin` requires `NEXT_PUBLIC_API_URL` (`z.string().url()`, no default) so it can't self-derive without an env-schema change; `apps/trails` defaults to **prod** (`https://api.packratai.com`) so changing its resolution risks prod behavior. The right shape is a shared `resolveApiBaseUrl(explicit, fallback)` (the U6 derivation is generic — `<app>.localhost` → `api.localhost`) extracted to `@packrat/api-client` and adopted per-app with verification. `apps/landing` needs nothing (no API calls); `apps/guides` API refs are build-time CLI scripts, not a portless runtime client.

### Out of scope (origin)

- Production, staging, and deployed preview URL strategy — local development only.
- Broad rewrite of the Expo API client or env system (only reliable local URL selection; R11).
- Portless-managing packages that don't run a persistent dev server.
- Replacing Turborepo as the task runner.
- Re-routing or replacing the `db.localtest.me` Neon proxy (validated only, U1).

---

## Dependencies / Assumptions

- **Base:** `feat/turbo-l4` (Turbo + Elysia, 0 behind `development`). Work happens in the `.worktrees/explore/portless-packrat` worktree, now refreshed onto this base. `bun install` is required before implementation (`node_modules` currently absent; needs `PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN`).
- Agents run host-side sharing loopback/`/etc/hosts` (no sandboxing) — confirmed; this is portless's intended model. Docker is used for specific services (e.g. Neon proxy), not agent isolation; do not dockerize the web/Worker dev servers without revisiting (containers can't resolve host `.localhost`).
- Portless supports Bun workspaces and delegates to `turbo run` when `turbo.json` is present; it injects `PORT`/`HOST`/`PORTLESS_URL`.
- Next.js reads `$PORT`; wrangler does not (needs `--port`); Expo `--port`/`--host` are auto-injected.
- Portless binds `:443` with sudo elevation and a local CA (`NODE_EXTRA_CA_CERTS`); a `--no-tls` fallback exists if it conflicts with wrangler (U1: no conflict observed). After one-time host bootstrap (setcap + `portless trust`, optionally `portless service install`), no further sudo is needed per worktree/agent.
- `packages/api` `wrangler dev` runs in **remote mode** (forced by `containers`/`durable_objects`) and requires a deterministic CF account selection in non-interactive shells (U3 pins `account_id`). This is a PackRat dev-setup fact independent of portless.
- Expo consumes its API base URL from `EXPO_PUBLIC_API_URL` (`packages/env/src/expo-client.ts`).

---

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Portless `:443`/CA conflicts with wrangler dev TLS or breaks `db.localtest.me` | ~~Medium~~ Low (U1: GREEN) | High | U1 spike done — no conflict observed; `--no-tls` fallback remains documented |
| Wrangler `dev` fails for `packages/api` in non-interactive agent shells (remote mode + multi-account, no `CLOUDFLARE_ACCOUNT_ID` exported) | High (confirmed in U1) | High | Pin `account_id` in `wrangler.jsonc` (U3); applies with or without portless |
| 50 agents each open a *remote* CF dev session (containers/DO force remote) → possible account-side session limits / quota | Medium | Medium | Monitor; investigate whether `packages/api` can run container-less local dev for agents; document in U10 |
| `setcap` on mise node silently dropped after a node version bump → portless falls back to `:1355` | Medium | Low | Idempotent `portless:setup` + postinstall readiness check (U2) |
| Proxy started as **root** (via sudo) split-brains from user-context route registrations → answers but 404s every backend (hit during U1) | High if sudo-started | High | Proxy must run as the dev user; `setcap` enables `:443` without root; never `sudo portless proxy start`; `portless:setup` + docs enforce this (U2/U10) |
| Per-worktree wildcard trusted-origins weakens production auth | Low | High | Gate wildcard relaxation to dev mode only (U5); production origin test |
| Physical-device LAN + portless CA on iOS/Android is under-documented | High | Medium | U9 treated as spike-then-implement; validate device reachability first |
| `$PORT` change breaks Turbo dependency ordering | Low | Medium | Verify `turbo run dev` ordering in U3 |
| 50 concurrent agents hit an undocumented portless daemon limit | Low | Medium | No-silent-caps: surface/log limits in U10 docs |

---

## Phased Delivery

- **Phase 1 — De-risk & foundation:** U1 (spike), U2 (install/config), U3 (`$PORT`).
- **Phase 2 — Agents & web:** U4 (discovery), U5 (auth/CORS), U6 (web origin).
- **Phase 3 — Expo:** U7 (simulator), U8 (simulator auth), U9 (physical-device LAN).
- **Phase 4 — Harden & document:** U10 (recovery + docs).

---

## Success Criteria (from origin)

- 50+ agents/worktrees run local services with zero port-collision failures and no manual port assignment as the normal path.
- Expo targets the local API in simulator/emulator mode, with a working+documented physical-device path.
- A downstream implementer can execute each unit without inventing product behavior.
- The workflow stays understandable for humans who don't use subagents heavily (bypass path preserved).
