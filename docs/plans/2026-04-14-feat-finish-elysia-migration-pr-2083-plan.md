---
title: Finish Hono → Elysia Migration (PR #2083)
type: feat
status: active
date: 2026-04-14
---

# Finish Hono → Elysia Migration (PR #2083)

## Enhancement Summary

**Deepened on:** 2026-04-14
**Sections enhanced:** All phases + risk assessment
**Research inputs:** parity audit (Explore), Phase 0 feasibility audit (Explore),
Elysia/Eden/Vitest context7 + web research, code-simplicity review, learnings
researcher.

### Key improvements from research

1. **Parity audit de-risked.** Static route audit (see
   [Research Insights: Phase 1](#research-insights-phase-1-parity)) found **zero
   missing routes** across all 14 groups — 17 packs, 12 auth (including exact
   `/api/auth/refresh` path), ETL, feed comments+likes, catalog, trips,
   templates, wildlife, etc. The only degraded surface is `admin/index.ts` UI
   (HTMX interactivity stripped, basic-auth still works). This collapses
   Phase 1 from a major effort to a smoke check.

2. **GO/NO-GO is a genuine GO — conditionally.** The Phase 0 initial audit
   flagged NO-GO on tsconfig grounds, but 2026 Elysia/Eden docs show the
   blocker is *soluble*: `@elysiajs/eden` runtime does **not** import `elysia`;
   `import type { App }` is fully erased by TS; put `elysia` in Expo
   `devDependencies` only (type-only peer) and Metro never sees it. See
   [Research Insights: Phase 0](#research-insights-phase-0-gono-go). The
   original drop (`c6d8b1c0`) was a tsconfig-isolation failure, not a
   fundamental RN/CF incompatibility.

3. **Scope-cut advice from simplicity review is correct.** Restoring all 11
   deleted test files is out of scope for a drop-in; keep only the **3
   middleware auth tests** (they guard the one thing a framework swap
   actually breaks: auth posture). Skip service-test restoration. Skip the
   ts-morph JSON inventory — `tsc` over expo once Treaty is restored IS the
   parity check.

4. **Vitest + pool pin is load-bearing.** There is a sibling plan
   (`docs/plans/2026-04-14-chore-finalize-dependabot-consolidation-plan.md`)
   pinning `@cloudflare/vitest-pool-workers@0.14.3`, `workerd@1.20260310.1`,
   `wrangler@4.81.1`. Do **not** drift from those pins in this PR. Vitest v4
   is supported by pool 0.13.x+, but upgrading is a separate concern.

5. **`.openapi()` strip is probably fine.** `@elysiajs/openapi` uses
   `mapJsonSchema` + `zod-to-json-schema` for Zod v3; per-route Hono
   `.openapi()` metadata maps cleanly onto Elysia `detail: { summary, tags }`.
   Confirm by fetching `/openapi.json` and spot-checking, don't rewrite.

### New considerations discovered

- **Treaty over an adapter-bound Elysia works.** `.compile()` is runtime-only
  and does not affect `typeof app` inference — safe to call before
  `export type App = typeof app`.
- **Simpler parity check exists.** `git diff` of `.(get|post|put|patch|delete)(`
  lines before/after + `tsc` on expo post-Treaty gives exhaustive parity for
  zero dev cost (see research insight under Phase 1).
- **Admin UI regression** is the one *real* regression found. HTMX-based
  interactivity was stripped (906→580 LOC); all endpoints still work, but the
  in-browser admin panel is now mostly static. Decision needed: fix in this PR,
  follow-up PR, or accept.
- **Vitest pool pin conflict risk.** PR #2118 pins pool to 0.14.3 but this
  PR's `71396ac` reverts to vitest ~3.1.0 for "cloudflare pool workers compat"
  — these must be reconciled before merge or one will overwrite the other.
- **The simplicity reviewer's 3-step collapse is the leading recommendation:**
  (1) approve CI, (2) restore Treaty + fix expo `tsc`, (3) restore 3
  middleware auth tests. Original phases 2–4 below are now optional.

## Overview

PR #2083 (`claude/migrate-hono-to-elysia-F0CtM` → `development`) swaps the API
framework from Hono to Elysia. As of audit (2026-04-14) it sits at **103 commits,
116 files, +7,468 / −15,207**, 0 commits behind `development`, and CI in
`action_required` (manual approval gate, nothing green).

The stated goal — *unlock Eden Treaty for end-to-end type-safe client calls
because Hono RPC is too broken* — **is currently NOT delivered**. Commit
`c6d8b1c0 fix(expo): drop Eden Treaty from client, remove elysia deps from expo`
removed the Treaty client entirely; `apps/expo/lib/api/client.ts` is back to a
plain `fetch` wrapper with `any` defaults (see `ca580151`). The server is on
Elysia but the expo app gets zero type-safety benefit, leaving the PR as pure
framework churn.

This plan finishes the migration **as a true drop-in** AND restores the e2e
type-safety win — otherwise the PR should be closed.

## Problem Statement

Three classes of risk in the current branch state:

1. **Goal regression** — Eden Treaty was wired up in commit `5a4de8aa`, then
   removed in `c6d8b1c0` to make the expo `tsc` pass. The migration's only
   user-visible benefit is gone. We migrated the server but kept the legacy
   client.
2. **Functional regression risk** — 9,742 lines deleted from `packages/api/src/routes`,
   ~40 small route files collapsed into 13 mega-`index.ts` files (e.g.
   `packs/index.ts` 866 LOC, `packTemplates/index.ts` 717 LOC, `auth/index.ts`
   677 LOC, `admin/index.ts` 695 LOC). 130 route handlers exist post-migration;
   the previous Hono surface needs a one-to-one parity check.
3. **Test regression** — 11 test files deleted with **0 replacement tests**:
   - `middleware/__tests__/{adminMiddleware,apiKeyAuth,auth}.test.ts`
   - `services/__tests__/{catalogService,imageDetectionService,weatherService}.test.ts`
   - `utils/__tests__/openapi.test.ts`
   - Plus removed routes never had handler tests
   - `services/__tests__/packService.test.ts` kept but trimmed (−15 LOC)
   - `utils/__tests__/{auth,env-validation}.test.ts` kept but heavily trimmed

Additional concerns:

- `.openapi()` metadata stripped from every route (`d3341d3c`) — Scalar UI
  fidelity may have regressed
- `packages/api/src/global.d.ts` deleted (−10 LOC of ambient types)
- `container_src/server.ts` rewritten (+103 / −221) — sidecar container behavior
  needs smoke-testing
- `zod-to-json-schema` thrash: removed in `ec118050`, then re-added via
  `mapJsonSchema` in `2a936524` — confirm OpenAPI output is still complete
- CI status `action_required`: every workflow needs maintainer to click "approve
  and run" — actual pass/fail unknown right now

## Proposed Solution

Two-phase finish, gated by a **GO / NO-GO decision** on the e2e-types question.

### Phase 0 — GO/NO-GO on Eden Treaty (decision gate, ~30 min)

Establish whether restoring Treaty is feasible **before** spending effort on
parity. The Treaty drop in `c6d8b1c0` was a tsc-error workaround, not a design
decision.

- Read commit `c6d8b1c0` and `54187d4a fix(expo): use local App type alias to
  avoid pulling Elysia into root...` to recover the actual error chain
- Re-introduce `@elysiajs/eden` in `apps/expo` only (not root)
- Type-only import the `App` type from `@packrat/api` (already exported from
  `packages/api/src/index.ts:60`)
- Confirm the root `tsconfig` glob exclusion (added in `bd06884a`) keeps
  Elysia's heavy types out of `tsc` for unrelated packages
- Either: produce a 5-line failing repro that justifies keeping the fetch
  wrapper, OR a working Treaty client behind a feature flag

**Decision:**

- **GO (Treaty restorable)** → continue to Phase 1, scope expands to include
  client migration (Phase 1.5)
- **NO-GO (Treaty unworkable on Cloudflare Workers + expo + RN web)** →
  recommend closing PR. Document why, add the repro to `docs/solutions/`. Do
  not merge a migration that delivers no benefit.

### Research Insights: Phase 0 GO/NO-GO

**Updated disposition: LIKELY GO.** A first-pass internal audit concluded
NO-GO on tsconfig grounds, but 2026 Elysia 1.4 + Eden Treaty docs show the
blocker is tractable. The original drop in `c6d8b1c0` happened because
`import { App } from '@packrat/api'` pulled Elysia's type graph into the
Expo-extended root tsc. That was a monorepo tsconfig mistake, not a platform
incompatibility.

**What the dropped Treaty wrapper looked like** (reconstructed from
`c6d8b1c0` parent):

```ts
// apps/expo/lib/api/client.ts (pre-c6d8b1c0)
import { treaty } from '@elysiajs/eden';
import type { App } from '@packrat/api';      // TYPE-ONLY

export const api = treaty<App>(API_URL, {
  fetch: { credentials: 'include' },
  async headers() {
    const token = await getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
  async onResponse(response) {
    if (response.status === 401 && !response.url.endsWith('/api/auth/refresh')) {
      await refreshAccessToken();
    }
  },
});
```

**Why it was dropped.** Root `tsc --noEmit` walked the Elysia type graph when
`@packrat/api` was exposed as a bare-module path. Fixes attempted: local
`type App = any` alias (`54187d4a`), `any` generic defaults (`ca580151`),
glob-exclude `packages/api` from root tsc (`bd06884a`) — all partial.

**Why restoration now is likely sound:**

1. `@elysiajs/eden` runtime **does not import `elysia`** — the `treaty`
   runtime is a Proxy over `fetch`. The App type is a compile-time-only
   artifact.
2. Put `elysia` in `apps/expo/package.json` `devDependencies` (types only).
   Metro will never bundle it.
3. `.compile()` on the server does NOT affect `typeof app` — Treaty inference
   works with the adapter-bound, compiled Elysia instance.
4. Use `import type { App } from '@packrat/api'` ONLY — TS erases it. No
   runtime Elysia in the Expo bundle.
5. For root tsc, leave `@packrat/api/*` as the non-bare alias (no change from
   current state); the Expo app's *own* `tsconfig.json` resolves the bare
   `@packrat/api` via the monorepo workspace, and its types-path setup is
   isolated from root tsc already (`bd06884a`'s glob exclusion is the right
   half; the other half is putting `elysia` in Expo devDeps).

**Edge cases:**

- **Metro resolver gotcha.** If Metro hits `resolverMainFields` or
  `unstable_enablePackageExports` issues, confirm no accidental value-level
  `import { Elysia } from 'elysia'` in the client file — one slip pulls the
  framework into the bundle.
- **Hook callsite shape.** Current hooks use `apiClient.get(path, ...)` —
  Treaty's idiomatic shape is `api.packs.get({ query })`. For drop-in, wrap
  Treaty in a thin fetch-like facade that preserves the existing signature,
  then migrate hooks feature-by-feature. Full migration of 43+ hooks is NOT
  in scope for this PR.
- **`.compile()` placement.** Confirmed safe — `export type App = typeof app`
  references the post-chain type before `.compile()` runs at module load.

**References:**

- https://elysiajs.com/integrations/cloudflare-worker
- https://elysiajs.com/eden/treaty/overview
- https://elysiajs.com/blog/elysia-14 (1.4 inference improvements)
- https://github.com/elysiajs/elysia/issues/1189 (grouped-endpoint inference —
  resolved pre-1.4)
- Commits to diff: `c6d8b1c0`, `5a4de8aa`, `54187d4a`, `ca580151`,
  `bd06884a`, `01f2155b`

### Phase 1 — Parity audit (drop-in correctness)

Establish a **machine-checkable** parity contract between the pre-PR Hono surface
and the current Elysia surface:

1. Generate the Hono route inventory from `origin/development`:
   - Method, path, middleware stack (auth/admin/apiKey), request schema, response shape
   - Save to `docs/audits/2083-hono-routes.json`
2. Generate the Elysia route inventory from the PR head:
   - Walk `packages/api/src/routes/**/*.ts`, extract the same fields
   - Save to `docs/audits/2083-elysia-routes.json`
3. Diff the two — fail loudly on any:
   - Missing path / method
   - Changed auth posture (e.g. route was admin-only, now public)
   - Changed status code semantics
   - Changed request/response shape
4. Cross-check against expo callsites: `apps/expo/features/**/hooks/*.ts` —
   every `fetch(`${API_URL}/api/...` ${m}` call must match a surviving route

Output: a checked-in audit doc with each route ✅/❌ and remediation commits for
the ❌ rows.

### Research Insights: Phase 1 Parity

**Static audit already done — zero missing routes.** An Explore agent ran a
before/after route-surface diff against `origin/development`. Full inventory:

| Group | Status | Note |
|---|---|---|
| packs | ✅ all 17 | paths converted `/{x}` → `/:x` (Elysia syntax); admin gate on `/generate-packs` intact (line 159) |
| auth | ✅ all 12 | **`/api/auth/refresh` exact path preserved** — client hardcode safe |
| catalog | ✅ all 11 | ETL endpoint `/api/catalog/etl` present |
| feed | ✅ all 11 | posts + comments + comment likes all wired |
| admin | ⚠ simplified UI | LOC 906→580; basic-auth endpoints intact; **HTMX interactivity stripped** |
| trips, templates, wildlife, guides, user, chat, weather, upload, seasonSuggestions, trailConditions, knowledgeBase | ✅ all present | — |
| `alltrails.ts` | — | empty file both pre & post; intentionally unimported |

**The only real regression surfaced by parity audit:** `admin/index.ts` UI
complexity reduction. All endpoints still respond, but the in-browser admin
panel lost its HTMX-based interactive forms. **Decision needed:** (a) restore
HTMX UI in this PR, (b) carve out as follow-up, (c) accept. Given the
"drop-in" framing, recommend (b) — file a follow-up issue, don't block the
merge.

**Simpler parity approach (replaces ts-morph JSON audit).** The simplicity
reviewer is right: restoring Treaty + running `tsc` on expo IS the parity
check. Any missing server route produces a type error at a hook callsite.
For belt-and-braces, a 2-line shell check:

```bash
git diff origin/development...HEAD -- 'packages/api/src/routes/**' \
  | grep -E '^-.*\.(get|post|put|patch|delete)\(' | sort > /tmp/removed.txt
grep -rEh '\.(get|post|put|patch|delete)\(' packages/api/src/routes | sort > /tmp/current.txt
# Visual scan /tmp/removed.txt for anything not obviously renamed/kept
```

Free, exhaustive, no ts-morph, no JSON artifact. **Drop the
`docs/audits/2083-*.json` deliverable from the plan** unless the admin UI
regression forces a deeper review.

**References:**

- Parity audit raw output: see agent report summarized in Enhancement Summary
- Static-analysis alternative (if deeper audit needed): ts-morph walk over
  `packages/api/src/routes/**` extracting `(method, path, authGuard)` triples
  — appropriate only if post-Treaty `tsc` on expo surfaces unexpected gaps

### Phase 1.5 — Restore Eden Treaty via dedicated `packages/api-client` (only if Phase 0 = GO)

**Architectural decision (user-provided):** *"In a monorepo it's easier to put
Eden Treaty in its own `api-client` package — keeps types clean and prevents
bloat from leaking."* Adopt this pattern. Do **not** reinstate `@elysiajs/eden`
in `apps/expo` directly — that was the original tsconfig-isolation failure
that led to `c6d8b1c0`.

**New package layout:**

```
packages/
  api/                  # server (Elysia), as-is
    package.json        # exports `type App`
  api-client/           # NEW — type-safe client for all consumers
    package.json        # name: @packrat/api-client
                        #   deps: @elysiajs/eden
                        #   devDeps: elysia (types only), @packrat/api (workspace:*)
    src/
      index.ts          # exports the Treaty client + auth-token plumbing
    tsconfig.json       # permissive of Elysia's type graph; isolated from Expo tsc
```

**Why this is clean:**

1. `elysia` and the full API type graph live in exactly ONE Expo-adjacent
   package; Expo's root tsc never walks them.
2. `apps/expo` adds a single dep: `@packrat/api-client`. No `@elysiajs/eden`,
   no `elysia`, no `@packrat/api` direct.
3. Guides and landing apps can adopt the same client later without rework.
4. If Metro ever complains, the fix is local to one package.

**Work items:**

- Create `packages/api-client/` with its own `package.json` + `tsconfig.json`
  - deps: `@elysiajs/eden` (runtime)
  - devDeps: `elysia` (types), `@packrat/api` (workspace:*)
  - `type: "module"`, exports `./src/index.ts` per PackRat convention
- Port the legacy fetch-wrapper's auth surface into `api-client` — token
  retrieval, refresh flow (module-level `pendingRefresh` deduper),
  `needsReauthAtom` signaling
- Export Treaty-bound `api` + a back-compat `apiClient` facade preserving
  `.get / .post / .put / .patch / .delete` shape (43+ hook callsites depend on
  it — see `apps/expo/lib/api/client.ts` header)
- Swap `apps/expo/lib/api/client.ts` to a re-export stub:
  `export { api, apiClient } from '@packrat/api-client'` — zero churn at
  callsites
- Migrate ONE feature hook end-to-end as a reference to prove Treaty types
  flow: suggest `apps/expo/features/catalog/hooks/useCatalogItems.ts` — its
  tsc error (per PR comment trail) is a natural first fix
- Leave the other 42 hooks on the legacy facade; incremental migration is a
  follow-up

### Research Insights: Phase 1.5 Treaty restoration

**Wrapper shape that keeps 43 callsites quiet.** Treaty's native shape is
`api.packs.get({ query })`; hooks want `apiClient.get('/api/packs', { params })`.
Build the facade as:

```ts
// packages/api-client/src/facade.ts (sketch — reference, not final)
import { treaty } from '@elysiajs/eden';
import type { App } from '@packrat/api';

export const api = treaty<App>(API_URL, { /* headers, onResponse */ });

export const apiClient = {
  get:  <T = unknown>(path: string, opts?: RequestInit) => fetchWithAuth<T>('GET',    path, opts),
  post: <T = unknown>(path: string, body?: unknown, opts?: RequestInit) => fetchWithAuth<T>('POST',  path, body, opts),
  // ... put, patch, delete identical
};
```

Typed callsites go through `api.*`; legacy untyped callsites stay on
`apiClient.*`. Zero forced refactor.

**Gotchas from 2026 docs (confirm during implementation):**

- `treaty` (current) replaced `edenTreaty` (legacy). Use `treaty`.
- The `.index` accessor for `/` routes was dropped in Eden 1.3+ — if you hit
  it, it's a stale example.
- Don't pass the Elysia instance directly (`treaty(app)`) from the browser —
  that's for in-process SSR/tests. From Expo, use the URL form:
  `treaty<App>(API_URL, {...})`.
- Ensure `import type { App }` — never a value import — or Metro will try to
  bundle Elysia.

**References:**

- https://elysiajs.com/eden/treaty/overview
- https://elysiajs.com/eden/installation (type-only import pattern)
- Monorepo api-client package pattern: proven in many Elysia + RN/Expo
  workspaces (user has first-hand experience — trust the pattern)

### Phase 2 — Restore deleted tests (scope-reduced)

**Revised scope (per simplicity review): restore only the auth-middleware
tests.** These guard the one thing a framework swap actually endangers —
authN/authZ posture. Service tests test business logic the migration didn't
touch; restoring them in this PR mixes "finish migration" with "backfill test
debt" and is explicitly out of scope.

**Restore (in this PR):**

- `middleware/__tests__/auth.test.ts` — JWT verify, 401 on missing token, scope checks
- `middleware/__tests__/adminMiddleware.test.ts` — non-admin → 403
- `middleware/__tests__/apiKeyAuth.test.ts` — header parsing, invalid key → 401

**Defer to a follow-up "restore API test coverage" PR:**

- `services/__tests__/catalogService.test.ts` (−228 LOC)
- `services/__tests__/imageDetectionService.test.ts` (−382 LOC)
- `services/__tests__/weatherService.test.ts` (−160 LOC)
- `utils/__tests__/openapi.test.ts` (−125 LOC)

Coverage threshold was lowered in `4c2c00d1`. **Leave it lowered** in this PR
and restore it in the follow-up test-restoration PR — re-raising now would
block merge on tests we're explicitly not restoring.

### Research Insights: Phase 2 Testing

**Canonical Elysia-on-Workers test pattern** (from 2026 docs):

```ts
// packages/api/src/middleware/__tests__/auth.test.ts (sketch)
import { describe, expect, it } from 'vitest';
import { Elysia } from 'elysia';
import { authPlugin } from '../auth';

describe('authPlugin', () => {
  const app = new Elysia().use(authPlugin).get('/me', ({ user }) => user);

  it('401 on missing token', async () => {
    const res = await app.handle(new Request('http://x/me'));
    expect(res.status).toBe(401);
  });
});
```

- Use `app.handle(new Request(...))` directly — no Cloudflare pool needed
  for pure logic tests. Faster, no env bindings, no pool overhead.
- Reserve `@cloudflare/vitest-pool-workers` for tests that actually touch
  `env` bindings (D1, KV, Hyperdrive/Neon).

**Pin compatibility — RESOLVE BEFORE MERGE.** The sibling Dependabot plan
(`docs/plans/2026-04-14-chore-finalize-dependabot-consolidation-plan.md`)
pins `@cloudflare/vitest-pool-workers@0.14.3` + `workerd@1.20260310.1` +
`wrangler@4.81.1`. This PR's commit `71396ac` pins `vitest ~3.1.0` as a
workaround. **The two pin sets must be reconciled:**

- Check `packages/api/package.json` on the PR branch against the Dependabot
  plan's pin table
- If pool is 0.13+ you *must* use vitest 4 (pool 0.13 dropped vitest 2/3
  support)
- If pool is 0.14.3 (per Dependabot plan's load-bearing pin) → vitest 4.x
  required
- Whichever pin set wins after reconciliation, cross-reference against
  `docs/plans/2026-04-14-chore-finalize-dependabot-consolidation-plan.md`
  so the two PRs don't silently overwrite each other on merge

**References:**

- https://elysiajs.com/patterns/testing
- https://developers.cloudflare.com/workers/testing/vitest-integration/
- https://github.com/cloudflare/workers-sdk/issues/11064 (vitest v4 support)
- `docs/plans/2026-04-14-chore-finalize-dependabot-consolidation-plan.md` —
  load-bearing pin rationale

### Phase 3 — CI green + container smoke

- Approve CI workflows (`gh run list … action_required` → approve)
- Drive `Check Types`, `Biome Check`, `API Tests`, `Unit Tests` to green
- Smoke-test `container_src/server.ts` rewrite locally:
  `bun --cwd packages/api/container_src run start` and curl the few endpoints
  it exposes
- Local `wrangler dev` smoke: hit `/health`, `/openapi.json`, one auth route,
  one admin route, one queue-triggered route
- Confirm `packratOpenApi` output still contains every route with its schema
  (compare schema count to pre-PR baseline)

### Phase 4 — Merge prep

- **Drop commit curation** — GitHub squash-merge handles it for free (per
  simplicity review). Do not rebase 103 commits.
- Update PR description to reflect actual scope (currently says
  "fix(landing): site makeover" — wrong)
- Tag for maintainer review; reference the route-parity findings from the
  Enhancement Summary rather than a standalone audit doc

### Research Insights: Phase 3/4 CI + merge

- CI is in `action_required` — no workflow has actually run on this PR's
  current head. Approve before anything else (`gh run list --branch ...`
  then approve each). Blind planning around unknown-state CI is waste.
- `.openapi()` → `detail: { summary, tags }` migration is likely complete
  and fine; don't rewrite. Validate by fetching `/openapi.json` against the
  running worker and spot-checking 1 route per group.
- OpenAPI schema count ≥ baseline is a nice-to-have, **not a merge gate**.

## Technical Review Findings (2026-04-14)

Four reviewers ran against the deepened plan: `kieran-typescript-reviewer`,
`architecture-strategist`, `security-sentinel`, `code-simplicity-reviewer`
(round 2). Consolidated conclusions below; raw reports available on request.

### 🔴 Security — code bugs surfaced in the PR (follow-up issues filed 2026-04-14)

These are **existing code issues** on the branch. Filed as separate GitHub
issues so this PR stays focused on the framework swap; decisions on which to
fold back into #2083 vs. handle separately can be made per-issue.

- [#2162](https://github.com/PackRat-AI/PackRat/issues/2162) — API-key → forged userId:0 ADMIN (privilege confusion)
- [#2163](https://github.com/PackRat-AI/PackRat/issues/2163) — non-constant-time compares (API key + admin password)
- [#2164](https://github.com/PackRat-AI/PackRat/issues/2164) — VALIDATION handler leaks received input values
- [#2165](https://github.com/PackRat-AI/PackRat/issues/2165) — CORS default reflect-origin too permissive
- [#2166](https://github.com/PackRat-AI/PackRat/issues/2166) — /openapi.json enumerates admin + API-key routes
- [#2167](https://github.com/PackRat-AI/PackRat/issues/2167) — refresh token rotation non-atomic + no replay detection (pre-existing)
- [#2168](https://github.com/PackRat-AI/PackRat/issues/2168) — refresh tokens stored plaintext at rest (pre-existing)
- [#2169](https://github.com/PackRat-AI/PackRat/issues/2169) — refresh retry guard uses endsWith, should be equality

Below is the original detail for reference; canonical tracking is on the
issues.

1. **API-key → forged ADMIN identity.** `packages/api/src/middleware/auth.ts:53-57`
   synthesizes `{ userId: 0, role: 'ADMIN' }` when `X-API-Key` matches
   `PACKRAT_API_KEY`. Any handler behind `isAuthenticated: true` (not
   `isAdmin`) now runs with admin posture + forged `userId: 0`. Handlers
   doing `where(eq(x.userId, user.userId))` silently touch user-0 rows.
   **Fix:** API-key path must not satisfy user-scoped routes; require a real
   service-account userId or fail closed.
2. **Non-constant-time password/API-key compares.**
   `utils/auth.ts:121` and `routes/admin/index.ts:24` use `===`. Timing-oracle
   exposure on `PACKRAT_API_KEY` and the admin basic-auth password. Use a
   constant-time compare (WebCrypto `timingSafeEqual` or length-normalized).
3. **Validation error leaks input values.** `packages/api/src/index.ts:31`
   returns `{ error: 'Validation failed', details: error.message }`. Elysia's
   VALIDATION `error.message` includes **the received value** of the failing
   field. A malformed password, JWT, or API-key bytes land in a 400 body that
   error trackers and logs may capture. **Fix:** drop `details: error.message`
   or redact to `{ path, expected }` only.
4. **Permissive CORS.** `index.ts:26` uses `app.use(cors())` with default
   config (reflect-origin). Tighten to an explicit allow-list of Expo dev URL,
   production web origin, and admin panel origin. Compare against the Hono
   baseline before merging — if Hono had a stricter list, this is a
   regression.
5. **OpenAPI enumerates admin/API-key routes unauthenticated.** `/openapi.json`
   is mounted before auth gates and has no `exclude` on admin or cron paths.
   **Fix:** pass `exclude: [/^\/api\/admin/]` (and any API-key paths) or set
   `detail: { hide: true }` per route; optionally gate `/openapi.json` behind
   basic-auth in production.
6. **Refresh token rotation is non-atomic.** `routes/auth/index.ts:397-407`
   revokes old + inserts new in two statements without a transaction.
   Concurrent refreshes across devices can admit replay. Wrap in a
   transaction AND add replay detection (on any double-use of a refresh
   token, invalidate the entire family).
7. **Refresh tokens stored plaintext.** `eq(refreshTokens.token, token)` —
   DB read leak = session takeover. Hash at rest (HMAC). Pre-existing, but
   flag as tech debt.
8. **Path check bug in client refresh guard.** `apps/expo/lib/api/client.ts:207`
   uses `!path.endsWith('/api/auth/refresh')` — works by luck. Use equality.

### 🟡 Tests — restored-test assertions must be stronger than the plan specified

The 3 middleware tests are the RIGHT files, but assertions as drafted are thin.
Required minimum:

- `auth.test.ts`: alg=none rejected; expired rejected; tampered-sig rejected;
  `...rest` claim-spread cannot forge `role`; API-key path yields user context
  that user-scoped routes **reject**
- `adminMiddleware.test.ts`: USER role → 403 on every admin path
  (route-inventory driven, not hand-listed); missing auth → 401 with
  `WWW-Authenticate`
- `apiKeyAuth.test.ts`: invalid key → 401; response body echoes no bytes of
  the provided or expected key; missing `PACKRAT_API_KEY` env → fails closed

### 🟡 TypeScript / packaging — correctness changes to Phase 1.5

1. **`devDependencies` in `@packrat/api-client` is the WRONG pattern.** In
   pnpm/bun workspaces, devDeps of a workspace package are not installed for
   consumers. Use `peerDependencies` + `peerDependenciesMeta.elysia.optional:
   true` + devDep mirror:
   ```json
   "peerDependencies": { "elysia": "*" },
   "peerDependenciesMeta": { "elysia": { "optional": true } },
   "devDependencies": { "elysia": "1.4.x", "@packrat/api": "workspace:*" }
   ```
2. **Add a dedicated `@packrat/api/client-types` subpath export** from
   `packages/api` that re-exports only `type App` from a file with ZERO value
   imports. `api-client` imports `type { App } from '@packrat/api/client-types'`.
   Defensive against Metro `unstable_enablePackageExports` resolver quirks.
3. **`packages/api-client/tsconfig.json`: set `verbatimModuleSyntax: true`.**
   Any value-level `import { Elysia }` slip becomes a compile error in CI
   before it reaches Metro. Do NOT use deprecated `importsNotUsedAsValues`.
4. **Export `type App = typeof api` BEFORE `.compile()` is called on the
   server.** `.compile()` adds wrapping that expands the type graph; export
   the pre-compile type to minimize Treaty instantiation depth (guard against
   TS 2589 "excessively deep" errors).
5. **Source-pointing `types`, not emitted `.d.ts`.** Set
   `"types": "./src/index.ts"` on both `packages/api` and
   `packages/api-client`. Avoid `tsc -b` / `composite` here — they emit
   frozen declaration files that inline Elysia's full chained builder type.
6. **Vitest pin: bump to v4 + pool 0.14.3**, matching the sibling Dependabot
   consolidation PR. Vitest 3 → 4 changed public types (`Mock`,
   `MockInstance`, `defineConfig` generic); mixed installs fail `tsc`, not
   just runtime.

### 🟡 Architecture — two boundary corrections

1. **`api-client` must be transport-only.** Auth session state
   (`pendingRefresh`, `needsReauthAtom`, `expo-sqlite/kv-store` token
   persistence) belongs in `apps/expo/lib/api/`, NOT in `@packrat/api-client`.
   Reason: `apps/guides` and `apps/landing` can't reuse the package if it
   couples to Jotai + expo-sqlite. The client package should accept an
   injected `getToken()` / `onNeedsReauth()` callback pair; each app owns its
   own session layer.
2. **Keep the grep-based parity check as a merge gate, don't drop it.** `tsc`
   on Expo only catches gaps at existing Expo callsites. Routes consumed by
   the container, `apps/guides`, `apps/landing`, or not-yet-wired hooks are
   invisible. A one-time method+path diff is cheap insurance.
3. **Container sidecar** — `packages/api/container_src/server.ts` (+103/-221)
   should NOT be a "nice-to-have smoke test." Promote to a gate: enumerate
   the container's route surface and hit each via the `AppContainer` DO
   binding (not just local bun). Framework swaps that silently change a
   sidecar's behavior are the regression class this PR is most likely to
   leak.
4. **Mega-file split is a follow-up, not in-scope here.** Commit in Phase 4 to
   file a follow-up issue for `packs/index.ts` (866 LOC), `packTemplates`
   (717), `auth` (677), `admin` (695). Idiomatic Elysia is per-resource
   plugins composed at an index.

### 🟢 Callsite migration — FULL migration is in scope (user decision, 2026-04-14)

**User confirmed: all 43+ hook callsites migrate to Treaty as part of this PR.
The legacy fetch wrapper goes away entirely.** This simplifies the package
design — no back-compat facade needed.

Revised Phase 1.5 surface for `@packrat/api-client`:

- Single export: typed `api` (Treaty instance bound to `App`)
- Auth session hooks (`getToken`, `onNeedsReauth`) injected from the consumer
  (`apps/expo`), NOT owned by `api-client` (per architecture review)
- **No** `apiClient.get/.post/...` back-compat facade
- `apps/expo/lib/api/client.ts` is either deleted or reduced to a thin module
  that constructs the Treaty client with injected token provider + refresh
  handler, then re-exports `api`

Callsite migration mapping (example):

```ts
// before
await apiClient.get<CatalogItem[]>('/api/catalog', { params: { q, limit } });

// after
const { data, error } = await api.catalog.get({ query: { q, limit } });
if (error) throw error;
return data;
```

Scope expansion: ~43 hooks across `apps/expo/features/**/hooks/*.ts` plus
anywhere else `apiClient.*` is called. Each callsite gets fully typed
request/response flow. Discovery + migration is mechanical but touches
many files — plan for it, don't underestimate.

**Reject the dual-surface facade entirely.** Kieran's type-narrowing facade
(Option B from earlier draft) is also unnecessary now — direct Treaty usage
is cleaner and what the user is willing to pay for.

### 🟢 Simplicity — consolidate the plan structure

Delete Phases 1, 3, 4 as separate sections; fold residue (CI approve,
wrangler smoke, PR description rewrite) into the Simplified 3-step path.
Keep Phase 0 GO/NO-GO (decision gate has real value). Research Insights can
live as a trailing appendix. Plan LOC shrinks ~40% without losing content.

## Simplified 3-step path (recommended alternative)

Per the simplicity reviewer — if the user wants the absolute minimum path to
merge, collapse to this:

1. **Approve CI.** `gh run list --branch claude/migrate-hono-to-elysia-F0CtM`
   → approve each pending run. Capture the real failure list.
2. **Create `packages/api-client` + restore Treaty.** Per Phase 1.5 above.
   Swap `apps/expo/lib/api/client.ts` to re-export from `@packrat/api-client`.
   Run `tsc` on expo — any failure is either a Treaty wrapper bug or a
   genuine parity gap. Fix until green.
3. **Restore the 3 middleware auth tests.** Per Phase 2 reduced scope.

If steps 1–3 pass, this PR is a drop-in. Everything else in the phased plan
above is opt-in deepening, not a merge gate.

## Acceptance Criteria (revised)

**Merge gates:**

- [ ] Phase 0 decision documented in PR thread with evidence (likely GO)
- [ ] `packages/api-client` package created; Expo consumes ONLY
      `@packrat/api-client` (no direct `@elysiajs/eden` or `elysia` in
      `apps/expo/package.json`)
- [ ] `apps/expo/lib/api/client.ts` re-exports from `@packrat/api-client`;
      43+ legacy callsites compile unchanged
- [ ] At least ONE expo hook migrated to typed Treaty usage as reference
      (suggested: `useCatalogItems.ts`)
- [ ] 3 middleware auth tests restored (`auth`, `adminMiddleware`, `apiKeyAuth`)
- [ ] All non-e2e CI checks green: `Check Types`, `Biome Check`, `API Tests`,
      `Unit Tests`
- [ ] `wrangler dev` smoke: `/`, `/health`, `/openapi.json`, 1×auth route,
      1×admin route, 1×queue path verified
- [ ] Vitest / pool-workers pins reconciled with
      `docs/plans/2026-04-14-chore-finalize-dependabot-consolidation-plan.md`
- [ ] PR description rewritten (currently wrong: "fix(landing): site makeover")
- [ ] No force-push without explicit user permission (per memory)

**Non-gates (moved to follow-ups / nice-to-have):**

- Full route parity JSON inventory (`docs/audits/...`) — replaced by
  `tsc`-based parity check
- Service test restoration (catalog, imageDetection, weather) — separate PR
- `utils/__tests__/openapi.test.ts` restoration — separate PR
- Coverage threshold re-raised to pre-PR floor — separate PR (blocked by
  service test restoration)
- `container_src/server.ts` smoke test — nice-to-have, not drop-in critical
- OpenAPI route count ≥ baseline spot-check — nice-to-have
- Commit history curation — squash-merge handles it

**Admin UI regression — DECIDED (2026-04-14):** Accept the HTMX loss. User
is refactoring the admin panel in a separate PR, so the LOC reduction in
`admin/index.ts` is not a blocker here. Core route + auth parity on all
other groups is what this PR must preserve.

## System-Wide Impact

- **Interaction graph**: Worker `fetch` → `setWorkerEnv` → Elysia `app.fetch`
  → `cors` → `packratOpenApi` → `onError` → `routes` (`/api` prefix) → group
  Elysia instance → handler → service → drizzle/Neon. Queue path: Worker
  `queue` → `processQueueBatch` or `CatalogService.handleEmbeddingsBatch`.
  Container path: separate `container_src/server.ts` Elysia instance reachable
  via `AppContainer` durable-object binding.
- **Error propagation**: Elysia's `onError` hook now centralizes handling;
  per-route `try/catch` from the Hono era may be redundant or, worse, swallowing
  errors before `onError` sees them. Audit each handler.
- **State lifecycle risks**: Auth refresh flow in `client.ts` uses module-level
  `pendingRefresh` — single in-flight refresh — confirmed intact. Queue handlers
  must remain idempotent; verify `processQueueBatch` and embeddings batch still
  ack/retry the same way.
- **API surface parity**: Three consumers of the API — expo app (43+ hooks),
  guides app, container sidecar. All three must be checked against the new
  route inventory.
- **Integration test scenarios**:
  1. Login → token issued → protected route → 401 on expiry → refresh → retry
  2. Admin-gated route returns 403 for non-admin (regressions here are the
     scariest — admin/index.ts went from 906 → 580 LOC)
  3. ETL queue message → `processQueueBatch` → catalog row inserted
  4. Image upload → presigned URL → R2 PUT → row update
  5. OpenAPI fetch returns full schema for at least 1 route per group

## Dependencies & Risks

- **Risk: PR is fundamentally misaligned with stated goal.** Highest risk —
  Phase 0 exists to surface this in 30 min, not 3 days.
- **Risk: Drift since branching.** Branch is 0 commits behind `development`
  *right now*; will need re-rebase if we take >1 day.
- **Risk: CI `action_required` masks real failures.** Until checks are
  approved we don't know what's broken.
- **Risk: Mega-`index.ts` files (700-900 LOC) make code review ineffective.**
  Consider splitting back into per-resource files post-merge, but DON'T add
  that to this PR's scope.
- **Risk: `.openapi()` metadata loss** silently degrades Scalar UI for
  consumers — needs an explicit before/after schema comparison.
- **Dependency**: User must decide GO/NO-GO at end of Phase 0 before Phase 1.5
  starts.

## Sources & References

### PR / commits

- PR: https://github.com/PackRat-AI/PackRat/pull/2083
- Critical commits:
  - `c6d8b1c0` — drop Eden Treaty from client (regresses goal)
  - `ca580151` — `any` default generic on apiClient (regresses goal)
  - `5a4de8aa` — original Treaty wiring (reference for restoration)
  - `54187d4a` — local App type alias workaround
  - `d3341d3c` — strip `.openapi()` metadata
  - `4c2c00d1` — lowered coverage threshold (must restore)

### Internal references

- API entry: `packages/api/src/index.ts:18` (Elysia app construction)
- Route aggregation: `packages/api/src/routes/index.ts:23`
- Expo client: `apps/expo/lib/api/client.ts:1`
- Container: `packages/api/container_src/server.ts`
- Worktree for this work: `~/Code/PackRat-elysia` (already created)

### Conventions

- Use `act` for local CI checks (memory: avoid GHA minute limits)
- No force-push without explicit permission (memory)
- Resolve & merge — never close PRs (memory) — but Phase 0 NO-GO is the one
  case to escalate to user before deciding
- Bun built-ins preferred over duplicating packages

### External references (load lazily via context7 if needed)

- Elysia Cloudflare adapter docs (`elysia/adapter/cloudflare-worker`)
- `@elysiajs/eden` Treaty docs
- `@elysiajs/openapi` + Zod v3 interop (`mapJsonSchema`)
