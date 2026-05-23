---
type: plan
status: active
plan_type: chore
title: Coverage ratchet and assertion-strength gates
created: 2026-05-19
worktree: .worktrees/chore/ramp-test-coverage
branch: chore/ramp-test-coverage
supersedes: docs/plans/2026-05-17-001-chore-test-coverage-ramp-and-ci-gate-plan.md
---

# chore: Coverage ratchet and assertion-strength gates

## Summary

A 2026-05-17 plan proposed a 9-unit, 4-phase ramp toward 95%+ coverage across the monorepo with a CI gate that blocks regressions. While that plan was being written, upstream `main` independently landed the threshold ramp itself — Vitest configs across `packages/api`, `apps/expo`, `packages/analytics`, `packages/mcp`, and `packages/overpass` now sit at 95/92/97/95 (or close), with refined exclude lists and added unit tests for middleware, image utils, and storage. **U2 of the original plan is therefore obsoleted by upstream.**

What remains novel and ship-ready is the *enforcement* layer the original plan introduced:

- **U6** — a coverage **ratchet** (`scripts/lint/coverage-ratchet.ts` + committed `coverage-baselines.json`) that fails CI if any tracked workspace drops below its baseline. Complements Vitest's per-config thresholds: thresholds enforce the floor, the ratchet enforces no-regression toward the tier target.
- **U9** — an **assertion-strength lint** (`scripts/lint/no-weak-assertions.ts`) that catches coverage theater patterns (assertion-free tests, bare `.toBeDefined()`, bare `.toHaveBeenCalled()`, oversized snapshots).
- **U1** — migrate the testing guide off the repo root (`TESTING.md` → `docs/testing.md`, per the "no random md in root" convention) and rewrite around the ratchet + lint, not the obsolete tier ramp.

Future phases (consolidated coverage workflow / Stryker mutation testing / per-workspace backfills for the still-untested packages) are deferred to follow-up plans.

---

## Problem Frame

PackRat's Vitest configs now declare strict per-package coverage thresholds (largely 95%+), but the surrounding enforcement is thin:

1. **No regression gate.** Vitest's `thresholds` block fails the build when a single config's run drops below its declared floor. There is nothing that fails CI when an existing workspace silently slides from 95% to 89% if the threshold is lowered as a "temporary unblock" — exactly the pattern the Elysia migration's PR-2083 history shows (`4c2c00d19 fix(ci): separate API type-check, lower coverage threshold`). A floor that can be edited by the same PR that drops below it is not a gate.
2. **No quality gate beyond line counts.** Coverage rewards *executing* code, not *asserting* on it. The standing failure mode is `expect(x).toBeDefined()` after a parse, or `expect(spy).toHaveBeenCalled()` without arg matching — both fully covered, both regression-blind.
3. **Doc hygiene.** `TESTING.md` lives at the repo root alongside `CLAUDE.md` and `README.md`. The repo convention is that only those last two belong at root; everything else goes under `docs/`. The testing guide itself was already out of date relative to upstream's threshold ramp.

This plan adds the missing gates and the missing doc move. It does **not** lower or rewrite any existing Vitest threshold.

---

## Scope Boundaries

### In scope

