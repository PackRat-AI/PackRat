---
title: Narrow PR #2170 spike scope — isolate wsproxy change from #2118 carryover
type: chore
status: active
date: 2026-04-14
---

# Narrow PR #2170 spike scope — isolate wsproxy change from #2118 carryover

## Overview

PR #2170 (`spike/align-test-db-with-prod`) is described as a throwaway 3-commit spike to validate switching api-tests from `pg` + `pg-cloudflare` hacks to `@neondatabase/serverless` + a local `wsproxy`. Its real contents are 10 files. But because it is **stacked on #2118** (`chore/all-dependabot-updates`) rather than `development`, the visible diff is **116 files / +2530/-1682** — contaminated by every change in #2118 plus two cross-cutting artifacts introduced inside the spike itself. This plan narrows the PR so reviewers can evaluate the wsproxy hypothesis on its own merits and so nothing from the spike accidentally rides into `development` via #2118.

## Problem Statement / Motivation

Three distinct problems in the PR-vs-`development` diff, each needing a different fix:

1. **Stacked base, not rebased.** The PR targets `development` but was branched off `chore/all-dependabot-updates`. Every commit in #2118 (dependabot merges, ~60 one-line Expo type tweaks, `vitest.config.ts` → `.mts` rename, bun.lock ±2169 lines) shows up in the diff. Reviewers cannot distinguish the spike from its base.
2. **Spike introduced a root-level `workerd` override.** Commit `3fa37830b` added `"overrides": { "workerd": "1.20260310.1" }` to the monorepo root `package.json`. `workerd` is only consumed transitively by `packages/api` via `@cloudflare/vitest-pool-workers`. A monorepo-root override for an api-package concern is an unnecessarily blunt instrument and creates a precedent that other api-only pins will land at root.
3. **Spike committed a planning doc that belongs on #2118.** `docs/plans/2026-04-14-chore-finalize-dependabot-consolidation-plan.md` (228 lines) is the consolidation plan for #2118 itself; it landed on the spike branch because the spike is stacked on #2118. It is already tracked (per repo convention — plans ARE committed, cf. `2026-03-14-feat-dual-mode-local-and-cloudflare-iceberg-plan.md` on `development`) so this isn't a "should be gitignored" issue — it's that the plan's natural home is #2118, not the spike.

Note — what is **NOT** a #2170 problem (correction from initial review): the root `tsconfig.json` rewrite (dropping `extends: "expo/tsconfig.base"`, inlining `jsx: "react-native"`, `lib: ["DOM","ESNext"]`, `moduleResolution: "bundler"`, etc.) originates in **#2118**, not the spike. The spike commits (`c6719706a`, `de4b69147`, `18a33263b`) do not touch `tsconfig.json`. That concern belongs on #2118's review and is scoped out of this plan. See **Out of scope** below.

## Proposed Solution

Three surgical changes, in order:

1. **Rebase `spike/align-test-db-with-prod` onto `development`** (not `chore/all-dependabot-updates`). Resolves the stacked-base diff. Spike shrinks from 116 files to ~10.
2. **Move the `workerd` override from root `package.json` to `packages/api/package.json`** as a `resolutions` field (Bun honors both `overrides` and `resolutions`; `resolutions` is the workspace-scoped idiom and is already used elsewhere in the tree for api-only pins). Delete the root `overrides` block.
3. **Move `docs/plans/2026-04-14-chore-finalize-dependabot-consolidation-plan.md` off the spike.** Either (a) cherry-pick it onto `chore/all-dependabot-updates` and drop from the spike, or (b) accept it on `development` first via a trivial PR, then drop from the spike on rebase. Prefer (a) — it keeps the plan co-located with its PR.

After the cleanup, PR #2170 should show exactly the 10 files the description promises:

```
.github/workflows/api-tests.yml           (trigger only)
packages/api/docker-compose.test.yml      (wsproxy service)
packages/api/package.json                 (workerd resolution moves here)
packages/api/src/db/index.ts              (drop isStandardPostgresUrl branch)
packages/api/src/stubs/pg-cloudflare-stub.ts (delete)
packages/api/test/setup.ts                (neonConfig.wsProxy, drop pg.Client)
packages/api/wrangler.jsonc               (drop alias)
patches/pg-cloudflare@1.3.0.patch         (delete)
patches/pg-protocol@1.13.0.patch          (delete)
package.json                              (drop root override)
```

