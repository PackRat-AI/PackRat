---
title: "refactor: extract @packrat/db and @packrat/schemas from packages/api"
type: refactor
status: active
date: 2026-05-14
---

# refactor: extract @packrat/db and @packrat/schemas from packages/api

## Overview

`packages/api` currently serves two incompatible roles: a Cloudflare Worker (deployed binary, CF-specific deps) and a shared schema/type library imported by every consumer in the monorepo. This plan extracts the Drizzle schema + drizzle-zod generated schemas into `@packrat/db`, and the route-level Zod schemas into `@packrat/schemas`. Frontend apps get a clean import path with no CF Workers leakage. Migration infra is unchanged.

## Problem Statement

**Leaky abstraction.** `apps/expo`, `packages/app`, `apps/admin`, and `apps/guides` import from `@packrat/api`. That package has `compatibility_flags: ["nodejs_compat"]`, `wrangler.jsonc`, and CF Workers-specific deps. Frontend toolchains encounter server-only types — fragile and semantically wrong.

**Schema duplication.** Hand-written Zod schemas in `packages/api/src/schemas/` duplicate the shape of Drizzle tables. `drizzle-zod` can generate the base layer from the table definitions, making the DB the single source of truth. This is only possible if the Drizzle schema lives in a package that `@packrat/schemas` can import from without a circular dep.

**`packages/app` entity re-exports are vestigial.** After PR #2414, `packages/app/src/entities/*/schema.ts` are 3-line re-export passthroughs to `@packrat/api/schemas/*`. Once `@packrat/schemas` exists, they have a real home.

## Proposed Solution

Two new packages, created in order:

### `packages/db` → `@packrat/db` (foundation)

Pure Drizzle + drizzle-zod. No Zod dep. No CF Workers bindings.

Contains:
- `src/schema.ts` — Drizzle table definitions (moved from `packages/api/src/db/schema.ts`)
- `src/zod-schemas.ts` — drizzle-zod generated base schemas (`createSelectSchema(users)`, `createInsertSchema(packs)`, etc.) — moved from `packages/api/src/db/zod-schemas.ts`
- `src/constants.ts` — raw `as const` arrays + TypeScript types only (`PACK_CATEGORIES`, `PackCategory`, `WEIGHT_UNITS`, `WeightUnit`, etc.) — no Zod dep needed
- `src/validation.ts` — `ValidationError` interface only (plain TypeScript, no Zod) — used by `schema.ts` as `.$type<ValidationError[]>()`
- `src/index.ts` — re-exports all of the above

Does **not** contain:
- DB client factories (`createDb`, `createReadOnlyDb`) — stay in `packages/api/src/db/index.ts`
- `drizzle.config.ts`, `drizzle/` migrations — stay in `packages/api` (see Migration Infra below)
- Any Zod schemas — those belong in `@packrat/schemas`

**`package.json` for `@packrat/db`:**
```json
{
  "name": "@packrat/db",
  "version": "0.0.0",
  "private": true,
  "exports": {
    ".": { "types": "./src/index.ts", "default": "./src/index.ts" },
    "./*": { "types": "./src/*", "default": "./src/*" }
  },
  "dependencies": {
    "drizzle-orm": "catalog:",
    "drizzle-zod": "catalog:"
  }
}
```

Note: `drizzle-zod` v0.8.3 explicitly supports `"zod": "^3.25.0 || ^4.0.0"` — no compatibility issue.

### `packages/schemas` → `@packrat/schemas` (depends on db)

Route-level Zod schemas. Depends on `@packrat/db`. No Elysia. No CF Workers bindings.

The drizzle-zod chain: `@packrat/db` generates base schemas from tables → `@packrat/schemas` extends/picks/transforms them for routes:
```typescript
// single source of truth
import { selectUserSchema } from '@packrat/db/zod-schemas';
export const UserProfileSchema = selectUserSchema
  .pick({ id: true, email: true, firstName: true, ... })
  .extend({ createdAt: z.string().datetime() });
```

