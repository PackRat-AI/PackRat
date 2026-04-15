---
title: Narrow PR #2170 spike scope — retarget base + relocate stray plan docs
type: chore
status: active
date: 2026-04-14
---

# Narrow PR #2170 spike scope

## Overview

PR #2170 (`spike/align-test-db-with-prod`) previously targeted `development` while branched off `chore/all-dependabot-updates` (#2118), which made the diff show 116 files / +2530/-1682 — everything in #2118 plus the 3 real spike commits. The base has now been re-pointed to `chore/all-dependabot-updates`, collapsing the diff to **10 files / +1077/-176**. Two stray plan docs remain in the diff; relocating them finishes the job.

## What changed from the original plan

- ~~Rebase onto `development`~~ — **dropped.** The spike genuinely depends on #2118's workerd pin / vitest-pool-workers fixes to run at all (textbook stacked-PR case per Pacheco 2025 / stacking.dev). Changing the PR target from `development` → `chore/all-dependabot-updates` is a one-click fix that achieves the same diff-narrowing without rebase, force-push, or conflict resolution. **Done.**
- ~~Move `workerd` override from root to `packages/api`~~ — **dropped.** Two reasons: (a) the override originates in #2118 (commit `3fa37830b`), not the spike, so it's not the spike's concern; (b) Bun only honors `overrides`/`resolutions` at the workspace root — nested blocks are silently ignored ([bun/6608](https://github.com/oven-sh/bun/issues/6608), [bun/14774](https://github.com/oven-sh/bun/issues/14774)). The original plan's proposed move would have silently regressed the pin. Leave at root.
- ~~Cherry-pick `…-finalize-dependabot-consolidation-plan.md` onto #2118~~ — **kept, expanded.** Two plan docs need relocation, not one.

## Remaining problem

The narrowed 10-file diff still contains two plan documents that belong on #2118, not the spike:

- `docs/plans/2026-04-14-chore-finalize-dependabot-consolidation-plan.md` — the plan for #2118 itself.
- `docs/plans/2026-04-14-feat-finish-elysia-migration-pr-2083-plan.md` — unrelated to both the spike and #2118.

The repo convention (see `2026-03-14-feat-dual-mode-local-and-cloudflare-iceberg-plan.md` already on `development`) is that plan docs live on the branch that enacts their work and accumulate on `development` as durable project memory. Neither doc's natural home is the spike branch.

## Proposed solution

1. **Move `2026-04-14-chore-finalize-dependabot-consolidation-plan.md` onto `chore/all-dependabot-updates`.** It's the plan for that PR.
2. **Decide where `2026-04-14-feat-finish-elysia-migration-pr-2083-plan.md` belongs** (PR #2083 presumably) and move it there, or to `development` via a trivial PR if #2083 is closed.
3. **Drop both from the spike branch** via `git rm` + commit, OR let them fall out naturally when #2118 merges them first and the spike rebases on updated #2118.

## Acceptance criteria

- [ ] `gh pr view 2170 --json files --jq '.files[].path'` returns only the 8 spike-surface files (no `docs/plans/*`).
- [ ] The consolidation plan doc lives on `chore/all-dependabot-updates` (confirmed via `git log chore/all-dependabot-updates -- docs/plans/2026-04-14-chore-finalize-dependabot-consolidation-plan.md`).
- [ ] The Elysia-migration plan doc has an appropriate home (PR #2083 branch, or `development`).
- [ ] api-tests CI job produces an interpretable signal on the narrowed spike.

## Implementation steps

```bash
# From the spike worktree
cd /Volumes/CrucialX10/andrewbierman/Code/PackRat-2170

# 1. Capture the plan docs
git show HEAD:docs/plans/2026-04-14-chore-finalize-dependabot-consolidation-plan.md \
  > /tmp/consolidation-plan.md
git show HEAD:docs/plans/2026-04-14-feat-finish-elysia-migration-pr-2083-plan.md \
  > /tmp/elysia-plan.md

# 2. Remove from spike
git rm docs/plans/2026-04-14-chore-finalize-dependabot-consolidation-plan.md \
       docs/plans/2026-04-14-feat-finish-elysia-migration-pr-2083-plan.md
git commit -m "chore: relocate plan docs to their owning branches"

# 3. Add to #2118
cd ~/Code/PackRat  # already on chore/all-dependabot-updates
cp /tmp/consolidation-plan.md docs/plans/2026-04-14-chore-finalize-dependabot-consolidation-plan.md
git add docs/plans/2026-04-14-chore-finalize-dependabot-consolidation-plan.md
git commit -m "docs: add consolidation plan for #2118"

# 4. Elysia plan — put where #2083 lives, or propose a tiny PR to development
# (needs confirmation which PR/branch)

# 5. Push — fast-forward, no force needed
git push origin spike/align-test-db-with-prod
cd ~/Code/PackRat && git push origin chore/all-dependabot-updates
```

## Out of scope

- **Root `tsconfig.json` rewrite** (inlined Expo preset options). Originates in #2118; belongs on #2118's review, not the spike.
- **Root `overrides: { workerd }`** placement. Same — #2118's concern, and Bun only honors it at root anyway.
- **Wider tsconfig refactor** (fixing `packages/api/tsconfig.json`'s missing `lib`/`target`, deleting unused `tsconfig.base.json`). Separate plan.

## Follow-up: prevent recurrence

Root cause of the original contamination was the absence of a rule about where spike branches should branch from. Proposed (separate task, not this plan's scope):

- **Lefthook pre-push check** (`lefthook.yml` exists) that warns when pushing a branch whose merge-base with `origin/development` is not on `development` — unless the branch name starts with `spike/stacked/` or the last commit message contains `Stacked-on: #NNNN`.
- **CLAUDE.md "Branching" rule**: "Spike branches branch from `development` unless the spike explicitly tests an in-flight PR's hypothesis, in which case it targets that PR's branch and declares `Stacked-on: #NNNN` in the PR description."

## Sources & references

- PR #2170 — https://github.com/PackRat-AI/PackRat/pull/2170 (target now: `chore/all-dependabot-updates`)
- PR #2118 — https://github.com/PackRat-AI/PackRat/pull/2118
- `docs/plans/2026-04-14-chore-finalize-dependabot-consolidation-plan.md` — H1–H8 hack inventory, spike frames this PR as Phase 0
- Bun overrides docs — https://bun.sh/docs/install/overrides (workspace-root-only; nested ignored)
- bun#6608, bun#14774 — open issues confirming nested override limitation
- [Pacheco 2025 — stacked PRs on GitHub](https://www.davepacheco.net/blog/2025/stacked-prs-on-github/)
- [Google eng-practices — small CLs](https://google.github.io/eng-practices/review/developer/small-cls.html)