## Technical Considerations

- **Rebase conflict surface.** The spike's `packages/api/test/setup.ts` and `packages/api/src/db/index.ts` will conflict with #2118's test-setup mocks (pg-cloudflare stub, `@hono/sentry` mock). This is the *point* — the spike wants to prove those mocks can go away. Resolution strategy during rebase onto `development`: take spike-side for `test/setup.ts` and `src/db/index.ts`; drop `src/stubs/pg-cloudflare-stub.ts` and both `patches/pg-*.patch` entirely; preserve only `@hono/sentry` and `youtube-transcript` mocks on the `test/setup.ts` (per H7/H8 in the consolidation plan — those are load-bearing for reasons unrelated to pg-cloudflare).
- **workerd resolution placement.** `packages/api/package.json` currently has no `resolutions`/`overrides` block. Add one. Verify with `bun install && bun why workerd` that the pin still applies.
- **Rebase vs force-push.** Per user preference (memory: `feedback_no_force_push.md`), force-pushing the rebased spike branch requires explicit user approval. The rebase should be executed locally, verified, then pushed with explicit confirmation.
- **Does #2118 need to merge first?** No. The spike can sit on `development` independent of #2118 — that's the whole value of rebasing. If the spike goes green, *that* result is what informs #2118's scope (removes H5/H6 pg-cloudflare patches per the consolidation plan's hack inventory).

## System-Wide Impact

- **Interaction graph:** api-tests CI job runs `bun vitest --pool @cloudflare/vitest-pool-workers` against `wrangler.jsonc`. wsproxy spin-up happens in `docker-compose.test.yml` (new service) before vitest. Test code connects via `neonConfig.wsProxy` pointed at `localhost:5434`.
- **Error propagation:** If wsproxy fails to start, api-tests fail at connection time with a wsproxy-specific error (distinct from prior pg-cloudflare errors) — easier to diagnose than the current workerd ESM resolution errors.
- **State lifecycle risks:** None new. Test DB still truncated between tests via existing `tablesToClean` mechanism.
- **API surface parity:** Prod already uses `@neondatabase/serverless`; this change **removes** the test-vs-prod divergence that necessitated H1–H6 in the first place.
- **Integration test scenarios:**
  1. api-tests job green on rebased spike → confirms wsproxy+neon-serverless path works, unblocks H5/H6 patch deletion on #2118.
  2. api-tests job red with a wsproxy-only error → spike invalidated cleanly; revert.
  3. api-tests job red with a workerd version error → H1/H2/H3 pins still load-bearing independent of pg-cloudflare; document and keep.

## Acceptance Criteria

- [ ] `git log origin/development..spike/align-test-db-with-prod` shows exactly 3 commits (the spike commits `c6719706a`, `de4b69147`, `18a33263b`, possibly with new SHAs after rebase).
- [ ] `gh pr diff 2170 --name-only | wc -l` reports ≤ 11 files.
- [ ] Root `package.json` on the spike branch contains no `overrides` block.
- [ ] `packages/api/package.json` on the spike branch contains `"resolutions": { "workerd": "1.20260310.1" }` (or equivalent) and `bun why workerd` confirms the pin applies.
- [ ] `docs/plans/2026-04-14-chore-finalize-dependabot-consolidation-plan.md` is **not** in the spike diff; it lives on `chore/all-dependabot-updates` instead.
- [ ] api-tests CI job runs on the rebased spike and produces a clean pass/fail signal (not pg-cloudflare-related errors).
- [ ] No force-push to `origin/spike/align-test-db-with-prod` happens without explicit user confirmation (may require `--force-with-lease` after user approval).

## Success Metrics

- Diff size: 116 files → ≤ 11 files; +2530/-1682 → ~+200/-400 (rough estimate, dominated by patch/stub deletions).
- Reviewer time-to-sign-off drops because the diff is scannable in one sitting.
- CI signal attributable: a green api-tests job on the spike is directly interpretable as "wsproxy+neon-serverless hypothesis validated," rather than confounded by #2118's dependabot churn.

## Dependencies & Risks