Contains:
- Route-level Zod schemas extending drizzle-zod output (packs, catalog, trips, feed, guides, users, etc.)
- Hand-written schemas for non-DB types (weather, upload, chat, AI, guides search, etc.)
- Zod enum wrappers around raw constants from `@packrat/db`: `PackCategorySchema = z.enum(PACK_CATEGORIES)`
- `ValidationErrorSchema` (Zod schema wrapping `ValidationError` interface from `@packrat/db`)
- Inferred TypeScript types

Does **not** contain:
- `admin.ts` — uses Elysia TypeBox `t`; stays in `packages/api/src/schemas/`
- Raw Drizzle table definitions or DB connection code

**`package.json` for `@packrat/schemas`:**
```json
{
  "name": "@packrat/schemas",
  "version": "0.0.0",
  "private": true,
  "exports": {
    ".": { "types": "./src/index.ts", "default": "./src/index.ts" },
    "./*": { "types": "./src/*", "default": "./src/*" }
  },
  "dependencies": {
    "zod": "catalog:",
    "@packrat/db": "workspace:*",
    "@packrat/guards": "workspace:*"
  }
}
```

### `packages/api` — 3 re-export shims + 1 dep, nothing else

The only changes to `packages/api`:

1. `src/db/schema.ts` → `export * from '@packrat/db/schema';`
2. `src/types/constants.ts` → `export * from '@packrat/schemas/constants';` (which itself re-exports raw arrays from `@packrat/db/constants` — single shim covers both layers)
3. `src/types/validation.ts` → `export * from '@packrat/schemas/validation';`
4. `package.json` → add `"@packrat/db": "workspace:*"` and `"@packrat/schemas": "workspace:*"`

Everything else in `packages/api` is **unchanged**: routes, services, middleware, db client factories, env-validation, `drizzle.config.ts`, `drizzle/` migrations, `db:generate` script.

## Dependency Graph

```
@packrat/guards

@packrat/db        (drizzle-orm, drizzle-zod — no Zod)
  │  Drizzle tables, raw enum arrays/types, drizzle-zod generated schemas
  ↓
@packrat/schemas   (zod, @packrat/db, @packrat/guards)
  │  Zod enum wrappers, route schemas extending drizzle-zod output
  ↓
@packrat/api       (elysia, CF Workers, @packrat/db, @packrat/schemas, ...)
  │  Routes, middleware, DB client factories, migrations
  ↓
@packrat/api-client  (eden treaty, @packrat/api type App)
  ↓
apps/expo, apps/web, apps/admin, apps/guides, packages/app
```

## Migration Infra — Zero Changes

`drizzle.config.ts` stays in `packages/api` pointing at `./src/db/schema.ts`. That file is now a 1-line re-export shim. drizzle-kit v0.31 loads schema files via `require()` + `Object.values(exports)` — it follows re-exports transparently (verified from source at `node_modules/drizzle-kit/bin.cjs` lines 15893–15920). The `drizzle/` migrations folder, `db:generate` script, `db:migrate` script — all unchanged.

## Implementation Phases

### Phase 1: Create `@packrat/db`

**Deliverables:**
- New `packages/db/` with `package.json`, `tsconfig.json`, `src/index.ts`
- Move `packages/api/src/db/schema.ts` → `packages/db/src/schema.ts`
  - Update import `from '@packrat/api/types/constants'` → `from './constants'`
  - Update import `from '../types/validation'` → `from './validation'`
- Move `packages/api/src/db/zod-schemas.ts` → `packages/db/src/zod-schemas.ts`
  - Update import `from './schema'` — stays the same (local)
- Extract to `packages/db/src/constants.ts` (raw arrays + TS types only, no Zod):
  - `PACK_CATEGORIES`, `PackCategory`
  - `ITEM_CATEGORIES`, `ItemCategory`
  - `WEIGHT_UNITS`, `WeightUnit`
  - `AVAILABILITY_VALUES`, `Availability`
  - `ItemLink`, `ItemReview` (plain TS interfaces)
- Extract to `packages/db/src/validation.ts`: `ValidationError` interface only (no Zod)
- Add re-export shim `packages/api/src/db/schema.ts` → `export * from '@packrat/db/schema'`
- Add re-export shim `packages/api/src/db/zod-schemas.ts` → `export * from '@packrat/db/zod-schemas'`
- Add `@packrat/db` to root `tsconfig.json` path aliases and `package.json` workspaces
- Add `"@packrat/db": "workspace:*"` to `packages/api/package.json`

