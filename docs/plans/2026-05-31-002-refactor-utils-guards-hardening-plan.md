---
title: "refactor: @packrat/utils facade + two-tier guards + layered duplication enforcement"
type: refactor
status: completed
created: 2026-05-31
origin: in-session brainstorm (not persisted to docs/brainstorms/) — decisions carried forward in Problem Frame + Key Technical Decisions
depth: deep
---

# refactor: @packrat/utils Facade + Two-Tier Guards + Layered Duplication Enforcement

## Problem Frame

Utility logic is duplicated across the monorepo — hand-rolled array/object/string/async helpers and raw primitive checks (`typeof x === 'string'`, manual dedupe, hand-written debounce) that could be abstracted behind one curated, type-safe surface. `@packrat/guards` already proves the pattern works for type narrowing (one barrel re-exporting `radash` + `ts-extras` + custom helpers, with a "never use `as` casts" policy and a `no-duplicate-guards` lint). There is **no equivalent home for general utilities**, and nothing enforces "go through the blessed surface" for them.

This plan builds that surface and hardens its enforcement:

1. **`@packrat/utils`** — a new single-barrel package (with subpath exports) that curates the best-typed implementation of each utility across five libraries — **radashi → radash → es-toolkit → lodash → remeda** (soft priority; real tiebreaker is best types + has-the-function). Re-export by default; wrap only when normalization (single-object args, consistent naming) or composition earns it. lodash is retained specifically for old-school primitives (`toString`, `toFloat`, etc.) the modern libs dropped.
2. **`@packrat/utils` is the sole package allowed to import the five raw libs.** Everything else imports from `@packrat/utils` or `@packrat/guards`.
3. **`@packrat/guards` becomes a two-tier specialization on top of `@packrat/utils`** — it re-exports generic predicates (`isString`, `isArray`, `isEmpty`, …) sourced through utils, and keeps/grows its custom narrowing, assertion, enum, and zod-parse layer.
4. **A five-layer enforcement pipeline**, all CI-blocking after migration: `noRestrictedImports` (no reach-around) → `ast-grep` (structural raw-primitive patterns, replacing the brittle regex scripts) → `jscpd` (copy-paste / repeated-logic) → `no-duplicate-utils` (name-based re-implementation) → a **provenance check** (manifest sync + priority order).
5. **A one-shot agent comb-through** seeds the facade and drives the migration by surfacing duplication and abstraction candidates that static tools miss.

**Migration surface is small and verified (2026-05-31):** only **3 real `from 'radash'` import sites** exist (`packages/analytics/src/core/local-cache.ts` → `tryit`; `packages/guards/src/index.ts` → barrel re-export; `apps/expo/features/pack-templates/components/FeaturedPacksSection.tsx`). `packages/api` *declares* `radash` but never imports it (dead dep). `radashi`, `es-toolkit`, and `remeda` are net-new to the repo.

**Target repo:** PackRat. Intended to land in a **new worktree**. All paths below are repo-relative.

---

## Verified Findings (this session, 2026-05-31)

Load-bearing facts gathered from the repo; the units below depend on them:

