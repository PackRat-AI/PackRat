# Monorepo Dependency Policy

How PackRat decides where a shared dependency version lives. Three primitives, three jobs — pick by **what kind of thing** the dependency is, not by habit.

| Primitive | Use when | What it does | Visible where |
|---|---|---|---|
| **Workspace** (`workspace:*`) | It's code we author | Resolves to the in-repo package; one canonical copy | Each consumer's `package.json` |
| **Catalog** (`catalog:`) | Multiple workspaces declare the **same direct dep** and must agree on its version | Names one version centrally; consumers write `catalog:` | Every consumer site + root `catalog` |
| **Overrides** | We must force a **transitive** we don't declare (security pin, broken upstream range, a fork) | Forces a version across the **entire** tree, including transitives | Root `package.json` only — invisible at consumer sites |

## The rule

1. **Is it code we author?** → make it a **workspace**.
2. **Do multiple workspaces declare it directly, and must they agree** (shared framework, type-coupled client/server, single-copy invariant)? → **`catalog:`**.
3. **Are we forcing a _transitive_ we don't declare** (CVE patch, a broken upstream pin, a fork build)? → **`overrides`** — and document it in the registry below.
4. **None of the above** (single workspace, ordinary direct dep)? → just declare it directly. No catalog, no override.

**Corollary — overrides are an escape hatch, not a version-alignment tool.** If you reach for an override to make two *workspaces* agree on a *direct* dep, you've picked the wrong primitive — that's catalog's job. Overrides exist for what catalog can't reach: transitives and forks.

## Why overrides are documented here, not in `package.json`

`package.json` is strict JSON and cannot carry comments, so an override's rationale has nowhere to live next to it. Every root `overrides` entry must therefore be justified in the **override registry** below: why it exists and the condition under which it can be removed. The `check:overrides` lint (`scripts/lint/no-undocumented-overrides.ts`) enforces this — it fails CI if a root override has no registry entry, or if a registry entry references an override that no longer exists.

## Override registry

Each surviving root override and why it's load-bearing:

- **`react`** — React must resolve to a single copy across React Native, the web apps, and admin. `react-dom`, `react-native`, and essentially every UI library pull `react` transitively; two copies produce "invalid hook call" failures. The override forces one version across all those transitive requirers — a job `catalog:` (direct declarations only) cannot do. Removable once a single transitive `react` is guaranteed without forcing.

`@packrat-ai/nativewindui` remains override-governed because it is the shared
mobile UI surface and its transitive React Native peer graph must stay aligned
with the Expo SDK pin. Remove the override only after the wrapper package and
Expo app can consume the same upstream range without forcing.

The block below is the **authoritative, machine-checked** form of the registry. The `check:overrides` lint parses the single fenced ```json block that follows this heading. Contract: keys are the exact package names that appear in root `overrides`; each value has non-empty `reason` and `removeWhen` string fields. Keep this block in sync with the root `overrides` block — adding an override without a matching entry here (or vice versa) fails the lint.

```json
{
  "@packrat-ai/nativewindui": {
    "reason": "Forces one NativeWind UI version across the Expo app, @packrat/ui wrapper, and transitive peer graph while the migration off direct nativewindui imports is still in progress.",
    "removeWhen": "All app imports route through @packrat/ui wrappers and the upstream package range works with the pinned Expo SDK without forcing."
  },
  "@sinclair/typebox": {
    "reason": "Pins the Elysia/OpenAPI transitive schema package to a version compatible with the API route typing and generated OpenAPI surface.",
    "removeWhen": "Elysia and its plugins converge on a compatible typebox range without an override."
  },
  "elysia": {
    "reason": "Keeps Elysia and plugin transitives on the 1.4 line used by the Cloudflare Worker API until plugin ranges catch up together.",
    "removeWhen": "All Elysia plugins used by packages/api accept the same current Elysia range without forcing."
  },
  "expo-sqlite": {
    "reason": "Forces the Expo SDK 55-compatible sqlite package across Jotai/SQLite storage consumers and transitive Expo modules.",
    "removeWhen": "Expo SDK and dependent packages resolve expo-sqlite to the SDK-compatible version without an override."
  },
  "react": {
    "reason": "Unifies the many transitive react copies (react-dom, react-native, every UI library) into one version; two copies cause invalid-hook-call failures. catalog: governs direct declarations only, so it cannot force the transitive requirers.",
    "removeWhen": "A single transitive react version is guaranteed across RN + web + admin without forcing."
  }
}
```

## Not governed here

- The broader `catalog` block (dozens of entries) is governed by `check:catalog` (`scripts/lint/no-duplicate-deps.ts`), which flags direct deps that should move to the catalog and catalog violations.
- `packages/api/container_src` is intentionally **not** a workspace (it ships as a standalone container with its own `bun.lock`), so root overrides and the catalog do not reach it. Its dependency strategy is tracked separately.
