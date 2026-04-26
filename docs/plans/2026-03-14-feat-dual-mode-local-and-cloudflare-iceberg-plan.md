---
title: "feat: Dual-mode analytics — local DuckDB + Cloudflare R2 Data Catalog (Iceberg)"
type: feat
status: active
date: 2026-03-14
---

# Dual-Mode Analytics: Local DuckDB + Cloudflare R2 Iceberg

## Overview

Add a second connection mode to PackRat Analytics so the same 23 CLI commands can query either a **local DuckDB cache file** (current, default) or a **remote R2 Data Catalog Iceberg table** (new). No changes to the scraper pipeline — CSVs continue flowing into R2 as-is.

The user controls the mode via `ANALYTICS_MODE=local|catalog` in `.env`. A new `cache --publish` command pushes the local normalized data into the Iceberg catalog, making it queryable by DuckDB, Spark, Snowflake, or R2 SQL — all with zero egress fees.

## Problem Statement / Motivation

- The local cache works great for single-user CLI, but every user/CI job must independently download and materialize ~900K rows from R2 CSVs
- No shared queryable dataset — each machine builds its own cache
- No path for other tools (Spark, notebooks, BI dashboards) to query the same normalized data
- R2 Data Catalog (Iceberg) is free in beta, zero egress, and DuckDB 1.5 supports it natively — the timing is right

## Proposed Solution

### Architecture

```
Scraper → CSVs in R2 (unchanged)
               │
               ▼
  ┌─────────────────────────┐
  │ cache --refresh          │  (existing: CSV → local .duckdb)
  └─────────┬───────────────┘
            │
            ▼
  ┌─────────────────────────┐
  │ cache --publish          │  (new: local .duckdb → R2 Iceberg)
  └─────────┬───────────────┘
            │
            ▼
  ┌─────────────────────────┐
  │ R2 Data Catalog          │  (Iceberg tables: gear_data, price_history)
  │ queryable by DuckDB,     │
  │ Spark, Snowflake, R2 SQL │
  └─────────────────────────┘

CLI commands:
  ANALYTICS_MODE=local   → query local .duckdb     (fast, offline-capable)
  ANALYTICS_MODE=catalog → ATTACH Iceberg catalog   (shared, no local cache needed)
```

### Key Design Decision: Catalog Aliasing with USE

When DuckDB ATTACHes an Iceberg catalog, tables live under `catalog_name.namespace.table_name`. To avoid modifying all 23 commands (which reference `gear_data` unqualified), the catalog connection will:

1. `ATTACH '...' AS packrat (TYPE ICEBERG, ...)`
2. `USE packrat.default`

This sets the default search path so unqualified `gear_data` resolves to the Iceberg table. All existing query code works unchanged.

## Technical Approach

### Phase 1: Connection Factory + Env Schema (core plumbing)

**`src/core/env.ts`** — Make Zod schema mode-aware:

```typescript
const envSchema = z
  .object({
    ANALYTICS_MODE: z.enum(['local', 'catalog']).default('local'),

    // S3 credentials (required for local mode + publish)
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    PACKRAT_SCRAPY_BUCKET_R2_BUCKET_NAME: z.string().optional(),
    R2_BUCKET_NAME: z.string().optional(),
    R2_ENDPOINT_URL: z.string().url().optional(),
    CLOUDFLARE_ACCOUNT_ID: z.string().optional(),

    // Iceberg credentials (required for catalog mode + publish)
    R2_CATALOG_TOKEN: z.string().optional(),
    R2_CATALOG_URI: z.string().optional(),
    R2_WAREHOUSE_NAME: z.string().optional(),
  })
  .transform(/* ... */)
  .superRefine((data, ctx) => {
    // Validate required fields based on mode
    if (data.ANALYTICS_MODE === 'local') {
      if (!data.R2_ACCESS_KEY_ID) ctx.addIssue({ /* ... */ });
      if (!data.R2_SECRET_ACCESS_KEY) ctx.addIssue({ /* ... */ });
    }
    if (data.ANALYTICS_MODE === 'catalog') {
      if (!data.R2_CATALOG_TOKEN) ctx.addIssue({ /* ... */ });
      if (!data.R2_CATALOG_URI) ctx.addIssue({ /* ... */ });
      if (!data.R2_WAREHOUSE_NAME) ctx.addIssue({ /* ... */ });
    }
  });
```

**`src/core/connection.ts`** (new) — Connection factory:

```typescript
export async function createAnalyticsConnection(
  mode: 'local' | 'catalog',
): Promise<DuckDBConnection> {
  if (mode === 'local') {
    return createLocalConnection();     // existing local .duckdb path
  }
  return createCatalogConnection();     // new Iceberg ATTACH path
}

async function createCatalogConnection(): Promise<DuckDBConnection> {
  const instance = await DuckDBInstance.create(':memory:');
  const conn = await instance.connect();

  await conn.run('INSTALL httpfs; LOAD httpfs;');
  await conn.run('INSTALL iceberg; LOAD iceberg;');

  await conn.run(`CREATE SECRET r2_iceberg (
    TYPE ICEBERG,
    TOKEN '${env().R2_CATALOG_TOKEN}'
  )`);

  await conn.run(`ATTACH '${env().R2_WAREHOUSE_NAME}' AS packrat (
    TYPE ICEBERG,
    ENDPOINT '${env().R2_CATALOG_URI}',
    SECRET r2_iceberg
  )`);

  await conn.run('USE packrat.default');

  return conn;
}
```

Also extract the duplicated S3 credential setup from `engine.ts` and `local-cache.ts` into a shared `configureS3(conn)` helper in this same file.

**Files changed:**
- `src/core/env.ts` — add mode + Iceberg env vars
- `src/core/connection.ts` — new file, connection factory
- `src/core/engine.ts` — delete (superseded by connection factory)
- `src/core/local-cache.ts` — extract S3 config to shared helper

### Phase 2: Mode-Aware CLI Shared Layer

**`src/cli/shared.ts`** — Replace `ensureCache()` with mode-aware version:

```typescript
export async function ensureConnection(): Promise<LocalCacheManager> {
  if (_cache) return _cache;
  const mode = env().ANALYTICS_MODE;

  if (mode === 'catalog') {
    // Create a CatalogCacheManager that wraps the Iceberg connection
    // with the same interface as LocalCacheManager
    _cache = new CatalogCacheManager();
    await _cache.connect();
    return _cache;
  }

  // Local mode (current behavior)
  _cache = new LocalCacheManager();
  await _cache.connect();
  return _cache;
}
```

The key interface both managers share:

```typescript
interface AnalyticsManager {
  connect(): Promise<DuckDBConnection>;
  getConnection(): DuckDBConnection;
  getCacheStats(): { recordCount: number; sites: string[]; updatedAt?: string };
  close(): Promise<void>;
}
```

`LocalCacheManager` already satisfies this. A new `CatalogCacheManager` implements it by ATTACHing the Iceberg catalog. Both expose the same `gear_data` / `price_history` tables. All 15+ domain query methods on `LocalCacheManager` work for both because they use raw SQL against these tables.

**Decision: Inherit, don't duplicate.** `CatalogCacheManager` should extend `LocalCacheManager` and override only `connect()` and `createLocalCache()`. The domain query methods (search, comparePrices, etc.) are table-agnostic SQL — they work on any `gear_data` table.

**Files changed:**
- `src/core/catalog-cache.ts` — new file, extends LocalCacheManager
- `src/cli/shared.ts` — mode-aware factory
- `src/core/local-cache.ts` — extract shared interface

### Phase 3: `cache --publish` Command

**`src/cli/commands/cache.ts`** — Add `--publish` flag:

The publish flow:
1. Open the local `.duckdb` file as source
2. Create an Iceberg connection (ATTACH R2 Data Catalog)
3. Create schema + tables in Iceberg if they don't exist
4. DROP and recreate to avoid duplicates (Iceberg doesn't support MERGE in DuckDB)
5. `INSERT INTO packrat.default.gear_data SELECT * FROM local_gear.gear_data`
6. Same for `price_history`
7. Report row counts

```sql
-- Publish flow (simplified)
ATTACH 'data/cache/packrat_cache.duckdb' AS local_gear;
ATTACH '...' AS packrat (TYPE ICEBERG, ...);

CREATE SCHEMA IF NOT EXISTS packrat.default;
DROP TABLE IF EXISTS packrat.default.gear_data;
CREATE TABLE packrat.default.gear_data AS
  SELECT * FROM local_gear.gear_data;

DROP TABLE IF EXISTS packrat.default.price_history;
CREATE TABLE packrat.default.price_history AS
  SELECT * FROM local_gear.price_history;
```

Note: Using DROP + CREATE TABLE AS instead of INSERT to avoid schema drift issues. This means each publish is a full replace. Iceberg snapshot history is lost on each publish, but that's acceptable since the local cache is the authoritative source and price_history already tracks time-series data.

**Files changed:**
- `src/cli/commands/cache.ts` — add `--publish` flag
- `src/core/local-cache.ts` or `src/core/catalog-cache.ts` — publish logic

### Phase 4: Pipeline Enhancement — Direct CSV-to-Iceberg Ingestion

Since the user is open to pipeline improvements: add a `cache --ingest` command that reads CSVs from R2 directly into the Iceberg catalog, bypassing the local cache entirely. This is useful for CI/CD or a scheduled job.

```
cache --refresh   → R2 CSVs → local .duckdb        (existing)
cache --publish   → local .duckdb → R2 Iceberg     (Phase 3)
cache --ingest    → R2 CSVs → R2 Iceberg directly  (Phase 4, requires both S3 + Iceberg creds)
```

This combines the CSV-reading logic from `createLocalCache()` with the Iceberg write logic from publish. Both S3 and Iceberg credentials are required.

**Files changed:**
- `src/cli/commands/cache.ts` — add `--ingest` flag

## System-Wide Impact

- **No breaking changes.** Default mode is `local`, identical to current behavior. New env vars are all optional.
- **Extension loading order matters.** `httpfs` must be loaded before `ATTACH ICEBERG`. The connection factory handles this.
- **Credential separation.** S3 keys (access key + secret) are for httpfs/CSV access. Iceberg bearer tokens are for catalog access. Publish needs both.
- **23 CLI commands unchanged.** They call methods on the cache manager, which queries `gear_data` — the table name is the same regardless of mode.

## Acceptance Criteria

### Functional

- [x] `ANALYTICS_MODE=local` (or unset) works identically to today
- [x] `ANALYTICS_MODE=catalog` connects to R2 Data Catalog and queries Iceberg tables
- [x] All 23 CLI commands work in both modes without modification
- [x] `cache --publish` pushes `gear_data` + `price_history` to Iceberg catalog
- [x] `cache --ingest` reads CSVs directly into Iceberg (skipping local cache)
- [x] `cache --status` shows mode, record count, and last update in both modes
- [x] `cache --refresh` in catalog mode prints a helpful message (no-op)
- [x] Invalid `ANALYTICS_MODE` value fails with clear Zod error
- [x] Missing credentials for the selected mode fail with clear error listing what's needed
- [x] `PackRatEngine` class removed (dead code)

### Non-Functional

- [x] Existing 104 tests continue passing
- [ ] New tests for connection factory, catalog manager, env validation
- [ ] Smoke test script extended with `--mode catalog` option
- [x] `.env.example` updated with new Iceberg env vars (commented out)

## Dependencies & Risks

| Risk | Mitigation |
|------|-----------|
| R2 Data Catalog is beta — API could change | Iceberg REST is a standard; the ATTACH syntax is DuckDB-side, not CF-specific |
| Bearer token expiration mid-session | Catch auth errors, print "Token may be expired. Generate a new one at dash.cloudflare.com" |
| DuckDB Iceberg extension quirks in Node.js | Test with `@duckdb/node-api` v1.5 before building; prototype ATTACH flow first |
| Schema drift between local and Iceberg | Full replace on publish (DROP + CREATE TABLE AS) avoids drift |
| `COPY FROM DATABASE` limitations | Use `CREATE TABLE AS SELECT` instead for more control |

## Implementation Order

1. **Prototype first** — Write a standalone script that ATTACHes R2 Data Catalog via DuckDB Iceberg extension in Node.js. Verify: extension loading, CREATE SECRET, ATTACH, CREATE TABLE, INSERT, SELECT. This de-risks everything else.
2. Phase 1 — Connection factory + env schema
3. Phase 2 — Mode-aware CLI shared layer
4. Phase 3 — `cache --publish`
5. Phase 4 — `cache --ingest` (optional, can be deferred)

## Sources & References

### External
- [R2 Data Catalog docs](https://developers.cloudflare.com/r2/data-catalog/)
- [DuckDB + R2 Data Catalog config](https://developers.cloudflare.com/r2/data-catalog/config-examples/duckdb/)
- [DuckDB Iceberg REST Catalogs](https://duckdb.org/docs/stable/core_extensions/iceberg/iceberg_rest_catalogs)
- [DuckDB Iceberg Writes (Nov 2025)](https://duckdb.org/2025/11/28/iceberg-writes-in-duckdb)
- [R2 Data Catalog announcement](https://blog.cloudflare.com/r2-data-catalog-public-beta/)
- [R2 SQL deep dive](https://blog.cloudflare.com/r2-sql-deep-dive/)

### Internal
- `src/core/local-cache.ts` — current cache manager (query methods reused)
- `src/core/engine.ts` — existing remote engine (to be deleted)
- `src/core/env.ts` — Zod env schema (to be extended)
- `src/cli/shared.ts:13-33` — singleton factory (to be made mode-aware)
- `packages/api/src/db/index.ts:28` — API package connection factory pattern (reference)