- **Depends on:** #2118 remaining open (so the consolidation plan can be moved onto it without another detour). Currently open per research.
- **Risk — rebase produces different CI result than stacked version.** Possible if a #2118 change is load-bearing for the spike's green signal. Mitigation: if rebased spike fails for non-pg-cloudflare reasons, capture the error, re-stack on #2118, and document the dependency in the spike's PR description instead of hiding it in a 116-file diff.
- **Risk — `bun resolutions` vs `overrides` semantics differ.** Bun treats them nearly equivalently but worker-pool consumers of workerd may resolve differently from workspace vs root. Mitigation: `bun why workerd` + a dry-run CI pass before marking acceptance criteria met.
- **Risk — user objects to force-push.** Non-negotiable per memory; requires explicit approval with `--force-with-lease`.

## Out of scope

- **Root `tsconfig.json` inlining of Expo base options.** This originates in #2118 and needs to be addressed in that PR's review (recommend: split root tsconfig into a lean root + `apps/expo/tsconfig.json` extending the expo base locally; verify `packages/api` and `apps/guides`/`apps/landing` each have self-sufficient configs). Tracked separately; do not conflate with #2170 cleanup.
- Any wider tsconfig refactor (fixing `packages/api/tsconfig.json`'s missing `lib`/`target`, deleting the unused `tsconfig.base.json`). Belongs in its own plan.
- Removing H7 (`@hono/sentry`) and H8 (`youtube-transcript`) mocks — per consolidation plan, these are load-bearing for reasons unrelated to pg-cloudflare.

## Implementation steps

1. **Create a rebase worktree.** From the existing `/Volumes/CrucialX10/andrewbierman/Code/PackRat-2170` (branch `pr-2170-review`) or a fresh worktree on `spike/align-test-db-with-prod`, run `git rebase --onto origin/development <SHA-before-spike-commits> spike/align-test-db-with-prod`. The "SHA-before-spike-commits" is the parent of `c6719706a` (`4e5e6728c`'s parent, on `chore/all-dependabot-updates`'s tip before the spike).
2. **Resolve conflicts** per "Technical Considerations" above. Drop `docs/plans/2026-04-14-chore-finalize-dependabot-consolidation-plan.md` from the rebased branch (it will conflict-appear as net-new; discard).
3. **Edit `packages/api/package.json`** to add `"resolutions": { "workerd": "1.20260310.1" }` and remove the block from root `package.json`. Run `bun install` and `bun why workerd` to confirm.
4. **Cherry-pick the consolidation plan onto #2118.** `git checkout chore/all-dependabot-updates && git cherry-pick <SHA-of-plan-doc-addition>` (or just `git show <spike-plan-commit> -- docs/plans/… | git apply`). Push #2118 update.
5. **Ask user before force-push.** Confirm `--force-with-lease` on `spike/align-test-db-with-prod`.
6. **Trigger CI** on the rebased PR. Watch api-tests job. Interpret per Acceptance Criteria.

## Sources & References

### Internal references

- `/Users/andrewbierman/Code/PackRat/docs/plans/2026-04-14-chore-finalize-dependabot-consolidation-plan.md` — H1–H8 hack inventory, lines 62–74; this spike directly tests the hypothesis that H4/H5/H6 can be removed.
- `/Users/andrewbierman/Code/PackRat/CLAUDE.md:126-135` — root tsconfig path-alias convention (relevant to Out of Scope discussion).
- `packages/api/package.json` (main) — current api deps, shows no existing `resolutions` block.
- `packages/api/docker-compose.test.yml` (spike) — the new wsproxy service at `ghcr.io/neondatabase/wsproxy:latest` forwarding to `postgres-test:5432`, exposed on `:5434`.
- `.github/PULL_REQUEST_TEMPLATE.md` — standard pre-merge checklist (bun format/lint/check-types).

### External references

- Bun `overrides` vs `resolutions` semantics — https://bun.sh/docs/install/overrides
- Neon wsproxy image — https://github.com/neondatabase/wsproxy
- `@neondatabase/serverless` `neonConfig.wsProxy` API — https://github.com/neondatabase/serverless

### Related work

- PR #2170 — https://github.com/PackRat-AI/PackRat/pull/2170 (this spike)
- PR #2118 — https://github.com/PackRat-AI/PackRat/pull/2118 (the base this spike is stacked on; the consolidation plan lives here after step 4)
- Memory: `feedback_no_force_push.md` — force-push requires explicit user permission
- Memory: `feedback_no_close_prs.md` — prefer rebase+merge over closing
