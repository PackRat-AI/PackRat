---
title: Finalize chore/all-dependabot-updates (PR #2118) — consolidate new Dependabot PRs and audit hacks
type: chore
status: active
date: 2026-04-14
---

# Finalize `chore/all-dependabot-updates` (PR #2118)

## Overview

PR #2118 (`chore/all-dependabot-updates`) already consolidates 23 Dependabot PRs (#2088–#2117). Since it was opened, Dependabot opened **27 additional PRs (#2121–#2148)**. CI currently passes on #2118 (api-tests, check-types, biome, unit-tests all green; only E2E jobs fail, consistent with pre-existing flake).

However, the branch contains **several local hacks** introduced while chasing a `@cloudflare/vitest-pool-workers` 0.14.x + miniflare 4.20260409 + `pg-cloudflare` compatibility regression. Some of these hacks are redundant; at least one can be simplified.

This plan takes over the PR, cleans up redundant workarounds while preserving CI green, brings in the new Dependabot PRs, and verifies `expo-doctor` (source of truth for React-Native-adjacent versions) still passes.

## Problem Statement / Motivation

1. **27 new Dependabot PRs are open against `development`** and will conflict with #2118 on merge unless consolidated.
2. **The branch accreted hacks** during merge/CI stabilization (patches, a mock, a stub, overrides). Some are redundant; all should be audited so we understand which are load-bearing and which can go.
3. **Expo Doctor is the authoritative check** for React Native + Expo package version alignment (per user). `@sentry/react-native`, `react-native-maps`, and other RN-adjacent bumps must not fail `expo doctor`.
4. **No hacky tricks should ship merged** unless we understand *why* each one exists and can't be removed.

## Proposed Solution

**Lead with the root-cause spike; fall back to hack-preservation only if the spike fails.**

Reviewers (code-simplicity + architecture-strategist) converged: the Workers test pool is correct — the API is 100% Cloudflare — but the **test DB client diverges from prod**. Production uses `@neondatabase/serverless`; tests fall into a `pg` + `pg-cloudflare` branch in `packages/api/src/db/index.ts` only because test URLs aren't Neon URLs. That single divergence forces H4/H5/H6 (pg-cloudflare alias, two patches) and indirectly pressures H1/H2/H3 (the workerd/wrangler/vitest-pool-workers freeze).

### Phase 0 — Root-cause spike (throwaway branch, ~60 min timebox)

Align tests with prod by using the same driver in both:

1. Stand up a Neon-compatible HTTP/WS proxy in front of the existing Docker Postgres (`@neondatabase/serverless`'s `neon-proxy` or the open-source `neondatabase/wsproxy`).
2. Point `NEON_DATABASE_URL` in `test/setup.ts` at the proxy.
3. Remove the `isStandardPostgresUrl` branch in `packages/api/src/db/index.ts` (tests now take the same code path as prod).
4. Delete `patches/pg-cloudflare@1.3.0.patch`, `patches/pg-protocol@1.13.0.patch`, the `pg-cloudflare` wrangler alias, and `src/stubs/pg-cloudflare-stub.ts`.
5. Attempt to bump `@cloudflare/vitest-pool-workers` and unpin `workerd` + `wrangler`.
6. Independently, bump `@hono/sentry` past `^1.2.2` (recent versions dropped toucan-js for `@sentry/cloudflare`, likely dropping H7).

**Spike success criteria:** `bun test:api:unit` and integration tests pass with H4/H5/H6 deleted and (stretch) H1/H2/H3/H7 also deleted.

**If spike succeeds →** fold the changes into `chore/all-dependabot-updates` as the first commit, then proceed to consolidation.

**If spike fails →** keep the current pins, document each with a one-line comment + exit criterion ("revisit when vitest-pool-workers ≥ 0.15 ships"), and proceed to consolidation with hacks intact.

### Phase 1 — Consolidate remaining Dependabot PRs

Apply the additive subset (#2121, #2123–#2125, #2129, #2130, #2132–#2143) per the disposition table below. Skip PRs whose versions are already equal-or-newer on this branch and mark them for auto-close after merge.

### Phase 2 — Verification & merge prep

Run `expo doctor` (source of truth for RN), `bun check-types`, `bun check` (Biome), `bun test:api:unit`, `bun test:expo`, `bunx expo-doctor`. Push (no force). Confirm CI. Update PR body. Hand back.

## Current state snapshot (2026-04-14)

Local: `~/Code/PackRat`, branch `chore/all-dependabot-updates`, 254 commits ahead of `development`, merge base recent, `MERGEABLE=true`.

CI on #2118 (latest run): `api-tests` ✅ · `check-types` ✅ · `biome` ✅ · `Expo Unit Tests` ✅ · `API Unit Tests` ✅ · Cloudflare Pages previews ✅ · Android/iOS E2E ❌ (pre-existing, not blocking).

## Hacks inventory (confirmed)

| # | Artifact | Location | Status |
|---|---|---|---|
| H1 | `workerd` pinned to `1.20260310.1` | root `package.json` `overrides` | **Load-bearing** — required for `vitest-pool-workers@0.14.3` + miniflare combo. Document, keep. |
| H2 | `wrangler` pinned to `4.81.1` | `packages/api/package.json` | **Load-bearing** — locks workerd transitive to compatible version. Document, keep. |
| H3 | `@cloudflare/vitest-pool-workers` pinned to `0.14.3` | `packages/api/package.json` | **Load-bearing** — newer versions reopen the pg-cloudflare bug. Document, keep. |
| H4 | `packages/api/src/stubs/pg-cloudflare-stub.ts` + wrangler `alias` `"pg-cloudflare"` → stub | `packages/api/src/stubs/`, `packages/api/wrangler.jsonc:189-194` | **Load-bearing** — replaces `cloudflare:sockets`-based `pg-cloudflare` with `node:net` socket for local test Postgres. This is the canonical fix; keep as the *single* mechanism. |
| H5 | `patches/pg-cloudflare@1.3.0.patch` (rewrites `dist/empty.js`) | `patches/` | **Likely redundant with H4** — wrangler alias already replaces the import at build time. Attempt to remove; if api-tests fail, restore. |
| H6 | `patches/pg-protocol@1.13.0.patch` (strips ESM export condition) | `patches/` | **Suspect** — original rationale was miniflare resolving ESM unexpectedly. With H3 pinned, may no longer be needed. Attempt to remove; if tests fail, restore with inline comment. |
| H7 | `vi.mock('@hono/sentry', …)` | `packages/api/test/setup.ts:419-438` | **Load-bearing** — documented CJS/ESM dual-export bug in `toucan-js@4.1.1` → `@sentry/core@8.9.2`. Keep. Verify upstream fix candidate: bumping `@hono/sentry` or `toucan-js` may let us drop this. Track as follow-up, do not block. |
| H8 | `vi.mock('youtube-transcript', …)` | `packages/api/test/setup.ts` | **Load-bearing** — workerd 1.20260409.1 chokes on package internals. Keep, comment already explains. |

**Audit outcome:** attempt to remove H5 and H6 only. Everything else stays, with improved inline comments linking to upstream issues (one line each, no docstrings).

## New Dependabot PRs (#2121–#2148) — disposition

Superseded by versions already on the branch (close after merge, do **not** re-apply):
- #2122 `@vitest/coverage-v8` 4.1.4 (apps/expo) — already
- #2126 expo-sdk group — already merged
- #2127 drizzle group — already merged
- #2128 `vitest` 4.1.4 (root) — already
- #2144 `@ai-sdk/google` 3.0.62 — already
- #2145 `drizzle-kit` 0.31.10 — already
- #2146 `@scalar/hono-api-reference` 0.10.7 — already
- #2147 `vitest` 4.1.4 (packages/api) — already
- #2148 `@ai-sdk/perplexity` 3.0.29 — already

To apply to this branch (grouped for a single install + typecheck cycle):

**React-Native / Expo-adjacent (verify with `expo doctor` after):**
- #2123 `@sentry/react-native` 7.2.0 → 8.7.0 *(major)*
- #2125 / #2129 `react-native-maps` 1.20.1 → 1.27.2 *(major)* — apply to `apps/expo` only if expo-doctor approves; otherwise pin to last doctor-approved version and leave a comment. If doctor disapproves both current and target, **follow doctor's recommended version** regardless of Dependabot's number.

**Lint tooling (expected fallout: ESLint config breakage, since these are ESLint v8 → v10 jumps):**
- #2121 / #2130 `eslint-config-universe` 12.1.0 → 15.0.3 *(major)*
- #2124 `eslint` 8.57.1 → 10.2.0 *(major)*

*Decision gate:* If `eslint` v10 + `eslint-config-universe` v15 require flat-config migration and the repo still uses `.eslintrc*`, **defer all three** to a dedicated follow-up PR. Note rationale in PR body; do not block this PR on an ESLint 9 flat-config migration.

**Web apps (lower risk — guides/landing):**
- #2132 / #2137 `sonner` 1.7.4 → 2.0.7 *(major)* — verify no breaking API in toast usage
- #2134 `@types/react` 19.0.14 → 19.2.14 (landing)
- #2136 / #2142 `cmdk` 1.0.4 → 1.1.1
- #2138 `postcss-import` 15.1.0 → 16.1.1 *(major)*
- #2139 `lucide-react` 0.454.0 → 1.8.0 *(MAJOR, 0.x → 1.x)* — icon names may rename; typecheck both guides + landing
- #2140 `react-day-picker` 8.10.1 → 9.14.0 *(major)* — API rename; check usage in landing
- #2141 `recharts` 2.15.0 → 3.8.1 (guides) *(major, already bumped in expo branch to 3.8.1; align)*
- #2143 `react-resizable-panels` 2.1.9 → 4.10.0 *(MAJOR skip)*

**CI action bumps (low risk):**
- #2133 `actions/github-script` v7 → v9
- #2135 `actions/setup-java` v4 → v5

## Technical Considerations

- **Install must succeed first.** If any new version combination breaks `bun install`, revert that single bump and log it.
- **Do not edit `bun.lock` by hand.** Let `bun install` regenerate.
- **Respect `"catalog"` in root `package.json`.** Some packages (react, tailwind, zod, typescript) are catalog-managed — bumps must go through catalog.
- **Respect user feedback memories:** no `.js` extensions in TS imports, no Proof uploads, no force-push, don't close PRs — merge-or-supersede.
- **Expo Doctor is authoritative:** any conflict between Dependabot's suggested version and `expo doctor`'s recommendation → follow doctor.
- **Biome 2.4.6 line width 100 + single quotes.** New code and regenerated files must pass `bun check`.
- **No backwards-compat shims** — per house rules, don't leave `// TODO` placeholders, re-exports, or commented-out code.

## System-Wide Impact

- **Interaction graph:** dependency resolution → `bun.lock` regen → `preinstall` (`configure-deps.ts` pulls `PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN` via `gh auth token`) → `postinstall` (lefthook install + env script) → workspace symlinks materialize.
- **Error propagation:** a bad lock entry surfaces as a workspace-wide resolution error on first `bun install`, not at test time. Failures at typecheck indicate API breakage from a major bump.
- **State lifecycle risks:** patch files are applied at install time; if `patches/pg-*.patch` is removed from disk **without** being removed from `bun.lock`, bun will fail noisily (good). Remove patch file + run install in one step.
- **API surface parity:** `@sentry/react-native` major bump may change the `init()` signature; audit `apps/expo/app/_layout.tsx` (or wherever Sentry inits) before pushing.
- **Integration test scenarios:**
  1. `bun test:api:unit` still passes with wrangler alias still in place after patches removed.
  2. `bun run test:expo` passes with `@sentry/react-native` v8.
  3. `bunx expo-doctor` passes (all 17 checks) in `apps/expo`.
  4. `bun check-types` clean across monorepo.
  5. Cloudflare Pages previews for both `packrat-guides` and `packrat-landing` deploy successfully.

## Acceptance Criteria

Code/dep state:
- [ ] `patches/pg-protocol@1.13.0.patch` removed if tests still pass without it; otherwise restored with a one-line comment explaining why it stays.
- [ ] `patches/pg-cloudflare@1.3.0.patch` removed if wrangler alias alone is sufficient; otherwise restored with a one-line comment.
- [ ] Remaining hacks (H1–H4, H7, H8) each have ≤1-line comment explaining *why* (if missing).
- [ ] Applicable new Dependabot versions (#2121–#2143 subset per disposition above) applied.
- [ ] `bun.lock` regenerated cleanly via `bun install` (not hand-edited).
- [ ] Root `package.json` `overrides` unchanged except where intentional.

Verification:
- [ ] `bun install` completes without warnings beyond pre-existing.
- [ ] `bun check-types` clean.
- [ ] `bun check` (Biome) clean.
- [ ] `bun test:api:unit` passes.
- [ ] `bun test:expo` passes.
- [ ] `cd apps/expo && bunx expo-doctor` passes all 17 checks.
- [ ] GitHub Actions on pushed branch: `api-tests`, `check-types`, `biome`, `Expo Unit Tests`, `API Unit Tests` green.
- [ ] Cloudflare Pages previews build.
- [ ] PR #2118 body updated to reflect new highlights and the hacks-kept/hacks-removed summary.

Process:
- [ ] No PRs closed. Dependabot PRs superseded by this branch are left open; they'll auto-close when #2118 merges to `development`.
- [ ] No force-push to `origin/chore/all-dependabot-updates` without explicit user approval (per user memory).

## Execution Plan (what the implementer will do)

### Phase 1 — Hack audit
1. Confirm checkout of `chore/all-dependabot-updates` and clean tree.
2. Delete `patches/pg-protocol@1.13.0.patch`. Run `bun install && bun test:api:unit`. If pass → commit; if fail → restore and commit comment explaining why it stays.
3. Delete `patches/pg-cloudflare@1.3.0.patch`. Run `bun install && bun test:api:unit`. Same branching logic.
4. Ensure the 3 pinned versions (workerd override, wrangler 4.81.1, vitest-pool-workers 0.14.3) each have a one-line comment. Do not bump.

### Phase 2 — Consolidation
1. Apply CI action bumps (#2133, #2135) via workflow-file edits.
2. In one pass, edit `apps/guides/package.json`, `apps/landing/package.json`, `apps/expo/package.json`, `packages/api/package.json` with the target versions from the "To apply" table.
3. Run `bun install` once. If lockfile churn looks off, abort and inspect — don't mass-retry.
4. For the ESLint v10 cluster: **attempt**; if config breakage is non-trivial, revert the three ESLint lines in this commit and mention in PR body.
5. Run `cd apps/expo && bunx expo-doctor`. If `@sentry/react-native@8.7.0` or `react-native-maps@1.27.2` fails, downgrade to doctor-approved version.

### Phase 3 — Verify & push
1. `bun check-types` → `bun check` → `bun test:api:unit` → `bun test:expo` in that order.
2. Commit each logical group separately (action bumps, web-app bumps, expo bumps, patch removals) so the PR diff reads cleanly.
3. `git push origin chore/all-dependabot-updates` (no force).
4. Wait for CI, report results to user.
5. If all green, update PR body with a "Hacks kept (why) / Hacks removed" section. Hand back for merge.

## Alternative Approaches Considered

- **Close #2118 and start over from `development`.** Rejected: loses 254 commits of conflict resolution, and user memory explicitly says "don't close PRs, prefer merge."
- **Force-push a squashed version.** Rejected: user memory says no force-push without explicit permission.
- **Split into per-group PRs (ESLint, RN, web, CI).** Tempting for cleanliness but user asked to consolidate into #2118. Do the split only if the ESLint migration gets messy (then carve that off).
- **Upgrade `@cloudflare/vitest-pool-workers` past 0.14.3 to drop patches.** Rejected: earlier attempts in this branch's history (`db492cbe5`, `d33db17c2`) show newer versions reintroduce failures. Defer.

## Dependencies & Risks

**Risks:**
- `@sentry/react-native` v7 → v8 is a major: `init()` option renames possible. Audit call sites first.
- `lucide-react` 0.x → 1.x renamed some icons. Typecheck will catch; update imports.
- `react-day-picker` v8 → v9 renamed props (`DayPicker` API overhaul). Grep landing for `DayPicker` usage.
- ESLint v10 mandates flat config — may cascade into a bigger migration than fits this PR.
- `bun install` takes ~120 s; never cancel.

**Mitigations:**
- Commit per group → easy revert per group.
- Keep the three pinned deps (H1–H3) untouched.
- If any single bump costs more than ~30 min to unbreak, defer it to a follow-up issue and note in PR body.

## Sources & References

### Internal
- PR #2118 `chore: consolidate all dependabot dependency updates` — https://github.com/PackRat-AI/PackRat/pull/2118
- Hack comments:
  - `packages/api/wrangler.jsonc:189-194` (pg-cloudflare alias rationale)
  - `packages/api/test/setup.ts:419-438` (`@hono/sentry` mock rationale)
- Config touchpoints:
  - `packages/api/vitest.config.mts`, `packages/api/vitest.unit.config.ts`
  - Root `package.json` `overrides` block
  - `patches/pg-protocol@1.13.0.patch`, `patches/pg-cloudflare@1.3.0.patch`
- CLAUDE.md — monorepo conventions (catalog, path aliases, private package auth)

### Dependabot PRs to process
`#2121, #2123, #2124, #2125, #2129, #2130, #2132, #2133, #2134, #2135, #2136, #2137, #2138, #2139, #2140, #2141, #2142, #2143` (to apply)
`#2122, #2126, #2127, #2128, #2144, #2145, #2146, #2147, #2148` (auto-closeable after merge)

### External (deferred — fetch at execution time if needed via context7)
- `@sentry/react-native` v8 migration guide
- `eslint` v9 → v10 flat-config notes
- `react-day-picker` v9 migration guide
- `lucide-react` v1.0 release notes
