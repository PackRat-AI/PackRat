# LOE Evaluation: Adopt shadcn-style TypeScript config layout

- **Date:** 2026-05-31
- **Status:** Evaluation — no scope committed. Author leans toward full L1+L2+L3, but this doc is the decision input.
- **Worktree / branch:** `chore/shadcn-tsconfig-eval`
- **Reference:** shadcn-ui/ui `templates/next-monorepo`
- **Related work:** in-flight Turborepo migration on `claude/evaluate-turborepo-migration` (adds `turbo.json` with `check-types: { dependsOn: ["^check-types"] }`)

## Problem

The current TS config layout is duplicated and internally inconsistent, and it fights the per-package model the Turborepo migration is moving toward.

Verified current state (`chore/direnv-envrc`):

- **Monolithic root `tsconfig.json`.** One centralized `paths` map (~40 aliases) plus a single `include` globbing all 6 apps + 21 packages into one TS project. Root `check-types` is `tsc --noEmit` over that single blob — no per-package graph, no incremental boundary.
- **Inconsistent per-package configs.** `apps/expo` and `packages/types` extend the root; `apps/web`, `apps/admin`, `packages/api`, `packages/web-ui`, `packages/db` are standalone and each re-declare ~12 compiler options and re-list cross-package `paths` with `../../` rewrites. Aliases live in 2–3 places.
- **Near-dead, conflicting `tsconfig.base.json`.** Only `packages/app` extends it. Its options (`module: system`, `moduleResolution: node`, `target: es2020`) contradict root (`module: preserve`, `moduleResolution: bundler`). Cruft.
- **20 `tsconfig*.json` files** across `apps/` and `packages/`, plus root `tsconfig.json` + `tsconfig.base.json`.
- **Already in place (the enabling substrate):** every package has a real `exports` field pointing at source (e.g. `packages/api/package.json` → `"exports": { ".": "./src/index.ts" }`). The shadcn approach leans on exactly this.

## Target: the shadcn approach, decomposed into 3 layers

"The shadcn approach" is not one change. It decomposes into three separable, cumulative layers. The LOE swings hard by layer, so they are evaluated independently.

### L1 — Shared `typescript-config` workspace package

Extract a `@packrat/typescript-config` package holding a small set of named base configs; every app and package shrinks to a thin `extends` plus its own intra-package `paths` and `include`.

```text
packages/typescript-config/
  package.json
  base.json            # strict, target, lib, module resolution shared by all
  nextjs.json          # extends base + Next plugin, jsx: preserve
  react-library.json   # extends base for web-ui style packages
  react-native.json    # extends base + customConditions: ["react-native"]
  node-library.json    # extends base for api/db/etc
```

```jsonc
// apps/web/tsconfig.json (after)
{
  "extends": "@packrat/typescript-config/nextjs.json",
  "compilerOptions": { "paths": { "web-app/*": ["./*"] } },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]
}
```

- **What changes:** new package (~6 files); rewrite all 20 app/package tsconfigs to thin extenders; delete `tsconfig.base.json`; slim root `tsconfig.json`.
- **Risk:** Low. Mechanical. Each config verifiable by `tsc --noEmit` in that workspace. The main subtlety is reconciling the 4–5 genuinely different base profiles (RN vs Next vs node-library) — they are not all the same today, so the bases must capture real differences, not flatten them.
- **Effort:** ~0.5–1 day.
- **Payoff:** This is the bulk of the visible elegance the request is pointing at. Removes the duplicated ~12-option blocks and the dead/conflicting base.

### L2 — Drop the central `paths` map, resolve via package `exports`

Remove the root `paths` map and the per-app cross-package path rewrites; rely on workspace symlinks + each package's `exports` for `@packrat/*` resolution. Intra-package aliases (e.g. `web-app/*`, `expo-app/*`) stay.

- **What changes:** remove ~40-entry root `paths` map; strip the cross-package `@packrat/*` aliases from the ~7 app/package configs that re-declare them (~57 alias-line declarations total across app/pkg tsconfigs).