- A `scripts/lint/coverage-ratchet.ts` enforcement script + `scripts/lint/coverage-baseline-update.ts` (CI-only baseline bump) + committed `coverage-baselines.json` at the repo root.
- `bun check:coverage` / `bun check:coverage:update` package.json scripts.
- A unit test suite for the ratchet at `scripts/lint/__tests__/coverage-ratchet.test.ts`.
- `scripts/lint/no-weak-assertions.ts` and its unit test suite at `scripts/lint/__tests__/no-weak-assertions.test.ts`.
- `bun lint:weak-assertions` script and a `scripts/vitest.config.ts` for the scripts test suite.
- Migrating `TESTING.md` to `docs/testing.md` with content rewritten around current reality (upstream's 95%+ thresholds plus the new ratchet + lint).

### Deferred to follow-up work

- **Consolidated `.github/workflows/coverage.yml` matrix workflow** that runs every Tier A/B/C workspace, posts per-workspace PR comments, and invokes the ratchet. Out of scope for this PR — easier to land on top of the ratchet once the gate is in place. Tracked separately.
- **Stryker mutation testing** on `packages/api/src/{services,middleware,utils}/**` and the nightly workflow. Follow-up.
- **Backfilling tests in currently-untested workspaces** (`apps/{admin,trails,web}`, `packages/{guards,env,app,cli,checks,config,osm-db,osm-import,web-ui,api-client,ui}`). Some of these gained tests via upstream's work; the rest are a separate effort.
- **Wiring `bun lint:weak-assertions` into `scripts/check-all.ts`** as a blocking check. The lint currently surfaces a handful of real findings against the upstream codebase (mostly in `packages/analytics`); wiring into the gate requires a small cleanup PR first.

### Out of scope

- Lowering or rewriting any Vitest threshold upstream put in place.
- Adding Codecov / Coveralls integration.
- E2E / visual-regression / mutation testing.

---

## Requirements

| ID | Requirement |
|---|---|
| R1 | `coverage-baselines.json` lives at the repo root and records, per tracked workspace: `summaryPath`, four-metric baseline, and `recordedAt`. Updates happen via the baseline-update script on green merges to `main` — never manually edited in feature PRs. |
| R2 | `scripts/lint/coverage-ratchet.ts` exits non-zero on any metric dropping below the baseline (modulo `_epsilon` to absorb v8 jitter), on a missing summary file, or on a malformed summary. |
| R3 | The ratchet's analysis logic is testable in isolation. `scripts/lint/__tests__/coverage-ratchet.test.ts` covers happy path, regressions, missing summaries, malformed summaries, multi-metric regressions, and baseline parsing. |
| R4 | `scripts/lint/no-weak-assertions.ts` flags the four documented coverage-theater patterns (assertion-free tests, `only-tobedefined`, `bare-tohavebeencalled`, `large-snapshot`) and respects a file-level `// no-weak-assertions: disable` escape hatch. |
| R5 | The lint's analysis logic is testable. `scripts/lint/__tests__/no-weak-assertions.test.ts` covers each rule's positive/negative cases, the disable comment, expect-helper detection, and multi-violation files. |
| R6 | `bun check:coverage` runs the ratchet. `bun check:coverage:update` runs the baseline-update script. `bun lint:weak-assertions` runs the assertion lint. `bun test:scripts` runs both unit suites. |
| R7 | `TESTING.md` no longer exists at the repo root. `docs/testing.md` is the single canonical testing guide. `CLAUDE.md`, `README.md`, `copilot-instructions.md`, and any solutions doc that linked to the old path point to the new one. |
| R8 | Baselines for U6 are captured from real coverage runs against current upstream configs (not from the obsolete numbers in the superseded plan). |

---

## Key Technical Decisions

| Decision | Choice | Why |
|---|---|---|
| Threshold authority | **Keep upstream's existing Vitest thresholds; do not touch them.** The ratchet adds a second layer of enforcement on top. | Upstream already ramped to 95%+. Touching their numbers reopens decisions that were settled in PRs the merged into `main` between 2026-05-17 and 2026-05-19. |
| Ratchet implementation | **In-repo Bun script + committed `coverage-baselines.json`** | No external service, no new secrets, zero dependencies beyond the test runs that already happen. Mirrors `scripts/lint/no-duplicate-deps.ts` shape. |
| Baseline update flow | **CI-only on `main` post-merge** | Auto-commit baseline bumps after green runs so the floor only moves up. PRs cannot edit `coverage-baselines.json` to silently lower the gate. |
| Epsilon | **0.5 percentage points** | V8 coverage instrumentation has small run-to-run variance on identical code (observed ~0.16% on `packages/analytics` functions metric). Epsilon absorbs this without making the gate meaningless. |
| Assertion-strength rule strictness | **Flag only genuinely weak matchers** (`toBeDefined`, `toBeTruthy`, `toBeFalsy`, `.not.toBe{Undefined,Null}`). `toBeUndefined()` and `toBeNull()` alone are NOT flagged — they assert specific return values. | Avoids false positives on tests that legitimately assert "this returns null". |
| Helper-assertion detection | **Any call to `expect[A-Z][A-Za-z0-9]*(` counts as an assertion** (e.g., `expectUnauthorized(res)`, `expectJsonResponse(res)`). | `packages/api/test/` uses this convention extensively. Treating helpers as black-box assertions avoids flagging them as `assertion-free-test`. |
| Lint gate enable | **Add the command, defer wiring into `check-all.ts`** | Surfaces ~handful of real findings in current upstream code. Wiring into the blocking check requires a cleanup PR first; the script ships so contributors can run it manually until then. |
| Docs location | **`docs/testing.md`** | Per the "no random md in root" convention — `CLAUDE.md` and `README.md` are the only root markdown files. |

---

## Implementation Units

### U1. Migrate `TESTING.md` → `docs/testing.md`

- **Goal:** Honor the "no random md in root" convention. Rewrite the testing guide around current reality (upstream's 95%+ thresholds + the ratchet + the lint).
- **Requirements:** R7
- **Dependencies:** none
- **Files:**
  - `TESTING.md` (delete)
  - `docs/testing.md` (new — moved + rewritten)
  - `CLAUDE.md` (update Testing section: link to new path, summarize ratchet + lint)
  - `README.md` (badge link → `/docs/testing.md`)
  - `copilot-instructions.md` (testing section: point at `docs/testing.md`, mention new scripts)
  - `docs/solutions/ui-bugs/android-textinput-keyboard-focus-loss.md` (cross-ref link)
- **Approach:** The original `TESTING.md` content remains useful for patterns. The "Test Statistics" block at the bottom is out of date; replace it with a "Coverage Tier Model" matrix reflecting upstream's actual thresholds (api/expo/analytics/mcp at ~95/92/97/95). Add new sections for the ratchet and the assertion-strength lint.
- **Test scenarios:** Test expectation: none — documentation move with no behaviour change. Verify by grep: `rg -n 'TESTING\.md' .` returns no matches outside of `docs/plans/`.
- **Verification:** `TESTING.md` does not exist at root; `docs/testing.md` opens and renders; every `TESTING.md` reference in code, docs, and configs is updated.

---

### U6. Coverage ratchet + baseline file

- **Goal:** Add the regression-blocking gate. Vitest thresholds enforce the floor in each workspace; the ratchet ensures the floor cannot quietly slide down across PRs.
- **Requirements:** R1, R2, R3, R6, R8
- **Dependencies:** none structurally; baselines must be captured from current upstream configs before commit
- **Files:**
  - `coverage-baselines.json` (new — repo root)
  - `scripts/lint/coverage-ratchet.ts` (new)
  - `scripts/lint/coverage-baseline-update.ts` (new — CI-only)
  - `scripts/lint/__tests__/coverage-ratchet.test.ts` (new — 13 scenarios)
  - `package.json` (add `check:coverage` and `check:coverage:update`)
- **Approach:**
  - Each workspace baseline carries: `summaryPath`, `tier`, four metric percentages, `recordedAt`.
  - The ratchet reads `coverage-baselines.json` and each workspace's `coverage-summary.json`, compares per-metric with epsilon 0.5, and exits 0/1.
  - Missing summary file → exit 1 ("silent skipping is exactly the regression mode this script exists to prevent").
  - Malformed summary (missing required `total` fields) → exit 1.
  - The baseline-update script bumps numbers upward when current > baseline + epsilon; never lowers. Designed for `main`-only auto-commit, not for PR-time manual updates.
  - Initial baselines captured fresh from `bun run --cwd <workspace> test:coverage` against upstream's configs.
- **Patterns to follow:** `scripts/lint/no-duplicate-deps.ts` for CLI shape; existing `scripts/lint/__tests__/` once U9 lands for the test layout.
- **Test scenarios:** Per the ratchet test file:
  - `compareWorkspace` returns `ok` / `improvement` / `regression` based on metric deltas.
  - Tolerates noise below epsilon (default 0.5).
  - Rejects drops just above epsilon.
  - Reports multiple regressions in one workspace.
  - `runRatchet` fails on missing or invalid summaries.
  - `loadBaseline` parses workspace entries, honors `_epsilon`, falls back to default, and skips malformed entries.
- **Verification:** `bun check:coverage` runs cleanly on the captured baselines; `bun test:scripts` includes the 13 ratchet tests.

---

### U9. Assertion-strength lint

- **Goal:** Catch coverage theater (assertion-free tests, weak matchers, oversized snapshots, untyped mock calls) at lint time.
- **Requirements:** R4, R5, R6
- **Dependencies:** none — cherry-picked from prior Phase 1 work
- **Files:**
  - `scripts/lint/no-weak-assertions.ts`
  - `scripts/lint/__tests__/no-weak-assertions.test.ts` (16 scenarios)
  - `scripts/vitest.config.ts` (for `bun test:scripts`)
  - `package.json` (add `lint:weak-assertions`, `test:scripts`)
- **Approach:** See Key Technical Decisions for the matcher-strictness and helper-detection rules.
- **Patterns to follow:** `scripts/lint/no-raw-typeof.ts` for shape.
- **Test scenarios:** Each of the four rules: positive case (flags), negative case (does not flag), edge cases (`it.todo`, helper assertions, disable comment, multi-violation file).
- **Verification:** `bun test:scripts` passes; `bun lint:weak-assertions` runs in under 5 seconds across the repo and surfaces only the small set of known-current findings.

---

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Captured baselines too aggressive → first PR red | Medium | Medium | Epsilon 0.5 absorbs v8 jitter. Baselines captured from clean coverage runs, not from older numbers. |
| Lint flags too many existing tests | Confirmed (handful) | Low | Lint command exists but is NOT wired into the blocking `check-all.ts` until a separate cleanup PR. File-level `// no-weak-assertions: disable` escape hatch is available for grandfathered tests if needed. |
| Baseline file becomes a merge-conflict magnet | Low | Low | Updates happen only on `main` via the post-merge auto-commit. PR-level edits to `coverage-baselines.json` are not the workflow. |
| Future Vitest threshold change diverges from baseline | Low | Medium | Both layers gate independently. Vitest threshold is per-config; ratchet is per-baseline. A drop will trip whichever has a stricter floor — that's the right behaviour. Document the dual-layer model in `docs/testing.md`. |

---

## Verification Strategy

- **U1**: `rg -n 'TESTING\.md' .` returns no matches outside `docs/plans/`. `docs/testing.md` exists and renders. `bun check` passes.
- **U6**: `bun check:coverage` exits 0 on committed baselines; intentionally tweaking a baseline number downward makes a fresh coverage run trip the ratchet. `bun test:scripts` includes 13 ratchet tests, all passing.
- **U9**: `bun test:scripts` includes 16 assertion-lint tests, all passing. `bun lint:weak-assertions` runs in under 5 seconds and produces a stable list of findings.

---

## Origin

This plan supersedes `docs/plans/2026-05-17-001-chore-test-coverage-ramp-and-ci-gate-plan.md`. That document remains in place as historical context — its U2 (threshold ramp) was made obsolete by upstream work between 2026-05-17 and 2026-05-19, while its U1/U6/U9 carry forward unchanged in intent (only the baseline numbers were re-captured against the updated configs).