- **Internal packages are unbundled source.** `@packrat/guards` is `private: true` with `exports → ./src/index.ts` and **no tsup/build step**. tsup is only for *distributed* libs. `@packrat/utils` follows the same shape — no build.
- **Subpath exports have direct precedent.** `packages/env` uses explicit subpaths (`"./node"`, `"./next"`, …); `packages/api` and `packages/schemas` use the wildcard `"./*": "./src/*.ts"`. Either works for utils' category subpaths.
- **`biome noRestrictedImports` is supported** (present in `node_modules/@biomejs/biome/configuration_schema.json`; biome 2.4.6). Per-path scoping uses the existing `overrides[].includes` mechanism already in `biome.json`.
- **The check-wiring triad is fixed convention.** A new check is wired into `lefthook.yml` (pre-push `clean-checks`), `scripts/check-all.ts` (master orchestrator), and `.github/workflows/checks.yml`, plus the `lint:custom` / `lint:strict` aggregate scripts in root `package.json`. The pre-push header states *"All custom checks are now clean — no continue-on-error backlog remaining"* — so new checks must be green (full migration) before they're added to the blocking set.
- **`packages/checks` is the home for richer checks** (`check-magic-strings.ts`, `check-route-schemas.ts`, `check-type-casts.ts`), invoked via `bun run --cwd packages/checks ...`. The provenance check belongs here. The coarser nudge-style checks live in `scripts/lint/`.
- **Existing enforcement philosophy already prefers builders over raw primitives.** `no-raw-regex.ts` enforces `magic-regexp` over raw regex and explicitly notes *"Biome's `performance/useTopLevelRegex` covers the stricter AST check"* — the team already understands the regex-vs-AST tradeoff, making ast-grep a natural upgrade.
- **Library type-nativeness:** radashi, es-toolkit, remeda, and radash are all TS-native and ship their own types; only lodash needs `@types/lodash`.
- **Adjacency (coordination, not conflict):** `docs/plans/2026-05-31-001-refactor-monorepo-dependency-policy-plan.md` (authored today) edits root `package.json` catalog/overrides **and the same check-wiring triad**, and establishes a **fenced-JSON-registry-parsed-by-a-lint** pattern (because `package.json` is strict JSON — no inline comments). This plan reuses that registry pattern for provenance and should expect to rebase its triad edits onto that plan's.
- **`bun.lock` regenerates on install;** review its diff whenever deps change.

---

## Key Technical Decisions

**D1 — `@packrat/utils` is the single import boundary for the five libs.**
Only `packages/utils/**` may import `radashi`/`radash`/`es-toolkit`/`lodash`/`remeda`. Enforced via biome `noRestrictedImports` (global ban) + a `biome.json` override scoping the rule off for `packages/utils/**`. `@packrat/guards` is **not** exempt from the five-lib ban — it obtains generic predicates *through* utils. (Guards keeps its existing `ts-extras` + `zod` direct imports; those are outside the banned set.)

**D2 — Two-tier dependency direction: `guards → utils`, one-directional.**
`@packrat/guards` depends on `@packrat/utils` (workspace dep). Guards re-exports generic predicates from utils and layers its custom narrowing/assertions/enum/zod-parse on top. No cycle (utils never imports guards); enforced by the existing `no-circular-deps.ts`.

**D3 — Two distinct enforcement exemption sets.**
The "no raw library imports" exemption is **utils-only**. The "no raw `typeof`" exemption is **utils + guards** (guards is the legitimate home for custom `typeof` narrowing). These are deliberately different sets; the ast-grep rules and biome config encode them separately so they don't get conflated.

**D4 — Curate by re-export; wrap only when it earns it.**
Default is a thin re-export sourcing the best-typed implementation. Wrap when (a) normalizing to repo conventions (single-object args for `useMaxParams: 2`, consistent naming) or (b) composing a primitive the libs lack. No speculative wrappers — the facade grows from real usage + duplication the sweep surfaces.

**D5 — Provenance is a fenced-JSON manifest enforced by a check in `packages/checks`.**
A manifest records, per facade export: `source` (which lib), and `alsoIn` (higher-priority libs known to provide it, if any). The check asserts (a) every facade export appears with a valid `source`; (b) `source` is an allowed lib; (c) no export sources from a lower-priority lib when `alsoIn` lists a higher-priority one — i.e. priority is enforced against the curator's *own declared* alternatives, not by dynamically probing every lib's API (which would be brittle across versions). This keeps the priority rule real and CI-blocking without an unmaintainable cross-lib API index.

**D6 — The five libs are direct deps of `@packrat/utils`, not catalog entries** *(diverges from the brainstorm assumption; follows the newer dependency policy)*.
Per `docs/plans/2026-05-31-001-...-dependency-policy-plan.md`, catalog is for deps **multiple workspaces declare directly and must agree on**. Post-migration only `@packrat/utils` imports these libs, so they are single-consumer direct deps → declared directly in `packages/utils/package.json`, **not** catalog. This means `radash` moves **out** of root catalog as part of migration. `check:catalog` (`no-duplicate-deps.ts`) stays green because no other workspace declares them. *(Reversible on review if the team prefers cataloging the blessed libs regardless.)*