> **⚠️ Empirical finding (2026-05-31 spike) — this layer is NOT a clean swap; original "lower risk" assessment was wrong.**
> A spike that slimmed the root `paths` map and relied on `exports` surfaced **193 errors** (tsgo). Root cause: **TS path mapping applies full module resolution — including directory→`index.ts` — to the mapped target, but package.json `exports` does not.** The codebase deep-imports *directories* across packages (`@packrat/api/db`, `/services`, `/auth`, `/routes`, `/containers`, `/workflows/...`, `@packrat/analytics/core/*`, `@packrat/app/browser`). Path aliases resolved these to `index.ts`; `exports` wildcards (`"./*": "./src/*"` or `"./src/*.ts"`) **cannot** — `./src/db` does not resolve to `./src/db/index.ts` under `exports`, and `analytics`/`cli`/`mcp`/`ui` have no `exports` at all. Dropping the aliases would require **enumerating explicit subpath exports for every imported directory in every package** (dozens of entries, ongoing maintenance as new dirs are added) *and* would change Metro/Next/bun runtime resolution (needs mobile + Next build verification).
>
> **Revised risk: HIGH / not worth it as a pure swap.** Recommended posture: **keep the cross-package path aliases** (they are the idiomatic way to expose source directories in a bundler-resolved monorepo) and skip L2's paths-removal. The shadcn "elegance" is delivered by L1 (shared config package) + L3 (references/turbo); exports-over-paths is the one shadcn trait that does not fit PackRat's deep-import style without disproportionate cost.
>
> If pursued anyway, scope it as its own PR: add explicit `exports` subpaths to `api` (~15), `analytics`, `app`; add `exports` to `analytics`/`cli`/`mcp`/`ui`; then verify a clean `check-types` **and** an `expo` Metro bundle + each Next build.

- **Original (pre-spike) risk note, now superseded:** runtime resolution already bypasses tsconfig `paths` (Metro `exports`, Next `transpilePackages`), so it *looked* like a type-only change. True for the root-level package imports; false for the directory deep-imports above.

### L3 — TS project references / `composite` per package

Give each package `composite: true` and a `references` graph; wire per-package `check-types` scripts. This is what makes turbo's `check-types: { dependsOn: ["^check-types"] }` map 1:1 onto the TS dependency graph and gives true incremental, cacheable typechecking.

```jsonc
// packages/api/tsconfig.json (after, illustrative)
{
  "extends": "@packrat/typescript-config/node-library.json",
  "compilerOptions": { "composite": true, "outDir": "dist", "rootDir": "src" },
  "references": [{ "path": "../types" }, { "path": "../db" }, { "path": "../schemas" }],
  "include": ["src"]
}
```

- **What changes:** add `composite` + `references` to ~21 package configs; build the dependency graph (which package references which — must be acyclic; the existing `check:circular` lint helps); add/standardize per-package `check-types` scripts; point root `check-types` at `tsc --build`; integrate with `turbo run check-types`.
- **Two complementary checks, both retained by design (not either/or).** The references model gives both guarantees cheaply, and they catch different classes of bug:
  - **Per-package check** (`tsc --build` of one package, or `turbo run check-types`): "this package is sound given *only* its declared dependencies." Catches under-declared deps, implicit globals, and packages that previously only compiled because the monolith happened to pull something in.
  - **Whole-monorepo check** (root `tsc --build` over a solution-style root config that `references` every leaf project): "everything composes together." Catches integration-level mismatches across the full graph at once — the guarantee the current monolithic root `tsc --noEmit` provides today, preserved.
  - These are similar-but-different and intentionally kept side by side; the root config becomes a thin references-only "solution" file rather than a giant `include` blob, so the whole-repo check stays but becomes incremental and cacheable.
