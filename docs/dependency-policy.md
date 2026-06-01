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
- **`@packrat-ai/nativewindui`** — pins the fork prerelease `2.0.3-2` over upstream resolution. Forcing our fork build across the tree is a legitimate escape-hatch use. The later `2.0.6` release raises its `react-native-keyboard-controller` peer floor to `^1.21.0`, which conflicts with Expo SDK 55's pinned `1.20.7`, so the bump is deferred until the SDK ships a compatible keyboard-controller. Removable when the fork merges upstream, or we move to a published release whose peer set matches the active Expo SDK.

The block below is the **authoritative, machine-checked** form of the registry. The `check:overrides` lint parses the single fenced ```json block that follows this heading. Contract: keys are the exact package names that appear in root `overrides`; each value has non-empty `reason` and `removeWhen` string fields. Keep this block in sync with the root `overrides` block — adding an override without a matching entry here (or vice versa) fails the lint.

```json
{
  "react": {
    "reason": "Unifies the many transitive react copies (react-dom, react-native, every UI library) into one version; two copies cause invalid-hook-call failures. catalog: governs direct declarations only, so it cannot force the transitive requirers.",
    "removeWhen": "A single transitive react version is guaranteed across RN + web + admin without forcing."
  },
  "@packrat-ai/nativewindui": {
    "reason": "Pins the fork prerelease 2.0.3-2 over upstream resolution; forcing our fork build across the tree is a legitimate override use. The 2.0.6 release requires react-native-keyboard-controller ^1.21.0, which conflicts with Expo SDK 55's pinned 1.20.7.",
    "removeWhen": "The fork merges upstream, or a published release's peer set (notably react-native-keyboard-controller) matches the active Expo SDK."
  }
}
```

## Not governed here

- The broader `catalog` block (dozens of entries) is governed by `check:catalog` (`scripts/lint/no-duplicate-deps.ts`), which flags direct deps that should move to the catalog and catalog violations.
- `packages/api/container_src` is intentionally **not** a workspace (it ships as a standalone container with its own `bun.lock`), so root overrides and the catalog do not reach it. Its dependency strategy is tracked separately.
