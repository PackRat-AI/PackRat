# Monorepo Dependency Policy — Requirements

**Date:** 2026-05-31
**Status:** Requirements (ready for `/ce-plan`)
**Scope:** Deep — feature (technical/architectural; implementation details are the subject)
**Trigger:** Proactive hygiene. No incident. The root `overrides` block accumulated during the Bun-catalog migration and nobody could state why each entry exists. This audit is to regain confidence, not to fix a fire. **It can land independently of the in-flight Turborepo migration.**

---

## Problem

The repo has **two coexisting "shared-version" primitives** — `catalog:` (used heavily, dozens of entries) and root `overrides` (5 entries) — with **no stated rule for which to use when**. The overrides block in particular is opaque: each entry forces a version across the *entire* dependency tree (including transitives no workspace declares), is invisible at the consumer site, and carries no rationale or removal condition. Nobody can confidently say which entries are load-bearing and which are stale.

Separately, `packages/api/container_src` is a **non-workspace** package with its own `bun.lock`. It benefits from *neither* catalog nor overrides, so its dependency versions (notably `elysia`) drift independently of the rest of the monorepo. It is a permanent exception to whatever policy we write — unless we address it.

### Why this matters (carrying cost, not a fire)
- **Burden of proof is currently backwards.** Today an opaque override survives by default. We want the burden on *keeping* an undocumented override, not on changing it.
- **Wrong primitive is being used for `elysia`.** It's filed as an override when it's a textbook catalog case (see audit). That mis-filing is exactly the confusion a policy prevents.
- **The exception (`container_src`) compounds.** Every month it stays a standalone island, the "why is elysia pinned in three different ways?" question gets harder to answer.

---

## Goals

1. **A durable dependency policy** — a one-screen rule for when to use workspace ownership vs `catalog:` vs `overrides`, that a future maintainer (or agent) can apply without archaeology.
2. **Every surviving override is justified** — each remaining `overrides` entry carries: which transitive consumer forces it, why, and a removal condition. No silent entries.
3. **`elysia` filed under the right primitive** — moved from overrides to catalog for the workspaces that declare it.
4. **A decided direction for `container_src`** — workspace-ify, compile-to-binary, or explicit "not now" with a tracked condition. No more accidental exception.

### Non-goals
- Not migrating to Turborepo (separate branch in flight). This policy is designed to be *compatible* with that migration but not gated on it.
- Not auditing the full `catalog` block — only the overrides and the catalog entries the audit touches (`elysia`).
- Not changing application behavior. This is a dependency-graph and build-config change only.

---

## The Policy (the spine)

Three primitives, three jobs. Pick by **what kind of thing** the dependency is, not by habit.

| Primitive | Use when | What it actually does | Visibility |
|---|---|---|---|
| **Workspace** | It's code *we author* | Resolves via `workspace:` protocol; one canonical copy | Declared in each consumer's `package.json` |
| **`catalog:`** | Multiple workspaces declare the *same direct dep* and must agree on its version | Names a single version; each consumer writes `catalog:` | Visible at every consumer site |
| **`overrides`** | We must force a *transitive* we don't declare (security pin, broken upstream range, a fork) | Forces a version across the **entire** tree, including transitives | Invisible at consumer sites — root-only |

**The rule, stated as a decision:**

1. **Is it code we author?** → Make it a **workspace**. (This is why `container_src` is a problem — see below.)
2. **Do multiple workspaces declare it directly, and must they agree** (shared framework, type-coupled client/server, single-React-copy)? → **`catalog:`**.
3. **Are we forcing a *transitive* we don't declare** (CVE patch, a broken upstream pin, a fork build)? → **`overrides`** — and the entry **must** carry an inline comment: `// <consumer> needs <reason>; remove when <condition>`.
4. **None of the above** (single workspace, normal direct dep)? → Just declare it directly. No catalog, no override.

**Corollary — overrides are an escape hatch, not a version-alignment tool.** If you reach for an override to make two workspaces agree on a *direct* dep, you've picked the wrong primitive — that's catalog's job. Overrides exist for the things catalog *can't* reach: transitives and forks.

---

## Override Audit (the rule applied)

Current root `overrides`:

```jsonc
"overrides": {
  "@packrat-ai/nativewindui": "2.0.3-2",
  "@sinclair/typebox": "^0.34.15",
  "elysia": "^1.4.0",
  "expo-sqlite": "~55.0.15",
  "react": "19.2.6"
}
```