- **Risk:** Medium → higher. `composite` brings constraints: `rootDir`/`outDir` must be set, all referenced inputs must be in the graph, declaration emit must succeed. Some packages currently typecheck only because the monolith pulls everything in; under references, each must be self-consistent. Expect to surface latent type issues package-by-package. Circular references between packages (if any exist today) must be broken.
- **Effort:** ~2–4 days, mostly iterative graph-building and fixing newly-surfaced per-package type errors.
- **Payoff:** Real incremental-build/typecheck performance; correctness boundary per package; the substrate turbo's `^check-types` graph actually needs to be fast.

## Relationship to the Turborepo migration

These are complementary, not competing. Turbo's `check-types: { dependsOn: ["^check-types"] }` assumes per-package typechecking; the current monolithic root config gives turbo nothing to parallelize or cache (one big `tsc` task). The turbo branch has so far only touched `packages/api/tsconfig.json` (early). 

- **L1 + L2** are independent of turbo and can land before or alongside it with no coupling.
- **L3** is where the two efforts meet: the TS reference graph and turbo's task graph should be built together to avoid double work and divergence.

## Recommendation (revised after the 2026-05-31 spike)

1. **L1 — DONE** (commit `c919e06ac`). Shared config package + tsgo. This is the bulk of the visible elegance, low risk, gate unchanged.
2. **Hardening — DONE** (commit `997a2502e`). Fixed the clean per-package errors L1 surfaced (osm-db, overpass, api-client/admin fetchers).
3. **L2 — DESCOPE as a pure swap.** The spike proved `exports` can't replace the directory deep-import aliases without disproportionate per-package `exports` enumeration + runtime build verification. **Keep the cross-package path aliases.** Pursue only as a separate, explicitly-scoped exports-discipline PR if ever desired.
4. **L3 — the real remaining target.** Per-package `composite` + `references`, co-designed with turbo's `check-types` graph. Works fine *with* the path aliases retained. Pairs with the larger per-app strict-hardening backlog (`admin` ~44, `app` ~44, `api` `r2-bucket` worker-globals).

Net: the "elegant config" win the request asked for is delivered by **L1 (done)** + **L3**. L2's exports-over-paths is the one shadcn trait that does not fit PackRat's deep-import style at acceptable cost.

Revised LOE: **L1 + hardening done (~1 day actual).** L3 ~2–4 days. L2 (if ever) is its own larger effort, not recommended.

## Scope boundaries

- **In scope:** TS config structure, the shared config package, path-vs-exports resolution, project references, and the seam with turbo's typecheck task.
- **Deferred / out of scope:** the Turborepo migration itself (separate branch); biome/lint config restructuring; package `exports` redesign beyond what L2 verification requires; any runtime/bundler config changes not forced by L2.

## Assumptions & open questions (to resolve in planning)

- **A1:** No package-to-package circular references block `composite` (L3). Unverified — `check:circular` exists and should be run as the first L3 step.
- **A2:** All cross-package subpath imports (`@packrat/x/y`) have matching `exports` subpaths (L2). Spot-check needed.
- **A3:** The 4–5 base profiles (Next / RN / web-library / node-library) capture all real per-package differences without a long tail of one-off overrides. To confirm while authoring L1 bases.
- **Q1:** Land L1+L2 on this branch and merge before turbo, or rebase L3 onto the turbo branch so the reference graph and task graph are authored together? (Recommendation: L1+L2 standalone; L3 co-located with turbo.)

## Success criteria

- One source of truth per compiler-option profile; no app/package re-declares shared options.
- `tsconfig.base.json` removed; no dead/conflicting config.
- (L2) No central `paths` map; `@packrat/*` resolves via `exports` for tsc, Metro, Next, and vitest, verified by a clean `check-types` + each app build + full vitest run.
- (L3) Both checks pass and are retained: per-package `turbo run check-types` (each package sound in isolation) **and** a root `tsc --build` whole-monorepo check (everything composes), both cached and incremental off the same reference graph.
- No runtime regression in any of the 6 apps.