**`tsconfig.json` for `packages/db`:**
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src"]
}
```

**Success criteria:**
- `bun check-types` exits 0
- `bun run --cwd packages/api db:generate` still works (drizzle-kit follows re-export shim)
- `packages/api` routes still resolve Drizzle tables via `@packrat/api/db/schema` (through shim)

### Phase 2: Create `@packrat/schemas`

**Deliverables:**
- New `packages/schemas/` with `package.json`, `tsconfig.json`, `src/index.ts`
- Move (copy → delete) from `packages/api/src/schemas/` → `packages/schemas/src/`:
  - `ai.ts`, `auth.ts`, `catalog.ts`, `chat.ts`, `feed.ts`, `guides.ts`
  - `imageDetection.ts`, `packTemplates.ts`, `packs.ts`, `seasonSuggestions.ts`
  - `trailConditions.ts`, `trips.ts`, `upload.ts`, `users.ts`, `weather.ts`
- Create `packages/schemas/src/constants.ts`:
  ```typescript
  export * from '@packrat/db/constants'; // re-export raw arrays + TS types
  import { PACK_CATEGORIES, ITEM_CATEGORIES, WEIGHT_UNITS, AVAILABILITY_VALUES } from '@packrat/db/constants';
  export const PackCategorySchema = z.enum(PACK_CATEGORIES);
  export const ItemCategorySchema = z.enum(ITEM_CATEGORIES);
  export const WeightUnitSchema = z.enum(WEIGHT_UNITS);
  export const AvailabilitySchema = z.enum(AVAILABILITY_VALUES);
  // ... inferred types
  ```
- Create `packages/schemas/src/validation.ts`:
  ```typescript
  export type { ValidationError } from '@packrat/db/validation';
  export const ValidationErrorSchema = z.object({ ... });
  export const ValidationErrorsSchema = z.array(ValidationErrorSchema);
  ```
- Add 1-line re-export shims in `packages/api/src/schemas/*.ts` (except `admin.ts`) → `@packrat/schemas/*`
- Replace `packages/api/src/types/constants.ts` with: `export * from '@packrat/schemas/constants'`
- Replace `packages/api/src/types/validation.ts` with: `export * from '@packrat/schemas/validation'`
- Cleanup: `CatalogItemSchema`, `PackItemSchema`, `PackSchema`, `UserSchema` currently live in `constants.ts` but belong in their respective schema files (`catalog.ts`, `packs.ts`, `users.ts`). Remove the duplicates from `constants.ts` during this move.
- Add `@packrat/schemas` to root `tsconfig.json` path aliases and `package.json` workspaces
- Add `"@packrat/schemas": "workspace:*"` to `packages/api/package.json`

**`tsconfig.json` for `packages/schemas`:**
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "paths": {
      "@packrat/db": ["../db/src/index.ts"],
      "@packrat/db/*": ["../db/src/*"],
      "@packrat/guards": ["../guards/src/index.ts"],
      "@packrat/guards/*": ["../guards/src/*"]
    }
  },
  "include": ["src"]
}
```

**Root `tsconfig.json` additions (both phases):**
```json
"@packrat/db": ["./packages/db/src/index.ts"],
"@packrat/db/*": ["./packages/db/src/*"],
"@packrat/schemas": ["./packages/schemas/src/index.ts"],
"@packrat/schemas/*": ["./packages/schemas/src/*"]
```

**Success criteria:**
- `bun check-types` exits 0
- `packages/api/src/schemas/catalog.ts` is a 1-line re-export
- `apps/expo` imports still resolve unchanged (re-export shims preserve all existing paths)
- `bun ./scripts/lint/no-duplicate-deps.ts` exits 0

### Phase 3: Migrate `packages/app` entities

Update 5 files in `packages/app/src/entities/`:
- `catalog/schema.ts` → `from '@packrat/schemas/catalog'`
- `pack/schema.ts` → `from '@packrat/schemas/packs'`
- `feed/schema.ts` → `from '@packrat/schemas/feed'`
- `trip/schema.ts` → `from '@packrat/schemas/trips'`
- `user/schema.ts` → `from '@packrat/schemas/users'`

Add `"@packrat/schemas": "workspace:*"` to `packages/app/package.json`.

**Success criteria:** `packages/app` has no `@packrat/api` imports.

### Phase 4: Direct consumer migration (optional)

Update `apps/expo` (35+ files), `apps/admin`, `apps/guides` to import from `@packrat/schemas` directly. The re-export shims make this fully deferrable — things work correctly without it.

```bash
grep -r "from '@packrat/api/schemas" apps/ packages/app/ --include="*.ts" --include="*.tsx" -l
grep -r "from '@packrat/api/types" apps/ packages/app/ --include="*.ts" --include="*.tsx" -l
```

### Phase 5: Incremental drizzle-zod migration (ongoing)

Replace hand-written Zod schemas that duplicate DB-backed shapes with drizzle-zod extensions:
```typescript
// before
export const TripSchema = z.object({ id: z.string(), name: z.string(), ... });

// after
import { selectTripSchema } from '@packrat/db/zod-schemas';
export const TripSchema = selectTripSchema.extend({ startDate: z.string().datetime().nullable(), ... });
```

This is incremental — schemas can be migrated one at a time, `bun check-types` after each.

## Acceptance Criteria

- [ ] `packages/db/` exists; `package.json` deps are only `drizzle-orm` and `drizzle-zod` (no Zod)
- [ ] `packages/schemas/` exists; `package.json` deps are `zod`, `@packrat/db`, `@packrat/guards`
- [ ] `bun check-types` exits 0 after each phase
- [ ] `bun ./scripts/lint/no-duplicate-deps.ts` exits 0 (catalog entries used correctly)
- [ ] `bun run --cwd packages/api db:generate` still works after Phase 1
- [ ] DB client factories, `drizzle.config.ts`, `drizzle/` migrations all stay in `packages/api`
- [ ] `packages/api/src/schemas/admin.ts` stays in `packages/api`
- [ ] Re-export shims mean zero changes to `apps/expo` through Phases 1–2
- [ ] Phase 3: `packages/app` has no `@packrat/api` imports
- [ ] Phase 4 (optional): no file outside `packages/api` imports from `@packrat/api/schemas/*`

## Risks — All Low

| Risk | Assessment | Mitigation |
|---|---|---|
| drizzle-kit can't follow re-export shim | **None** — verified from source (v0.31 uses `require()` + `Object.values(exports)`) | N/A |
| drizzle-zod incompatible with Zod v4 | **None** — v0.8.3 peer dep is `"zod": "^3.25.0 \|\| ^4.0.0"` | N/A |
| `ValidationError` circular dep | **None** — it's a plain TS interface; lives in `@packrat/db` with no Zod dep | N/A |
| Routes in `packages/api` break | **None** — all import via `@packrat/api/db/schema` which becomes a re-export shim | N/A |
| `better-auth` CLI needs stable schema path | **None** — `packages/api/src/db/schema.ts` path is preserved as a re-export shim | N/A |
| Phase 4 touches 35+ files in `apps/expo` | Medium — but fully deferrable; shims work indefinitely | Do with find-replace when ready |

## Sources & References

- `packages/api/src/db/schema.ts` — Drizzle table definitions (735 lines); moves to `@packrat/db`
- `packages/api/src/db/zod-schemas.ts` — drizzle-zod generated schemas; moves to `@packrat/db`
- `packages/api/src/types/constants.ts` — raw arrays + Zod enums + misplaced schemas; splits across `@packrat/db` and `@packrat/schemas`
- `packages/api/src/types/validation.ts` — `ValidationError` interface + Zod schema; splits across `@packrat/db` and `@packrat/schemas`
- `packages/api/src/schemas/` — 16 files; 15 move, `admin.ts` stays
- `packages/osm-db/` — existing monorepo template for a standalone Drizzle schema package
- PR #2414 — prerequisite; establishes clean schema boundaries and `app/entities/*` re-exports
- `docs/plans/2026-05-13-chore-enroll-catalog-candidates-plan.md` — `zod`, `drizzle-orm`, `drizzle-zod` already enrolled in catalog