**D7 — ast-grep and jscpd are root dev dependencies, not catalog.**
Single-consumer tooling (root scripts) → plain `devDependencies` in root `package.json`, consistent with D6 and the dependency policy. `@ast-grep/cli` and `jscpd`.

---

## Output Structure

```text
packages/utils/                      # new — the curated facade (private, unbundled source)
  package.json                       # private; subpath exports; direct deps on the five libs
  src/
    index.ts                         # root barrel (re-exports all categories)
    array.ts
    object.ts
    string.ts
    async.ts
    fn.ts
    math.ts
    provenance.ts                    # the fenced-JSON manifest source-of-truth (or .json — see U9)
  test/
    array.test.ts
    string.test.ts
    wrappers.test.ts                 # custom/wrapped helpers only
    provenance.test.ts

packages/checks/src/
  check-utils-provenance.ts          # new — manifest sync + priority enforcement (U9)

scripts/lint/
  no-duplicate-utils.ts              # new — name-based re-implementation check (U8)
  no-raw-typeof.ts                   # DELETED — ported to ast-grep (U6)
  no-raw-regex.ts                    # DELETED — ported to ast-grep (U6)

sgconfig.yml                         # new — ast-grep project config (U6)
ast-grep-rules/
  no-raw-typeof.yml                  # ported rule, with autofix
  no-raw-regex.yml                   # ported rule
  no-handrolled-util.yml             # new structural rules for facade equivalents

.jscpd.json                         # new — copy-paste detector config (U7)

docs/utils-policy.md                 # new — the facade curation policy + provenance contract
```

The tree is a scope declaration, not a constraint; per-unit **Files** lists are authoritative.

---

## High-Level Technical Design

The two-tier surface and the enforcement boundary:

```text
        radashi  radash  es-toolkit  lodash  remeda      (raw libs — direct deps of utils only)
            \       \        |         /       /
             \       \       |        /       /
              ▼       ▼      ▼       ▼       ▼
          ┌─────────────────────────────────────────┐
          │   @packrat/utils   (SOLE lib importer)   │   re-export + wrap; provenance manifest
          │   barrel + subpaths: array/object/...    │
          └─────────────────────────────────────────┘
                 ▲                         ▲
                 │ (predicates)            │ (utilities)
          ┌──────────────────┐      ┌──────────────────────────────┐
          │  @packrat/guards │      │  all other packages + apps    │
          │  custom narrow / │      │  import ONLY from the facade   │
          │  assert / zod    │      └──────────────────────────────┘
          └──────────────────┘

  Enforcement (CI-blocking after migration):
   1. biome noRestrictedImports  → ban the five libs outside packages/utils
   2. ast-grep                   → structural raw-primitive patterns (replaces regex scripts)
   3. jscpd                      → copy-paste / repeated-logic detection
   4. no-duplicate-utils         → name-based re-implementation of facade exports
   5. check-utils-provenance     → manifest sync + priority order
```

*This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

---

## Implementation Units

Grouped into four phases. U-IDs are stable and never renumbered.

### Phase 1 — Facade foundation

### U1. Enroll libs + scaffold `@packrat/utils`