| Entry | Verdict | Why (under the rule) |
|---|---|---|
| **`@sinclair/typebox`** | **DROP override** | It's already a *direct* dep in `packages/api` at `^0.34.15`, and elysia's own range is `>= 0.34.0 < 1`. The direct pin + elysia's flexible range resolve cleanly on their own — the override is pure redundancy. Rule step 4: just a direct dep, no override needed. |
| **`elysia`** | **MOVE overrides → catalog** | Direct dep in **3 workspaces** (`packages/api`, `packages/api-client`, `packages/api/container_src`) that Eden-treaty forces to agree (client and server must resolve the same elysia for type inference). Rule step 2: textbook catalog. Currently mis-filed as an override. *(Caveat: `container_src` is non-workspace and won't pick up `catalog:` — handled in the container section.)* |
| **`react`** | **KEEP override** | Load-bearing transitive unification: react-dom, react-native, and ~every RN/web library pull react transitively and *must* resolve to one copy ("invalid hook call" / two-Reacts otherwise). Rule step 3: forcing transitives we don't all declare. Add a rationale comment. |
| **`@packrat-ai/nativewindui`** | **KEEP override + document removal condition** | A pinned fork prerelease (`2.0.3-2`), consumed by `packages/ui`. Rule step 3: forcing our fork over upstream resolution is a legit escape-hatch use. Must document: `remove when fork merges upstream / we move off the fork`. *(Not audited in the prior pass — flagged here as the same class of question.)* |
| **`expo-sqlite`** | **DROP override** *(verified 2026-05-31)* | `bun pm why expo-sqlite` shows the **only hard requirer is `apps/expo`** at `~55.0.15` (resolves to `55.0.16`). Every other reference is an **optional peer** (`drizzle-orm >=14.0.0`, `@legendapp/state`) that does not force a version. Nothing unifies a conflicting transitive → the override is redundant with the direct pin, exactly like typebox. Rule step 4: just a direct dep. |

**Net effect:** 5 overrides → **2** (`react`, `@packrat-ai/nativewindui`), each documented; `elysia` relocated to catalog; `typebox` **and** `expo-sqlite` overrides deleted as redundant.

---

## `container_src` Strategy (the hard case)

`container_src` is **code we author** (a 473-line Elysia server), which by rule step 1 *should* be a workspace. Instead it's a standalone package with its own `bun.lock`, and its `Dockerfile` does `COPY container_src/package.json` + `bun install --production` — so it shares nothing with the root resolution. The root `elysia` override **does not touch it today**; its elysia version drifts freely. Three ways to resolve the exception:

### A) Workspace-ify it
Add `container_src` to the workspaces set; delete its standalone `bun.lock`; let it resolve elysia via catalog like everyone else.
- **Pros:** Principled (obeys rule step 1); single source of truth for elysia; `turbo prune --docker` (post-Turborepo) can emit a pruned Docker context that dedupes elysia.
- **Cons:** Docker build gets more complex — must copy a pruned workspace, not one `package.json`. Real dedup benefit is **coupled to the Turborepo migration landing**. `bun prune --docker` (oven-sh/bun#28600, PR #28601) is **not shipped**, so until Turborepo's prune covers it you hand-roll the pruning.
- **Best when:** Turborepo has landed and we want container_src to be a first-class member of the graph.

### B) `bun build --compile` to a binary ⚠️ BLOCKED out of the box *(spiked 2026-05-31)*
Compile `server.ts` to a standalone executable in CI; ship a binary with **no `node_modules` at runtime**.
- **Spike result:** Compiles clean (101MB, 1671 modules, exit 0) but **crashes on boot** with `ReferenceError: require is not defined`. Root cause: two deps do a bare `require('crypto')` in CJS that `--compile` does not resolve at runtime — **`@tobyg74/tiktok-api-dl`** (obfuscated `helper/xbogus.js`, `helper/webmssdk.js`) and **`@google/genai`** (`dist/tokenizer/node.cjs`).
- **Pros (if unblocked):** Deletes the elysia-version question for the container entirely (baked into the binary); smallest runtime image; no install step; catalog/overrides irrelevant for the container; Turborepo-independent.
- **Cons / reality:** The headline "zero node_modules" win is **not free** — to ship B you'd have to `--external` the two offending deps and install *them* at runtime (a partial node_modules, so the install step returns), or patch/shim their `require('crypto')`. Either path adds maintenance and re-introduces a version surface. Also: 101MB binary; harder to hot-debug.
- **Best when:** The externalize-two-deps compromise is acceptable, or those deps get dropped/replaced (e.g. tiktok-dl swapped for a fetch-based call).

### C) Status quo (explicit "not now")
Leave it standalone, but record the decision and a re-evaluation condition.
- **Pros:** Zero work; already isolated.
- **Cons:** elysia keeps drifting; the override does nothing for it; permanent policy exception. **Only acceptable if recorded with a tracked condition — never the silent default.**
- **Best when:** Bandwidth is zero and the drift hasn't bitten.

### Recommendation *(updated after spike)*
**The B spike hit a wall**, so the cheap clean win is off the table without a compromise. Revised stance:

- **Default to A (workspace-ify)** as the principled path — it obeys the policy (container_src is code we author), and the Docker-prune complexity rides on the Turborepo migration that's arriving anyway. Sequence it *with* Turborepo.
- **B stays viable only if** you accept externalizing `@tobyg74/tiktok-api-dl` + `@google/genai` (partial node_modules) **or** those deps get dropped/replaced. If the tiktok dependency is already on the chopping block, revisit B — it becomes clean again.
- **C (status quo)** is the honest near-term answer *if* Turborepo isn't close: leave container_src standalone, but record the decision + condition ("re-evaluate when Turborepo lands or tiktok-dl is replaced"). Never silent.

**Net:** the container decision is now genuinely coupled to (a) the Turborepo timeline and (b) the fate of the tiktok-dl dependency. Both are inputs the planner needs before committing.

---

## Open Questions (parked for planning)

1. ~~`expo-sqlite` — keep or fold?~~ **RESOLVED 2026-05-31:** override is redundant (only hard requirer is `apps/expo`; others are optional peers). Drop it.
2. ~~Does `bun build --compile` survive the container's deps?~~ **RESOLVED 2026-05-31:** No — runtime `require('crypto')` crash from `@tobyg74/tiktok-api-dl` + `@google/genai`. B is blocked without externalizing those two deps. See revised container recommendation.
3. **Is the tiktok-dl dependency staying?** `@tobyg74/tiktok-api-dl` is one of the two blockers for option B *and* an obfuscated third-party lib. If it's replaceable (e.g. a direct fetch-based call), that simultaneously unblocks B and removes a supply-chain liability. **New question surfaced by the spike.**
4. **Enforcement — how do overrides not rot again?** A `check:no-undocumented-overrides` lint (sibling to existing `check:catalog` / `no-duplicate-deps.ts`) that fails CI if an `overrides` entry lacks a rationale comment. Parked as an open question, not a required section — but the policy is only as durable as its enforcement.
5. **Sequencing vs Turborepo.** The policy and override audit are Turborepo-independent and can land now. The container decision is now coupled to the Turborepo timeline (option A) — decide whether to ship the audit immediately and handle the container as a fast-follow.
6. **Cloudflare has no monorepo-Dockerfile opinion** — whichever container path we pick, we're writing the convention ourselves. Worth a one-paragraph note in the eventual ADR so the next person doesn't re-derive it.

---

## Success Criteria

- A maintainer (or agent) can read the policy table and correctly classify a new dependency into workspace / catalog / override / plain-direct **without reading git history**.
- Root `overrides` contains only transitive/fork forces, each with an inline rationale + removal condition.
- `elysia` resolves via catalog for all workspace consumers; the override is gone.
- `container_src` is no longer an undocumented exception — it's either a workspace, a compiled binary, or a recorded "not now" with a condition.
- (Stretch) CI rejects an undocumented override.

---

## Dependencies / Assumptions

- **Verified fact (2026-05-31):** `expo-sqlite`'s override is redundant — `bun pm why` confirms `apps/expo` is the only hard requirer; the rest are optional peers.
- **Verified fact (2026-05-31):** the container does **not** `bun build --compile` cleanly — runtime `require('crypto')` crash from `@tobyg74/tiktok-api-dl` + `@google/genai`. Compile itself succeeds (101MB); runtime is the failure.
- **Fact:** `bun prune --docker` is tracked (oven-sh/bun#28600 / PR #28601) but **not shipped** — so option A's dedup leans on Turborepo's prune, not Bun's.
- **Fact:** the Turborepo migration is a separate in-flight branch; this policy is compatible with it but not gated on it (except container option A).

---

## Handoff

Ready for `/ce-plan`. The two pre-planning checks are **done** (results folded in above):
- `expo-sqlite` override → drop (redundant).
- `bun build --compile` → blocked at runtime; option B is no longer the cheap win.

The planner should:
1. **Ship the override audit now** (Turborepo-independent): drop `typebox` + `expo-sqlite`, move `elysia` → catalog, add rationale comments to `react` + `nativewindui`. This is a tight, low-risk PR.
2. **Defer the container decision** behind two inputs: the Turborepo timeline (favors A) and whether `@tobyg74/tiktok-api-dl` survives (its removal would unblock B). Treat as a fast-follow, not part of the audit PR.
3. **Decide enforcement scope** (open question #4): is `check:no-undocumented-overrides` in the audit PR or a separate one?
