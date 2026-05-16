---
title: "chore: enroll remaining catalog candidates into Bun workspace catalog"
type: chore
status: active
date: 2026-05-13
---

# chore: enroll remaining catalog candidates into Bun workspace catalog

The Bun workspace catalog exists at the root `package.json` with 46 entries and a pre-push
enforcement script (`scripts/lint/no-duplicate-deps.ts`). That script currently emits 47
**CATALOG CANDIDATE** warnings for third-party deps pinned at the same version in 2+ workspaces.
These are non-blocking today but represent unnecessary drift risk — any future version bump in one
workspace would silently create a VERSION MISMATCH (which IS blocking).

This chore eliminates all warnings by enrolling every third-party candidate into the catalog.

## Acceptance Criteria

- [ ] `bun ./scripts/lint/no-duplicate-deps.ts` produces **0 CATALOG CANDIDATES** for third-party packages
- [ ] **0 CATALOG VIOLATIONS** and **0 VERSION MISMATCHES** (must remain at zero)
- [ ] `bun run check-types` exits 0 after changes
- [ ] `bun install` re-run to sync lockfile after package.json edits

## Pattern

**Two-step for each candidate:**

1. Add an entry to the `"catalog"` object in root `package.json`:
   ```json
   "package-name": "^x.y.z"
   ```
2. In every workspace `package.json` that pins that dep, replace the explicit version with:
   ```json
   "package-name": "catalog:"
   ```

**Do NOT catalog:** `workspace:*` references (`@packrat/guards`, `@packrat/env`, etc.) — these use
the workspace protocol, not semver, and should stay as `"workspace:*"`.

## Packages to Enroll

All 47 are currently at a **consistent version** across all workspaces (no mismatches), so the
catalog version is simply the existing pinned string.

### @-scoped

| Package | Version | Appears in |
|---|---|---|
| `@ai-sdk/openai` | `^3.0.53` | apps/guides, packages/api |
| `@cloudflare/workers-types` | `^4.20250405.0` | packages/mcp, packages/api |
| `@duckdb/node-api` | `1.5.0-r.1` | packages/cli, packages/analytics |
| `@hookform/resolvers` | `^5.2.2` | apps/landing, apps/guides |
| `@lhci/cli` | `^0.14.0` | apps/landing, apps/guides |
| `@neondatabase/serverless` | `^1.0.0` | packages/api, packages/osm-db |
| `@tanstack/react-query` | `^5.70.0` | apps/web, apps/admin, apps/expo, apps/guides, packages/app |
| `@tanstack/react-query-devtools` | `^5.70.0` | apps/web, apps/guides |
| `@types/bun` | `latest` | packages/cli, packages/api, packages/analytics |
| `@types/leaflet` | `^1.9.21` | apps/trails, apps/admin, apps/expo |
| `@types/node` | `^25.6.0` | apps/trails, apps/landing, apps/web, apps/admin, apps/guides |
| `@types/react` | `~19.2.10` | apps/trails, apps/landing, apps/web, apps/admin, apps/expo, apps/guides, packages/web-ui |
| `@types/react-dom` | `^19.1.6` | apps/trails, apps/landing, apps/web, apps/admin, apps/guides |
| `@vitest/coverage-v8` | `~3.1.4` | apps/expo, packages/mcp, packages/api |

### Unscoped

| Package | Version | Appears in |
|---|---|---|
| `autoprefixer` | `^10.4.21` | apps/landing, apps/web, apps/guides |
| `better-auth` | `^1.6.9` | apps/expo, packages/api |
| `class-variance-authority` | `^0.7.1` | apps/trails, apps/landing, apps/admin, apps/expo, apps/guides, packages/web-ui |
| `clsx` | `^2.1.1` | apps/trails, apps/landing, apps/admin, apps/expo, apps/guides, packages/web-ui |
| `cmdk` | `1.1.1` | apps/landing, apps/guides, packages/web-ui |
| `consola` | `^3.4.2` | packages/cli, packages/analytics |
| `date-fns` | `^4.1.0` | apps/landing, apps/expo, apps/guides |
| `drizzle-kit` | `^0.31.10` | packages/api, packages/osm-db |
| `drizzle-orm` | `^0.45.2` | packages/api, packages/osm-db |
| `embla-carousel-react` | `8.6.0` | apps/landing, apps/guides, packages/web-ui |
| `google-auth-library` | `^10.1.0` | apps/expo, packages/api |
| `gray-matter` | `^4.0.3` | apps/guides, packages/api |
| `input-otp` | `1.4.1` | apps/trails, apps/landing, apps/guides, packages/web-ui |
| `jotai` | `^2.12.2` | apps/web, apps/expo, packages/app |
| `leaflet` | `^1.9.4` | apps/trails, apps/admin, apps/expo |
| `lucide-react` | `^1.8.0` | apps/trails, apps/landing, apps/web, apps/admin, apps/guides, packages/web-ui |
| `next` | `^15.3.4` | apps/trails, apps/landing, apps/web, apps/admin, apps/guides |
| `next-themes` | `^0.4.6` | apps/landing, apps/web, apps/admin, apps/guides, packages/web-ui |
| `pg` | `^8.16.3` | packages/osm-import, packages/api, packages/osm-db |
| `postcss` | `^8.5.6` | apps/trails, apps/landing, apps/web, apps/admin, apps/guides |
| `postcss-import` | `^16.1.1` | apps/trails, apps/landing, apps/admin, apps/guides |
| `react-day-picker` | `9.14.0` | apps/landing, apps/guides, packages/web-ui |
| `react-hook-form` | `^7.58.1` | apps/landing, apps/guides, packages/web-ui |
| `react-leaflet` | `^5.0.0` | apps/trails, apps/expo |
| `react-resizable-panels` | `^4.10.0` | apps/landing, apps/guides, packages/web-ui |
| `recharts` | `3.8.1` | apps/web, apps/admin, packages/web-ui |
| `sonner` | `^2.0.7` | apps/trails, apps/landing, apps/admin, apps/guides, packages/web-ui |
| `tailwind-merge` | `^3.5.0` | apps/trails, apps/landing, apps/admin, apps/expo, apps/guides, packages/web-ui |
| `tailwindcss-animate` | `^1.0.7` | apps/web, packages/web-ui |
| `vaul` | `^1.1.2` | apps/landing, apps/guides, packages/web-ui |
| `vitest` | `~3.1.4` | apps/expo, packages/overpass, packages/mcp, packages/units, packages/api, packages/analytics |
| `wrangler` | `^4.21.2` | packages/mcp, packages/api |
| `ws` | `^8.18.1` | packages/api, packages/osm-db |

## Implementation Steps

- [ ] Add all 47 packages to the `"catalog"` section of root `package.json` (alphabetical order, interleaved with existing entries)
- [ ] For each workspace listed in the table, replace the pinned version with `"catalog:"`
- [ ] Run `bun install` to regenerate the lockfile
- [ ] Run `bun run check-types` — must exit 0
- [ ] Run `bun ./scripts/lint/no-duplicate-deps.ts` — must show 0 CATALOG CANDIDATES (for third-party; `workspace:*` refs are expected to remain)

## Context

- Root catalog: `package.json` lines ~76–123
- Enforcement script: `scripts/lint/no-duplicate-deps.ts`
- Pre-push hook: `lefthook.yml` (`pre-push.clean-checks`)
- Related PR: #2414 (type system unification — landed on the same branch pattern)

## Sources

- Enforcement script: `scripts/lint/no-duplicate-deps.ts`
- Root catalog: `package.json` (catalog section)
- Bun workspace catalog docs: https://bun.sh/docs/install/workspaces