**Goal:** Stand up the empty `@packrat/utils` package with subpath exports and the five libs as direct deps; add `@types/lodash`.
**Requirements:** Single curated utility surface (Problem Frame #1); single import boundary (D1, D6).
**Dependencies:** none.
**Files:**
- `packages/utils/package.json` (create — `private: true`, `type: module`, root + category subpath exports mirroring `packages/env`; deps: `radashi`, `radash`, `es-toolkit`, `lodash`, `remeda`, `@types/lodash`)
- `packages/utils/src/index.ts` (create — empty barrel re-exporting category files)
- `packages/utils/src/{array,object,string,async,fn,math}.ts` (create — empty stubs)
- `package.json` (modify — remove `radash` from `catalog` per D6; confirm no other catalog churn)
- `bun.lock` (regenerated; review diff)

**Approach:** Mirror `packages/guards/package.json` shape plus subpath exports. Pick the explicit-subpath style (`"./array": "./src/array.ts"`, …) like `packages/env` for discoverability, plus the `"."` root barrel. No build step (D-Verified: unbundled source).

**Patterns to follow:** `packages/env/package.json` (subpath exports), `packages/guards/package.json` (private unbundled shape).

**Test scenarios:**
- `Test expectation: none -- scaffolding/package manifest; behavior arrives in U3. Verified by typecheck + install resolving the new workspace.`

**Verification:** `bun install` resolves the new workspace; `@packrat/utils` and each subpath import-resolve from a scratch file; `radash` no longer in root catalog; `check:catalog` and `bun check-types` pass.

---

### U2. One-shot agent comb-through → duplication & abstraction findings

**Goal:** Produce a findings document enumerating (a) duplicated/hand-rolled utility logic across `packages/` + `apps/`, (b) raw primitives with a facade equivalent, and (c) the prioritized list of functions the facade should expose first — each mapped to its best-typed source lib.
**Requirements:** "Tired of duplicated code we could abstract" (Problem Frame); seeds U3 curation and U10 migration.
**Dependencies:** none (can run parallel to U1).
**Files:**
- `docs/utils-sweep-findings.md` (create — the agent's report: candidate exports, source lib per candidate, duplication clusters with file references, suggested wrappers)

**Approach:** Dispatch a sweep agent (or `jscpd`-assisted scan as input) over `packages/` and `apps/` to surface repeated logic and hand-rolled helpers. Output is a decision-support artifact, not code. The curator (U3) treats it as the candidate backlog. Cross-check against the 3 known `radash` sites and any `lodash`-shaped hand-rolls.

**Patterns to follow:** none (research artifact).

**Test scenarios:**
- `Test expectation: none -- findings document; correctness is validated by U3 consuming it and U7/U8 later catching anything missed.`

**Verification:** `docs/utils-sweep-findings.md` exists with a concrete candidate list (function → source lib → call sites) sufficient to drive U3 without re-deriving it.

---

### U3. Curate & implement the `@packrat/utils` surface

**Goal:** Populate the facade — re-export the best-typed implementation per function across the five libs, wrapping only where D4 justifies; author the provenance manifest alongside each export.
**Requirements:** Single curated, type-safe surface; composability (Problem Frame #1, D4); provenance source-of-truth (D5).
**Dependencies:** U1, U2.
**Files:**
- `packages/utils/src/{array,object,string,async,fn,math}.ts` (implement)
- `packages/utils/src/index.ts` (wire re-exports)
- `packages/utils/src/provenance.ts` or `provenance.json` (create — the manifest U9 enforces; see U9 for shape decision)
- `packages/utils/test/array.test.ts`, `string.test.ts`, `wrappers.test.ts` (create)
- `docs/utils-policy.md` (create — curation policy: priority order, wrap-vs-reexport rule, provenance contract)

**Approach:** For each candidate from U2: choose the source lib by best types + availability (priority order as tiebreaker), re-export directly, and record `{ source, alsoIn }` in the manifest. Wrap (D4) only for arg-shape normalization (`useMaxParams: 2`) or composition. Keep categories cohesive; the root barrel re-exports all. Mirror `@packrat/guards/src/index.ts`'s sectioned-comment style documenting where each group comes from.

**Patterns to follow:** `packages/guards/src/index.ts` (sectioned re-export barrel with provenance comments), `packages/guards/src/narrow.ts` (wrapper + alias style).

**Test scenarios:**
- Happy path: each **wrapped** helper returns expected output for representative inputs (e.g. a normalized single-object-arg wrapper maps to the underlying lib call correctly).
- Edge cases: wrapped helpers handle empty/nullish/boundary inputs per their documented contract (empty array, `undefined`, zero).
- Type-level: a `tsd`-style or `expectTypeOf` assertion that key exports carry the expected types (esp. lodash-sourced ones via `@types/lodash`) and that subpath imports (`@packrat/utils/array`) resolve.
- Smoke: every name listed in the provenance manifest is actually exported from the barrel (guards against manifest/code drift from the code side; U9 guards the manifest side).
- `Pure re-exports (no wrapper) are NOT re-tested` — the upstream lib owns that behavior; only wrappers and the barrel/manifest contract are tested here.

**Verification:** `@packrat/utils` exports the curated surface; wrappers covered by tests with coverage meeting repo gates; `bun check-types` passes; manifest lists every export.

---

### Phase 2 — Guards two-tier refactor

### U4. Refactor `@packrat/guards` onto `@packrat/utils`

**Goal:** Make guards depend on utils, re-export generic predicates from utils (not directly from `radash`), and keep/grow the custom narrowing/assertion/enum/parse layer.
**Requirements:** Two-tier architecture (Problem Frame #3, D2); removes guards' direct `radash` import (one of the 3 migration sites).
**Dependencies:** U3.
**Files:**
- `packages/guards/package.json` (modify — add `@packrat/utils: workspace:*`; remove `radash` direct dep)
- `packages/guards/src/index.ts` (modify — source `isString`/`isArray`/`isObject`/`isEmpty`/`isEqual`/… from `@packrat/utils` instead of `radash`; keep `ts-extras` + custom re-exports)
- `packages/guards/test/*` (add/extend — assert the re-exported predicate surface is unchanged for consumers)

**Approach:** Swap the `from 'radash'` predicate block to `from '@packrat/utils'`. Public surface of `@packrat/guards` stays byte-for-byte identical to consumers (same names exported) — this is an internal sourcing change. Custom files (`narrow.ts`, `assertions.ts`, `enum.ts`, `parse.ts`) are untouched except where a predicate they use now comes from utils.

**Execution note:** Characterization-first — snapshot the current `@packrat/guards` public export list before the change; assert it's identical after (no consumer-visible drift).

**Patterns to follow:** the existing `packages/guards/src/index.ts` re-export structure.

**Test scenarios:**
- Covers the no-regression contract: the set of names exported from `@packrat/guards` is identical before and after (snapshot/enumeration test).
- Happy path: representative predicates (`isString`, `isArray`, `isEmpty`) behave identically when imported from `@packrat/guards` post-refactor.
- Integration: a downstream consumer (`packages/config`, which depends on `@packrat/guards`) type-checks and runs unchanged.
- Edge: no circular dependency introduced — `no-circular-deps.ts` passes with the new `guards → utils` edge.

**Verification:** guards imports predicates from utils; `radash` gone from `packages/guards/package.json`; public export surface unchanged; `no-circular-deps` + `bun check-types` pass.

---

### Phase 3 — Enforcement pipeline (built green, flipped to blocking in U10)

### U5. `noRestrictedImports` — ban reach-around imports

**Goal:** Forbid direct imports of the five libs everywhere except `packages/utils/**`.
**Requirements:** Single import boundary (D1).
**Dependencies:** U3 (facade must exist so there's a legal alternative), U4 (guards already migrated so the rule lands green).
**Files:**
- `biome.json` (modify — add `noRestrictedImports` to `linter.rules` banning `radashi`/`radash`/`es-toolkit`/`lodash`/`remeda`; add an `overrides` entry scoping the rule `off` for `packages/utils/**`)

**Approach:** Use biome's native `noRestrictedImports`. Global ban with a per-path override (the same mechanism `biome.json` already uses for `useMaxParams`/`useTopLevelRegex` exemptions). No custom script needed.

**Patterns to follow:** existing `biome.json` `overrides[].includes` exemption blocks.

**Test scenarios:**
- Happy path: a file outside utils importing `from 'lodash'` is flagged by `bun biome check`; the same import inside `packages/utils/**` is not.
- Edge: subpath/`/fp` style imports (`lodash/merge`, `es-toolkit/compat`) are also caught (pattern covers submodules), or explicitly documented if biome's matcher can't and a fallback ast-grep rule covers it.

**Verification:** `bun biome check` flags reach-around imports outside utils and stays silent inside utils; repo is clean post-U10 migration.

---

### U6. Introduce ast-grep; port and retire the regex scripts

**Goal:** Add ast-grep with AST-accurate, autofixable rules for raw `typeof` and raw regex; delete `no-raw-typeof.ts` and `no-raw-regex.ts`.
**Requirements:** Structural (not name/text) enforcement of raw primitives (Problem Frame #4; user: "not just about name … repeated logic"); D3 exemption sets.
**Dependencies:** U3.
**Files:**
- `package.json` (modify — add `@ast-grep/cli` devDep; add `check:ast-grep` script)
- `sgconfig.yml` (create — ast-grep project config pointing at `ast-grep-rules/`)
- `ast-grep-rules/no-raw-typeof.yml` (create — match `typeof $X === '<primitive>'`, autofix to facade/guards predicate; preserve the `GLOBAL_IDENTIFIERS` exemption — `window`/`document`/`globalThis`/`Bun`/`navigator`/`process`; exempt `packages/utils/**` + `packages/guards/**` per D3)
- `ast-grep-rules/no-raw-regex.yml` (create — match raw regex literals / `new RegExp`, point to `magic-regexp`; exempt utils)
- `scripts/lint/no-raw-typeof.ts` (delete)
- `scripts/lint/no-raw-regex.ts` (delete)
- `scripts/check-all.ts`, `lefthook.yml`, `.github/workflows/checks.yml`, root `lint:custom`/`lint:strict` (modify — replace the two deleted script references with `check:ast-grep`)

**Approach:** Encode the rules in ast-grep YAML with `language: typescript`. Carry over the exact exemptions the regex scripts had (global identifiers; the `packages/guards` carve-out for `typeof`). ast-grep's `fix:` field provides autofix where a 1:1 predicate substitution is safe.

**Test scenarios:**
- Happy path: a fixture file with `typeof v === 'string'` outside utils/guards is flagged; the autofix rewrites it to the facade/guards predicate.
- Exemption: `typeof window !== 'undefined'` and custom `typeof` narrowing inside `packages/guards/**` are NOT flagged (D3).
- Happy path: a raw `/foo/.test(x)` is flagged with a `magic-regexp` suggestion; same construct inside utils is exempt.
- Regression-parity: every case the old `no-raw-typeof.ts`/`no-raw-regex.ts` caught is still caught (port a sample of their known-flag cases as fixtures), and known false positives they over-flagged are now clean.

**Verification:** `check:ast-grep` runs in all four wiring surfaces; the two regex scripts are gone; parity fixtures pass; repo is clean post-migration.

---

### U7. Introduce `jscpd` — copy-paste / repeated-logic detection

**Goal:** Add token-based duplication detection across `packages/` + `apps/` with a tuned threshold.
**Requirements:** Catch duplicated logic regardless of naming (Problem Frame #4; user: "repeated logic").
**Dependencies:** none structural (can build anytime); tuned against the post-U3/U10 tree.
**Files:**
- `package.json` (modify — add `jscpd` devDep; add `check:duplication` script)
- `.jscpd.json` (create — config: globs over `packages/`/`apps/` src, ignore tests/generated/`dist`, set `threshold`, `minTokens`, reporters)
- `scripts/check-all.ts`, `lefthook.yml`, `.github/workflows/checks.yml` (modify — wire `check:duplication`)

**Approach:** Configure jscpd with a threshold that passes on the post-migration tree (calibrate empirically so it's green at flip time, then ratchet down in follow-ups). Exclude tests, codegen (`**/*.gen.ts`, `src/codegen`), and the ignore set already in `biome.json`.

**Test scenarios:**
- Happy path: a fixture with two near-identical ~`minTokens` blocks is reported as a clone.
- Edge: test files and generated files are excluded (a deliberate dup in a `*.test.ts` is not reported).
- Calibration: `check:duplication` exits 0 on the migrated tree at the chosen threshold (records the baseline so the gate is meaningful, not vacuous).

**Verification:** `check:duplication` runs in the wiring surfaces and is green at the calibrated threshold post-migration; the baseline threshold is recorded in `.jscpd.json` with a comment/doc note.

---

### U8. `no-duplicate-utils` — name-based re-implementation check

**Goal:** Flag home-grown functions whose name matches a `@packrat/utils` export, mirroring `no-duplicate-guards.ts`.
**Requirements:** Catch copy-paste re-implementation of facade utilities (Problem Frame #4).
**Dependencies:** U3 (needs the canonical export list).
**Files:**
- `scripts/lint/no-duplicate-utils.ts` (create — adapt `no-duplicate-guards.ts`; derive the banned-name set from the `@packrat/utils` manifest/exports rather than a hardcoded list, so it stays in sync)
- `scripts/check-all.ts`, `lefthook.yml`, `.github/workflows/checks.yml`, `lint:custom` (modify — wire it)

**Approach:** Clone the `no-duplicate-guards.ts` structure (walk `apps/` + `packages/`, skip comment/import lines, regex for declarations). Source the name set from `@packrat/utils`'s exports (or the provenance manifest) so adding a facade export automatically extends the check. Exclude `packages/utils/**` and `packages/checks/**`.

**Patterns to follow:** `scripts/lint/no-duplicate-guards.ts` (near-identical shape).

**Test scenarios:**
- Happy path: a fixture declaring `const chunk = (...)` outside utils is flagged with a "import from @packrat/utils" message.
- Edge: a re-export line (`export { chunk } from '@packrat/utils'`) and the definition inside `packages/utils/**` are NOT flagged.
- Sync: adding a new export to the facade manifest extends the banned set without editing the check (assert via fixture that a newly-listed name is now caught).

**Verification:** `no-duplicate-utils` runs in the wiring surfaces, flags re-implementations, exempts utils/checks, and derives its name set from the facade.

---

### U9. `check-utils-provenance` — manifest sync + priority

**Goal:** A `packages/checks` check that validates the provenance manifest against the facade and enforces the priority order against declared alternatives (D5).
**Requirements:** Provenance as a real CI check (user decision); priority order enforcement.
**Dependencies:** U3 (manifest + exports exist).
**Files:**
- `packages/checks/src/check-utils-provenance.ts` (create)
- `packages/checks/package.json` (modify — add `check:provenance` script)
- `packages/utils/src/provenance.{ts|json}` (manifest; shape decided here)
- `packages/checks/test/check-utils-provenance.test.ts` (create)
- `scripts/check-all.ts`, `lefthook.yml`, `.github/workflows/checks.yml` (modify — wire `check:provenance:strict` alongside the existing `check:route-schemas:strict` / `check:casts:strict`)

**Approach (manifest shape decision):** Use a typed TS module (`provenance.ts`) exporting a `Record<string, { source: Lib; alsoIn?: Lib[] }>` rather than a free-form fenced markdown block — utils is a TS package, so a typed object is parse-stable, type-checked, and avoids the markdown-table fragility the dependency-policy plan called out. (The dependency-policy lint parses a fenced JSON block because its data lives in a `.md` doc; here the data lives in code, so a typed module is the lower-friction equivalent.) The check asserts: every facade export has a manifest entry; every manifest entry maps to a real export (no stale rows); `source` is an allowed lib; and `source` is not lower-priority than any lib listed in `alsoIn`.

**Patterns to follow:** `packages/checks/src/check-route-schemas.ts` (strict-mode check shape, `--strict` flag, `bun run --cwd packages/checks` invocation).

**Test scenarios:**
- Happy path: a manifest in sync with exports, all sources valid and priority-respecting, exits 0.
- Failure: an export missing from the manifest → exit 1 with the export name.
- Failure: a stale manifest row referencing a non-existent export → exit 1.
- Failure: `source: 'lodash'` with `alsoIn: ['radashi']` → exit 1 (lower-priority source despite a higher-priority alternative).
- Edge: an export legitimately only in lodash (`alsoIn` empty/absent) sourced from lodash → exits 0 (lodash retained for old-school primitives is allowed).

**Verification:** `check:provenance:strict` runs in the wiring surfaces; the four failure modes above are covered by tests; green on the real manifest.

---

### Phase 4 — Migration & activation

### U10. Migrate call sites, remove dead deps, flip checks to blocking

**Goal:** Migrate the remaining raw call sites, remove dead/relocated deps, resolve everything the new checks flag, and add all five layers to the CI-blocking set.
**Requirements:** "Full migration in this worktree" (user decision); pre-push invariant ("all checks clean, no backlog").
**Dependencies:** U4, U5, U6, U7, U8, U9.
**Files:**
- `packages/analytics/src/core/local-cache.ts` (modify — `tryit` from `@packrat/utils`)
- `apps/expo/features/pack-templates/components/FeaturedPacksSection.tsx` (modify — radash import → facade)
- `packages/analytics/package.json`, `apps/expo/package.json`, `packages/api/package.json` (modify — remove now-unused direct `radash` deps; `api`'s is already dead)
- any sites flagged by ast-grep `no-raw-typeof`/`no-raw-regex`, `no-duplicate-utils`, or `jscpd` above threshold (modify — replace with facade/guards calls)
- `lefthook.yml`, `scripts/check-all.ts`, `.github/workflows/checks.yml`, root `lint:custom`/`lint:strict` (modify — promote `check:ast-grep`, `check:duplication`, `no-duplicate-utils`, `check:provenance:strict` into the blocking sets; remove the deleted regex-script references)
- `bun.lock` (regenerated; review diff)

**Approach:** Sequence migration before flip: run each new check, fix what it surfaces (using the U2 findings as the map), confirm green, then add it to `clean-checks` (pre-push), `check-all.ts`, and `checks.yml`. **Coordinate with `2026-05-31-001` dependency-policy plan** — both edit the triad + root `package.json`; rebase triad edits onto whichever lands first to avoid clobbering.

**Execution note:** Migrate-then-gate per check — never add a check to the blocking set while it's red. The pre-push header's "no continue-on-error backlog" invariant must hold at the end.

**Test scenarios:**
- Integration: full `bun check:all` is green with all five new layers active.
- Integration: `bun check-types` passes after every call-site migration (no type drift from swapping `radash` → facade).
- Happy path: the 3 known radash sites import from `@packrat/utils` and behave identically (analytics `tryit` error-tuple behavior unchanged; expo component renders unchanged).
- Edge: no `radash`/`radashi`/`es-toolkit`/`lodash`/`remeda` direct import remains outside `packages/utils/**` (biome clean); no orphaned dep declarations remain.
- Regression: existing test suites for `analytics`, `api`, `expo`, `guards`, `config` pass unchanged.

**Verification:** all five enforcement layers are CI-blocking and green; no reach-around imports or dead util-lib deps remain; `bun check:all` and the full test suite pass; the migrated worktree is ready to merge.

---

## Scope Boundaries

**In scope:** `@packrat/utils` facade + subpaths; two-tier guards refactor; five-layer enforcement; one-shot seeding sweep; migration of the 3 radash sites + raw-primitive sites flagged by the new checks; wiring all checks to CI-blocking.

### Deferred to Follow-Up Work
- **Ratcheting `jscpd` threshold down** over successive PRs after the initial calibrated baseline.
- **Recurring/scheduled duplication sweep** (user chose one-shot; a committed recurring command was the rejected alternative).
- **Migrating non-radash hand-rolled utilities** beyond what the sweep + checks surface this round — the facade grows from real usage, not speculation (D4).
- **`ast-grep` rules for hand-rolled facade equivalents** (`no-handrolled-util.yml` beyond `typeof`/regex) — add as duplication patterns prove worth encoding.

### Outside this effort
- Turborepo migration (separate in-flight branch) — this work should stay compatible but is not gated on it.
- The `container_src` / dependency-policy decisions owned by `2026-05-31-001`.

---

## Dependencies / Assumptions

- **Coordination:** `docs/plans/2026-05-31-001-refactor-monorepo-dependency-policy-plan.md` edits the same check-wiring triad and root `package.json`. Expect to rebase triad + catalog edits; the provenance manifest reuses its registry concept (in code form — D5/U9).
- **Verified (2026-05-31):** 3 real `from 'radash'` sites; `api`'s radash is a dead dep; radashi/es-toolkit/remeda are net-new; biome `noRestrictedImports` is supported; internal packages are unbundled source; `packages/env` subpath-export precedent.
- **Assumption:** vitest is the test runner (catalog `@vitest/coverage-v8`); new tests follow repo `*.test.ts` conventions and meet existing coverage gates ("test safety is everything").
- **Assumption (reversible, D6):** the five libs are direct deps of utils, not catalog — flag on review to keep them cataloged.

---

## Verification Strategy

- `bun check:all` green with all five enforcement layers active (master signal).
- `bun check-types` green throughout (full type safety; never relax flags — fix code/tighten types).
- Full existing test suites for `analytics`, `api`, `expo`, `guards`, `config` pass unchanged.
- New tests: facade wrappers + barrel/manifest contract (U3), guards no-regression (U4), each new check's flag/exempt behavior (U6–U9).
- No reach-around lib imports and no dead util-lib deps remain (biome + grep).
