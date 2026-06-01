---
title: "refactor: Monorepo dependency policy + root overrides audit"
type: refactor
status: completed
created: 2026-05-31
origin: docs/brainstorms/2026-05-31-monorepo-dependency-policy-requirements.md
depth: standard
---

# refactor: Monorepo Dependency Policy + Root Overrides Audit

## Problem Frame

The repo runs two coexisting "shared-version" primitives — `catalog:` (used heavily) and root `overrides` (5 entries) — with no written rule for which to use when. The `overrides` block is opaque: each entry forces a version across the entire dependency tree, is invisible at the consumer site, and carries no rationale or removal condition. No one can confidently say which entries are load-bearing and which are dead weight.

This plan establishes a written **dependency policy**, applies it to remove the redundant overrides, and adds a lint so the policy can't silently rot. It deliberately **excludes** the `container_src` build strategy (deferred — see Scope Boundaries).

**Trigger:** proactive hygiene, no incident. Burden of proof is on *keeping* an opaque override, not on changing it (see origin: `docs/brainstorms/2026-05-31-monorepo-dependency-policy-requirements.md`).

---

## Verified Findings (this session, 2026-05-31)

These refine the origin doc's assumptions and are load-bearing for the units below:

- **`elysia` is already on catalog.** Root `package.json` catalog has `elysia: ^1.4.0`; `packages/api` and `packages/api-client` already declare `"elysia": "catalog:"` (incl. api-client's `peerDependencies` + `peerDependenciesMeta`). The origin's "move elysia overrides → catalog" is **already done** → the root `overrides.elysia` is now **redundant**, not a migration target.
- **`expo-sqlite` override is redundant.** `bun pm why` shows the only hard requirer is `apps/expo` at `~55.0.15`; everything else is an optional peer. Nothing to unify.
- **`@sinclair/typebox` override is redundant.** It's a direct dep in `packages/api` at `^0.34.15`; elysia's own range is `>= 0.34.0 < 1`. The direct pin resolves cleanly without the override.
- **`react` and `@packrat-ai/nativewindui` overrides are load-bearing.** React unifies the many transitive react copies (one-copy invariant); nativewindui forces a pinned fork (`2.0.3-2`) over upstream resolution. Both survive.
- **`package.json` is strict JSON — inline comments are impossible.** The origin's "rationale comment per override" must become an external **rationale registry** that a lint cross-checks.
- **`container_src` is non-workspace** (own `bun.lock`) and its `Dockerfile` installs standalone — the root overrides never reached it. Its build strategy is out of scope here.
- **Existing lint pattern to mirror:** `scripts/lint/no-duplicate-deps.ts` (`check:catalog`) is registered in `lefthook.yml`, `scripts/check-all.ts`, and `.github/workflows/checks.yml`. The new lint follows the same shape and wiring.

---

## Requirements Traceability

| Origin requirement | Addressed by |
|---|---|
| Durable dependency policy (workspace / catalog / overrides rule) | U1 |
| Every surviving override justified (reason + removal condition) | U1 (registry) + U3 (enforcement) |
| `elysia` filed under the right primitive | U2 — confirmed already on catalog; drop redundant override |
| Drop redundant overrides (typebox, expo-sqlite) | U2 |
| Enforcement so overrides don't rot (open question #4 → in scope) | U3 |
| `container_src` strategy | **Deferred** (Scope Boundaries) |
| tiktok-dl fate / compile viability | **Deferred** (Scope Boundaries) |

---

## Key Technical Decisions

**D1 — Rationale lives in a registry the lint reads, not in `package.json`.**
Because `package.json` is strict JSON, the per-override rationale + removal condition live in the policy doc (`docs/dependency-policy.md`). The registry is a **fenced structured (JSON) block** embedded in the doc — not a free-form markdown table — so the lint parses a stable, machine-defined shape rather than human prose. This avoids the markdown-table fragility a prose parser would hit: pipe characters inside a removal-condition cell, backtick-wrapped package names, trailing-pipe variance, and Biome's format-on-commit (`lefthook` runs `biome check` on staged files) reflowing the table's byte layout. The doc still presents a human-readable prose summary of each override above the block; the fenced block is the authoritative parse target. One artifact delivers the policy (Goal 1), the justification (Goal 2), and the enforcement target (Goal 3) while keeping rationale co-located with policy. Rejected alternative: a prose markdown table (fragile parse input); rejected alternative: a separate machine-only registry file (splits policy from rationale, invites drift).

**D2 — Drop `elysia`/`expo-sqlite`/`typebox` overrides; gate on a resolution-equivalence check.**
The three are redundant per Verified Findings, but an override *also* forces transitives that `catalog:` does not reach. Removal is therefore gated on a post-removal check that no duplicate/conflicting version appears in the tree (esp. transitive `elysia` via `@elysiajs/*` plugins). If a dup appears, that entry is *not* redundant after all — keep it and document it in the registry instead. This converts a blind drop into a verified one.

**D3 — The lint enforces presence + staleness, not correctness of prose.**
`check:overrides` asserts: (a) every key in root `overrides` has a registry row with non-empty reason and removal condition; (b) no registry row references an override that no longer exists (stale-entry detection). It does not judge whether the rationale is *good* — that stays a human review concern.

---

## Implementation Units

### U1. Write the dependency policy + override rationale registry

**Goal:** Produce `docs/dependency-policy.md` — the decision rule plus a rationale table for every surviving override.
**Requirements:** Durable policy; every surviving override justified.
**Dependencies:** none.
**Files:**
- `docs/dependency-policy.md` (create)

**Approach:**
- State the rule (carried from origin): code we author → **workspace**; multiple workspaces declaring the same direct dep that must agree → **`catalog:`**; a transitive/fork we must force → **`overrides`** (escape hatch only); otherwise a plain direct dep.
- Include a machine-parseable **override registry** as a fenced JSON block (per D1 — not a markdown table). Shape: an object keyed by package name, each value `{ "reason": string, "removeWhen": string }`, both non-empty. Seed it with the two survivors:
  - `react` — reason: unifies transitive react copies (one-copy invariant for RN + web + admin); removeWhen: a single transitive react is guaranteed without forcing.
  - `@packrat-ai/nativewindui` — reason: pins fork `2.0.3-2` over upstream; removeWhen: the fork merges upstream / we move off the fork.
- Above the block, write a short human-readable prose paragraph per override (same content, readable form) so the doc reads well; the fenced block is what U3 parses.
- Specify the parse contract in the doc (the block is the single fenced ```json under a fixed heading; keys are exact `overrides` package names; both fields required and non-empty) so future editors don't break the lint. This grammar is fixed here, not deferred to U3.

**Patterns to follow:** existing policy/check docs under `docs/`; the comment header style of `scripts/lint/no-duplicate-deps.ts` for describing what the registry enforces.

**Test scenarios:**
- `Test expectation: none -- documentation/registry artifact; its machine-contract is exercised by U3's lint tests (a malformed or out-of-sync JSON block fails the lint).`

**Verification:** Doc exists; the fenced JSON registry block parses as valid JSON and has entries for `react` and `@packrat-ai/nativewindui`, each with non-empty `reason` + `removeWhen`; the block is the single ```json fence under the registry heading U3 keys on.

---

### U2. Drop the three redundant root overrides (verified)

**Goal:** Remove `@sinclair/typebox`, `expo-sqlite`, and `elysia` from root `overrides`, leaving only `react` + `@packrat-ai/nativewindui`.
**Requirements:** `elysia` filed under the right primitive; drop redundant overrides.
**Dependencies:** U1 (registry must already document the survivors so the about-to-be-added U3 lint stays green; and so the policy explaining *why* these three go is in place).
**Files:**
- `package.json` (modify — `overrides` block only)
- `bun.lock` (regenerated by install; review the diff)

**Approach:**
- Delete the `@sinclair/typebox`, `expo-sqlite`, and `elysia` keys from root `overrides`.
- Reinstall to regenerate the lockfile.
- Run the resolution-equivalence gate (D2) as a **version-uniqueness assertion**, not a requirer-tree read: confirm exactly one resolved version node exists for each removed package after install. `bun pm why <pkg>` enumerates *who requires* a package, not how many distinct versions are installed — so it alone does not prove no duplicate node appeared. Assert uniqueness directly: inspect the regenerated `bun.lock` / `node_modules` for distinct version nodes of each package (e.g. resolve every installed copy and confirm a single version). The `elysia` removal is the highest-risk — confirm no second `elysia` node surfaces via `@elysiajs/cors` / `@elysiajs/eden` / `@elysiajs/openapi` (these peer-depend on elysia, so a dup is unlikely but the uniqueness check, not the requirer list, is the proof).
- If any removed package now resolves to multiple/conflicting versions, restore that single override and add a registry entry for it in `docs/dependency-policy.md` (it was load-bearing after all). Record the outcome.

**Execution note:** Characterization-first — capture each affected package's resolved version *and copy-count* before removal, then assert a single node at the same version after. The proof is version-node uniqueness, not the absence of install errors.

**Test scenarios:**
- Happy path: after removal + install, exactly one `elysia` version node exists across the workspace, at the same version captured before removal (the catalog `^1.4.0` resolution, `1.4.28` at audit time).
- Happy path: exactly one `@sinclair/typebox` node, at a version satisfying both `packages/api`'s `^0.34.15` and elysia's `>= 0.34.0 < 1` (`0.34.49` at audit time).
- Happy path: exactly one `expo-sqlite` node, at the same version `apps/expo` got before removal.
- Edge / failure: if any of the three resolves to 2+ versions post-removal, that entry is restored and documented (the plan's branch in D2) — confirm the restored override + new registry row keep the U3 lint green.
- Integration: workspace type-check passes after removal (no new type errors from a shifted elysia/typebox version) — `bun check-types`.
- Integration: the `check:catalog` lint (`no-duplicate-deps.ts`) still passes (no new catalog violations introduced).

**Verification:** `overrides` contains exactly `react` + `@packrat-ai/nativewindui`; resolution-equivalence holds for all three removed packages (or the documented restore-branch was taken); `bun check-types` and `check:catalog` pass; lockfile diff is limited to the removed packages' resolution.

---

### U3. Add `check:overrides` lint and wire it into the existing check surfaces

**Goal:** A lint that fails CI when a root override lacks a documented rationale, or when the registry references a removed override.
**Requirements:** Enforcement so overrides don't rot (origin open question #4).
**Dependencies:** U1 (registry format), U2 (final override set must be green against the lint).
**Files:**
- `scripts/lint/no-undocumented-overrides.ts` (create)
- `scripts/lint/no-undocumented-overrides.test.ts` (create)
- `package.json` (modify — add `check:overrides` script entry)
- `lefthook.yml` (modify — insert into the existing folded `&&`-chained `run:` command block, in sequence with `no-duplicate-deps.ts`; this is one inline chain, not a discrete per-command entry, so insert a new `&& bun check:overrides` link rather than expecting a standalone item)
- `scripts/check-all.ts` (modify — register a discrete entry in the checks array, mirroring the `no-duplicate-deps` entry)
- `.github/workflows/checks.yml` (modify — add a discrete run step next to the existing `no-duplicate-deps` step)

**Approach:**
- Parse root `package.json` `overrides` keys and the fenced JSON registry block in `docs/dependency-policy.md` (extract the single ```json fence under the registry heading; parse with `JSON.parse`).
- Assert (a) every override key has a registry entry with non-empty `reason` + `removeWhen`; (b) every registry entry maps to a current override (no stale entries); (c) the fenced block exists and is valid JSON (malformed/missing block → hard failure, not a silent pass).
- Exit non-zero on any violation with an actionable message naming the offending package and which side is missing. Mirror the exit-code + reporting conventions of `no-duplicate-deps.ts`.
- Note the three sites are structurally non-uniform: `check-all.ts` and `checks.yml` take discrete entries; `lefthook.yml` takes an inline `&&`-chain link (see Files).

**Patterns to follow:** `scripts/lint/no-duplicate-deps.ts` end-to-end — file header comment block, `readJson` helper, `ROOT` resolution, exit-code semantics, and the three registration sites it already uses.

**Test scenarios:**
- Happy path: current state (2 overrides, 2 registry entries) → exit 0.
- Failure: an override with no registry entry → exit 1, message names the package.
- Failure: a registry entry whose override was removed (stale) → exit 1, message names the stale entry.
- Edge: an override entry present but with an empty `reason` or empty `removeWhen` → exit 1.
- Edge: malformed registry block (missing fence, invalid JSON, or renamed heading) → exit 1 with a parse-error message, not a silent pass.
- Integration: running `bun check:overrides` against the real repo post-U2 exits 0 (the lint agrees with the shipped state).

**Verification:** `bun check:overrides` passes on the real repo; the test file covers the five scenarios above; the lint runs in lefthook, `check-all`, and the `checks.yml` workflow; an intentionally undocumented override fails locally and in CI.

---

## Scope Boundaries

### In scope
- The written dependency policy + override rationale registry.
- Removal of the three redundant overrides, gated on resolution-equivalence.
- The `check:overrides` lint and its wiring.

### Deferred to Follow-Up Work
- **`container_src` build strategy** (workspace-ify vs `bun build --compile` vs status quo). This deferral **is** origin Goal 4's "explicit not-now with a tracked condition" — the tracked condition being the Turborepo timeline (favors option A) and the `bun build --compile` runtime block (option B fails via `@tobyg74/tiktok-api-dl` + `@google/genai` bare `require('crypto')`). Re-evaluate when Turborepo lands or tiktok-dl is replaced. Tracked in the origin doc.
- **`@tobyg74/tiktok-api-dl` fate.** Its removal/replacement would unblock the compile path and remove a supply-chain liability — a prerequisite consideration for the container decision, not this PR.
- **Auditing the broader `catalog` block.** Only the entries this audit touches are in scope.

### Non-goals
- No application behavior changes. This is a dependency-graph + lint-config change only.
- Not migrating to Turborepo (separate in-flight branch). This plan is compatible with it but not gated on it.

---

## System-Wide Impact

- **Dependency resolution / lockfile:** U2 regenerates `bun.lock`. Reviewers should confirm the diff is limited to the three removed packages.
- **Developer workflow / CI:** U3 adds a new gate to lefthook + `check-all` + `checks.yml`. A future undocumented override will fail pre-commit and CI — intended, but worth calling out in the PR so contributors aren't surprised.
- **Affected parties:** developers (new lint), no end-user or ops impact.

---

## Risks & Mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| Dropping `elysia` override surfaces a transitive elysia dup | Low | D2 resolution-equivalence gate; restore-and-document branch in U2 if it triggers |
| Registry format drift breaks the lint parser | Medium | U1 fixes a documented format contract; U3 has a malformed-table test that fails loudly |
| Lockfile diff hides an unintended transitive bump | Low | U2 verification scopes the expected diff; reviewer confirms |

---

## Sequencing

```
U1 (policy + registry)
   └─> U2 (drop overrides, verify)        # needs survivors documented first
   └─> U3 (lint + wiring)                  # needs registry format (U1) and final override set (U2)
```

U1 first. U2 and U3 both depend on U1; U3 additionally depends on U2 (the lint must be green against the shipped override set). Natural order: U1 → U2 → U3.

---

## Origin

`docs/brainstorms/2026-05-31-monorepo-dependency-policy-requirements.md`
