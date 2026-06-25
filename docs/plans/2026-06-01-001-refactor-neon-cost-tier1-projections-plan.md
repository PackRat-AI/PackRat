---
title: "refactor: Tier-1 Neon cost projections + executeSql byte guard"
status: active
created: 2026-06-01
type: refactor
depth: standard
origin: docs/brainstorms/2026-06-01-neon-cost-reduction-requirements.md
---

# refactor: Tier-1 Neon cost projections + executeSql byte guard

## Summary

Apply explicit column projections to the catalog + pack query paths that currently `SELECT *` from tables carrying a 1536-dim embedding and large JSONB content. Add a 1 MB row-byte budget to the `executeSql` AI tool so an agent can't pull tens of MB in a single call. Add a lint script + CI gate that prevents future regressions of the projection pattern. Characterization tests for the affected response shapes land first so projection changes can be verified non-regressive end-to-end.

This plan executes the Tier-1 portion of the audit findings plus a projection-discipline guard. The embedding-pivot-table structural fix and the `executeSql` security hardening (SQL injection bypass + table allowlist + readonly role audit) are follow-on plans.

**Cost-mechanism note.** The win is at the DB→Worker boundary, not Worker→Client. Stripping fields via Zod on the response only saves egress to the client; the Worker has already pulled and hydrated the row into memory and paid the Neon-side compute + DB-to-Worker bytes. Projection at the query layer is what stops the DB from sending the bytes in the first place. All tests and the U9 lint rule therefore target the SELECT / findFirst / findMany / `.returning` call sites, not response shapes.

---

## Problem Frame

Neon bill spiked this cycle ($33 compute + $14 egress, vs much lower historical baseline). Two drivers, both verified in code (see origin: `docs/brainstorms/2026-06-01-neon-cost-reduction-requirements.md`):

1. **ETL ingest** — `upsertCatalogItems` does `.returning()` untyped, shipping full catalog rows (embedding + fat JSONB) back from Postgres to the Worker on every 100-row batch. For a 30K-row CSV chunk that's ~30K × 50-100 KB of needless DB→Worker traffic per chunk.
2. **Hot-path query overfetch** — `db.select(...getTableColumns(...))`, `db.query.X.findFirst/findMany` with no `columns:` filter, and Drizzle relational `with: { foo: true }` joins ship embedding + fat JSONB on AI tool calls, REST list endpoints, and pack-detail views. A full catalog row is ~50-100 KB; list endpoints with `limit: 20-100` therefore ship 1-10 MB per request, mostly discarded.

The fix is mostly column projection — small, behavior-preserving, with disproportionate cost impact. The structural follow-on (move embeddings to pivot tables) is deferred to a separate plan.

---

## Requirements (from origin)

- **R1.** Cycle-over-cycle bill reduction, both compute and egress, no specific dollar target.
- **R2.** Eliminate the "untyped select ships embeddings" foot-gun via projection discipline at the seven Tier-1 callsites.
- **R3.** Preserve existing behavior — response shapes that include heavy JSONB stay as-is unless schema is intentionally split; only stop selecting columns whose values are then discarded.
- **R4.** Preserve vector search semantics — all confirmed-good destructure patterns stay.
- **R5.** Add `executeSql` row-byte budget so AI agents can't accidentally egress MBs of data per call.
- **R6.** Test coverage for response-shape regressions before merging.

Origin success criteria carried forward:
- Next month's Neon bill shows clear compute + egress drop (with comparable catalog ingest activity).
- No regressions in existing tests; no user-visible behavior change.
- Post-merge: every `db.select()` / `findFirst` / `findMany` against `catalog_items` or `pack_items` either explicitly projects columns or has documented justification for pulling the full row.

---

## Scope Boundaries

### In scope (this plan / this PR)

- Tier-1 projection fixes (7 callsites) from the audit table
- Tier-3 #12 (executeSql row-byte budget)
- Lint script + CI gate preventing future projection-discipline regressions (U9)
- Characterization tests for 7 endpoints (4 whose queries change, 3 baseline) plus ETL upsert return shape — wider safety net for the upcoming pivot migration
- Post-deploy verification checklist

### Deferred to Follow-Up Work

- **Embedding pivot tables** (`catalog_item_embeddings`, `pack_item_embeddings`) — separate plan
- **Tier-2 callsites** (#8-11 from origin: catalog `/:id/similar` source-item fetch, PUT/PATCH existing-item overfetch, `embeddings-stats` query consolidation, `DbUtils` overfetch) — explicitly tagged in origin to bundle with the pivot migration so each callsite is touched once
- **Tier-3 #13** (split `CatalogItemSchema` into list vs detail response schemas)
- **`executeSql` security hardening** — three concrete gaps surfaced during plan review: (a) `isReadOnlyQuery` validator is bypassable via SQL comment injection and multi-statement execution; (b) tool accepts arbitrary SELECT against the full schema including auth/session/user tables — sole protection is `NEON_DATABASE_URL_READONLY` role permissions, which the plan does not verify; (c) needs explicit table allowlist or DB-role audit. Address in a separate hardening plan; this plan's U7 only adds the cost-motivated byte budget.

### Outside this product's identity (per origin)

- Migrating off Postgres (Cloudflare D1 / SQLite)
- Adding cache layers (Redis, KV, edge cache)
- Changing Neon plan tier or driver topology
- Reworking the catalog data model beyond the embedding pivot

---

## Key Technical Decisions

### KTD1. Characterization-first execution posture

Land characterization tests for current response shapes in unit U1 BEFORE any projection change. Each subsequent unit must keep them green (with assertion deltas only where the projection intentionally changes wire shape). This catches: (a) embedding accidentally leaking through Zod, (b) a downstream consumer that depends on a "list" field we drop, and (c) any silent shape change a reviewer would miss in diff.

### KTD2. Projection scope on `upsertCatalogItems.returning()` — wider than `{id, sku}`

Origin recommends `.returning({id, sku})`. Implementation needs to be `{id, sku, name, description, categories, brand}` because the existing embedding-regen path at `catalogService.ts:378-409` compares input vs returned rows on the embedding-source fields (`name, description, categories, brand`) to decide whether to regen the embedding. Projecting only `{id, sku}` would either break the diff or force a second SELECT round-trip. The wider projection is still ~95% smaller than full-row return (drops embedding + reviews/qas/faqs/techs/links/variants/images and the smaller cols) so the cost win is largely preserved.

### KTD3. Wire-shape changes are tolerated where Zod schema permits

Several units (U4, U6) drop fields from the DB-side projection that mobile clients today receive as part of the JSON response. `CatalogItemSchema` (`packages/schemas/src/catalog.ts:6-97`) marks these fields `.nullable().optional()`, so Zod parsing of the response will not throw when a field is undefined. Risk: a mobile feature reads `item.reviews` on a list endpoint and now gets undefined — handled in Risks below.

### KTD4. 1 MB cumulative-result cap on `executeSql`

Computed via `JSON.stringify(rows).length` after query completes. Returns an actionable error message guiding the AI to project columns or reduce limit. Note: this is a post-execution check — Worker still paid the DB read. A Postgres-side limit would require query rewriting that's risky for an arbitrary AI-generated SQL string, so we trade DB-side perfection for guaranteed protection of Worker→client egress + LLM context cost.

### KTD5. Single PR, units sequenced by impact

All 8 units land in one PR. U1 (tests) commits first; U2-U7 follow in impact order (ETL fixes first → service projections → route projections → executeSql guard); U8 is post-deploy verification, not a code commit. Smaller PRs were considered (see synthesis) but rejected for ship speed; revert blast radius is mitigated by each unit being isolated to a single query.

### KTD6. Use Drizzle's `columns: { x: true, ... }` whitelist syntax for relational queries

Drizzle's relational query builder supports `columns:` (whitelist) but not an "exclude" inverse. For U5 and U6, every column to keep must be enumerated explicitly. Implementers may copy from `packages/db/src/schema.ts` and remove the field to drop.

---

## System-Wide Impact

| Surface | Impact |
|---|---|
| **Cloudflare Workers compute** | Reduced per-request CPU + memory allocation (less data hydrated from DB into JS objects). |
| **Neon egress (compute → app)** | Material reduction. Largest single source: U2 (ETL `.returning()`). |
| **Neon compute hours** | Indirect reduction — less data scanned = faster queries = compute returns to idle quicker. |
| **API response wire size to mobile (`apps/expo`)** | Reduced on list endpoints (U4, U6). `embedding` was already stripped by Zod; fat JSONB now dropped on list contexts. |
| **AI tools (Vercel AI SDK)** | `getCatalogItems` AI tool returns smaller `data` payload; `executeSql` adds a new error case for >1 MB results. |
| **Other apps (`apps/guides`, `apps/landing`, `apps/web`, `apps/admin`)** | If any consume `GET /catalog` list or `GET /packs/:id/items`, they'll see the same wire-shape change as mobile. Audit via grep of `apps/*/` for these fields' usage on list contexts. |
| **Tests** | New characterization suite; existing integration tests must continue to pass without modification (except for the few that explicitly assert presence of fat JSONB on list responses, which become baseline-of-the-old-shape and need updating). |
| **Eden Treaty types** | No change — the Drizzle return type narrowing is internal; route response Zod schemas are unchanged. |

---

## Implementation Sequencing

```
U1 (characterization tests) → must merge to feature branch first
      │
      ├──> U2 (upsertCatalogItems.returning)
      ├──> U3 (handleEmbeddingsBatch select)
      ├──> U4 (getCatalogItems service)
      ├──> U5 (getPackDetails service)
      ├──> U6 (pack route projections — 3 endpoints)
      └──> U7 (executeSql byte budget)   ← independent; can land anytime after U1
              │
              v
            U9 (lint script + CI gate)    ← MUST land after U2-U6 so existing fixed code passes
              │
              v
            PR opens, merges
              │
              v
            U8 (post-deploy verification) — runs after merge + deploy
```

U2-U7 can be implemented in any order once U1 is green. Recommended order by impact: U2 → U4 → U6 → U5 → U3 → U7. U9 must land after U2-U6 so the rule doesn't flag existing pre-fix code.

---

## Implementation Units

### U1. Characterization tests for affected response shapes

**Goal:** Lock current API response body shape for 7 endpoints (4 changing + 3 baseline) plus ETL upsert return shape, so subsequent projection changes can't silently regress.

**Requirements:** R6 (test coverage), supports R3 (no behavior regression).

**Dependencies:** none — first unit.

**Files:**
- `packages/api/test/catalog.test.ts` — extend with shape characterization for `GET /catalog`, `GET /catalog/:id`, `GET /catalog/:id/similar`, `GET /catalog/vector-search`
- `packages/api/test/packs.test.ts` — extend with shape characterization for `GET /packs`, `GET /packs/:packId/items`, `GET /packs/:packId/weight-breakdown`
- `packages/api/test/etl.test.ts` — extend with assertion on `upsertCatalogItems` return shape (current: full rows; after U2: subset)
- `packages/api/test/utils/db-helpers.ts` — add helper `seedFullCatalogItem(...)` that populates fat JSONB (reviews, qas, faqs, techs, links, variants, images) + a deterministic 1536-dim embedding (e.g., `Array.from({length: 1536}, (_, i) => Math.sin(i)/2)`)
- `packages/api/test/fixtures/catalog-fixtures.ts` — fixture with all fat-JSONB cols populated

**Approach:**
- Seed a `catalogItems` row with every JSONB column populated and a synthetic embedding.
- Seed a `packs` row with two `packItems`, both linked to that catalog item, both with embeddings.
- Hit each endpoint via `apiWithAuth(...)`. For each response, assert (a) the EXACT set of top-level keys present, (b) absence of `embedding` key, (c) for list contexts, whether fat-JSONB keys are present (baseline today: present; the U4/U6 commits will flip this assertion).
- The test file should split per-endpoint into a `describe('shape contract', ...)` block so the assertions stay co-located.
- For ETL: spy/inspect the actual rows returned from `upsertCatalogItems` (the function returns `Pick<CatalogItem, 'id'>[]` per its signature but currently returns full rows — assertion documents reality).

**Execution note:** Test-first / characterization. Commit and push U1 alone; verify CI green; then sequence the projection units.

**Patterns to follow:**
- Test helpers: `packages/api/test/utils/test-helpers.ts` (`apiWithAuth`, `apiWithAdmin`, `apiWithApiKey`, `expectJsonResponse`)
- Seed helpers: `packages/api/test/utils/db-helpers.ts` (`seedCatalogItem`, `seedPack`, `seedPackItem`, `seedAndLoginTestUser`)
- Existing test style: `packages/api/test/catalog.test.ts:43-78`, `packages/api/test/packs.test.ts:1-50`

**Test scenarios:**
- `GET /catalog?limit=5` returns `{items: [...], totalCount, page, limit, totalPages}`. Each item has keys `{id, name, productUrl, sku, weight, weightUnit, description, categories, images, brand, model, ratingValue, color, size, price, availability, seller, productSku, material, currency, condition, reviewCount, variants, techs, links, reviews, qas, faqs, createdAt, updatedAt}`. No `embedding` key. (Post-U4: drop the fat JSONB keys from this assertion.)
- `GET /catalog/:id` for a populated item returns same key set + optional `usageCount`. No `embedding` key. (Stays as-is post-changes; baseline for pivot migration.)
- `GET /catalog/:id/similar` returns `{items: [...], total, sourceItem}`. `items[]` and `sourceItem` both have no `embedding` key. (Stays as-is; baseline.)
- `GET /catalog/vector-search?q=test` returns `{items: [...], total, limit, offset, nextOffset}`. Items have `similarity` field; no `embedding`. (Stays as-is; baseline.)
- `GET /packs` returns array of packs, each with `items[]`. **Wire-shape check:** today the response items already exclude `embedding` because `z.array(PackWithWeightsSchema).parse(...)` at `packs/index.ts:74` strips it via Zod's default `strip` mode (PackItemSchema does not declare `embedding`). Assert no `embedding` key today AND after U6. **DB-side check (the actual cost surface):** spy on the Drizzle query or assert at the service level that the `with: { items: ... }` call uses `columns: { ... }` whitelist after U6 — Zod stripping is downstream of the Worker pulling the bytes from Neon, so the cost win lives at the query layer regardless of wire shape.
- `GET /packs/:packId/items` returns `items[]`. Today each item has `embedding`; each `catalogItem` has `embedding` + full fat JSONB. Post-U6: assertion flips.
- `GET /packs/:packId/weight-breakdown` returns breakdown numbers matching a hand-computed expected (regression: numeric correctness post-U6).
- ETL: after `processValidItemsBatch` runs on 3 items, assert `upsertCatalogItems` (mocked or inspected) was called and returned an array of length 3. Today: full rows. Post-U2: `{id, sku, name, description, categories, brand}` subset.

**Verification:** All characterization tests pass on current `origin/development` HEAD (cb9f64d33) with no projection changes yet applied.

---

### U2. Project `upsertCatalogItems.returning()` to drop heavy fields

**Goal:** Stop shipping full catalog rows back from Postgres to the Worker on every ETL batch insert. Highest single-fix ETL-time impact.

**Requirements:** R2, supports R1 (cycle-over-cycle bill reduction).

**Dependencies:** U1.

**Files:**
- `packages/api/src/services/catalogService.ts` — `upsertCatalogItems` at line 342-413; specifically the `.returning()` call at line 368

**Approach:**
- Change `.returning()` to `.returning({ id: catalogItems.id, sku: catalogItems.sku, name: catalogItems.name, description: catalogItems.description, categories: catalogItems.categories, brand: catalogItems.brand })` (see KTD2 for why these fields).
- Update the function's TypeScript return type to reflect reality: today it claims `Promise<Pick<CatalogItem, 'id'>[]>` but actually returns full rows; new actual shape is `Promise<Pick<CatalogItem, 'id' | 'sku' | 'name' | 'description' | 'categories' | 'brand'>[]>`.
- Verify the embedding-regen diff loop (line 378-409) still functions: input fields it compares (`name, description, categories, brand`) are still in the projection.
- Verify `trackEtlJob` caller (line 421-428) only uses `id` — confirmed.

**Patterns to follow:**
- Drizzle typed `.returning({...})` projection (similar pattern at `packages/api/src/routes/packs/index.ts:451-454`)

**Test scenarios:**
- Existing `etl.test.ts` integration test for full ingest still passes (no behavioral change observed externally).
- New: assert that the embedding regen path triggers when input differs from existing row on `name`, `description`, `categories`, or `brand`. Setup: seed an item, call `upsertCatalogItems` with same SKU + changed `name`, assert a subsequent UPDATE on `embedding` happened.
- New: assert that the embedding regen path does NOT trigger when input matches existing row on those four fields.
- (From U1) ETL characterization assertion flips: returned array elements now have the narrower key set.

**Verification:** Existing ETL tests green; new embedding-regen-trigger tests green; characterization assertion updated and green.

---

### U3. Project `handleEmbeddingsBatch` select to drop unused fields

**Goal:** When backfilling embeddings for catalog items, only pull the columns the embedding-text builder actually reads.

**Requirements:** R2.

**Dependencies:** U1.

**Files:**
- `packages/api/src/services/catalogService.ts` — `handleEmbeddingsBatch` at line 473-520; specifically the `this.db.select()` at line 478

**Approach:**
- Replace `this.db.select().from(catalogItems).where(...)` with explicit projection of fields `getEmbeddingText` reads: `{id, name, description, brand, model, categories, variants, techs, color, size, material, reviews, qas, faqs}`.
- Note: this still pulls the fat JSONB (reviews/qas/faqs/etc.) because the embedding text uses them as inputs — that's an unavoidable constraint. The savings come from dropping the (currently null) embedding column itself, plus the unused scalar cols (price, ratingValue, availability, seller, productSku, currency, condition, reviewCount, images, links, weight, weightUnit, productUrl, sku, createdAt, updatedAt).
- Smaller per-call win than U2, but multiplied across embeddings-backfill batches.

**Patterns to follow:**
- Same `select({...})` pattern used in `vectorSearch` at line 246-249.

**Test scenarios:**
- Existing `embeddingService.test.ts` and `embeddingHelper.test.ts` unit tests still pass.
- New: integration test (in `etl.test.ts` or a new `embeddings-batch.test.ts`) that calls `handleEmbeddingsBatch` for N items and verifies N rows have non-null embeddings after.
- New: assert the returned item set inside the handler has the projected key set, not the full schema.

**Verification:** Tests pass. Smoke test against local Neon HTTP proxy: trigger a backfill, verify embeddings populate.

---

### U4. Project `CatalogService.getCatalogItems` for list responses

**Goal:** Stop shipping embedding + fat JSONB on the catalog list endpoint and AI catalog tool — the biggest list-egress source.

**Requirements:** R2, R3.

**Dependencies:** U1.

**Files:**
- `packages/api/src/services/catalogService.ts` — `getCatalogItems` at line 55-194; specifically the two `select({ ...getTableColumns(catalogItems), pack_item_count: ... })` blocks at line 134-137 and 162-165

**Approach:**
- Replace `...getTableColumns(catalogItems)` with explicit list-context columns: `{id, name, productUrl, sku, weight, weightUnit, description, categories, images, brand, model, ratingValue, color, size, price, availability, seller, productSku, material, currency, condition, reviewCount, createdAt, updatedAt}`.
- Drop from the projection: `variants, techs, links, reviews, qas, faqs, embedding`.
- Service return type stays `Promise<{items: CatalogItem[], ...}>` — the dropped JSONB fields are `.nullable().optional()` on the type so undefined satisfies it.
- Wire-shape change: GET /catalog list responses no longer include the fat JSONB fields. Zod schema (`CatalogItemSchema`) accepts undefined for them — parsing won't throw. See KTD3 + Risks.

**Patterns to follow:**
- Existing typed projection in `vectorSearch` at line 246-249.

**Test scenarios:**
- (From U1, post-change assertion) `GET /catalog?limit=5` response items have the keys listed above, NO `variants/techs/links/reviews/qas/faqs/embedding` keys.
- `GET /catalog?q=<term>&category=<cat>` still filters correctly (no projection change to WHERE clause).
- Pagination (`page`, `limit`, `totalPages`) unchanged.
- AI tool `getCatalogItems` (`packages/api/src/utils/ai/tools.ts:49-80`) invoked with `limit: 10` returns `{success: true, data: {items: [...10 items], totalCount, ...}}` — items shaped per the new projection.
- `pack_item_count` computed field still works (it's in the select, just not on `catalogItems`).

**Verification:** Catalog list tests + AI tool test green; characterization shape assertion updated.

---

### U5. Project `PackService.getPackDetails` catalogItem join

**Goal:** Stop pulling embedding + fat JSONB on every catalog item linked from a pack detail view.

**Requirements:** R2, R3.

**Dependencies:** U1.

**Files:**
- `packages/api/src/services/packService.ts` — `getPackDetails` at line 44-59; specifically the `catalogItem: true` Drizzle relational `with` at line 51

**Approach:**
- Change `catalogItem: true` to:
  ```
  catalogItem: { columns: { id: true, name: true, brand: true, weight: true, weightUnit: true, images: true, categories: true, productUrl: true, sku: true, price: true, ratingValue: true } }
  ```
- Verify callers (grep for `PackService` usage): `getPackDetails` is called by `getPackDetails` AI tool stub (client-side, no actual call), but also by anything internally. Run `rg "packService.getPackDetails|new PackService"` at implementation time to enumerate.

**Patterns to follow:**
- Drizzle relational `with: { x: { columns: { ... } } }` syntax (Drizzle docs / existing usage in `packages/api/src/routes/`).

**Test scenarios:**
- (From U1) Pack detail tests show catalogItem with restricted key set, no embedding or fat JSONB.
- Numeric correctness of `computePackWeights` output (uses catalogItem.weight when present) — unchanged.

**Verification:** Tests pass; smoke test of pack detail view against local DB.

---

### U6. Project pack route relational queries (list, items, weight-breakdown)

**Goal:** Stop pulling packItems.embedding (and catalogItem.embedding + fat JSONB where joined) on three pack endpoints. Mobile hot path.

**Requirements:** R2, R3.

**Dependencies:** U1.

**Files:**
- `packages/api/src/routes/packs/index.ts` — three Drizzle relational queries:
  - **Line 67-72** (GET /packs list)
  - **Line 258-261** (GET /packs/:packId/weight-breakdown)
  - **Line 643-646** (GET /packs/:packId/items)

**Approach:**

For **GET /packs list** (line 67-72) — drop packItems.embedding:
```
with: {
  items: includePublic
    ? { columns: <packItems cols sans embedding>, where: eq(packItems.deleted, false) }
    : { columns: <packItems cols sans embedding> }
}
```
Whitelist: `{id: true, name: true, description: true, weight: true, weightUnit: true, quantity: true, category: true, consumable: true, worn: true, image: true, notes: true, packId: true, catalogItemId: true, userId: true, deleted: true, isAIGenerated: true, templateItemId: true, createdAt: true, updatedAt: true}`.

For **GET /packs/:packId/weight-breakdown** (line 258-261) — minimal projection: only fields `computePackBreakdown` reads:
```
with: {
  items: {
    columns: { name: true, weight: true, weightUnit: true, category: true, quantity: true, worn: true, consumable: true },
    where: eq(packItems.deleted, false)
  }
}
```
`name` is required because `computePackBreakdown` (`packages/api/src/utils/compute-pack.ts:100`) reads `item.name` to populate `byCategory[].items[]` strings; without it, every breakdown entry renders as `"undefined (1200g × 1)"`. Re-verify the full field set against `compute-pack.ts` at implementation time in case other reads exist.

For **GET /packs/:packId/items** (line 643-646) — project both packItems (drop embedding) AND catalogItem (drop embedding + fat JSONB). Spell out both whitelists; this endpoint has NO response Zod schema (route at `packages/api/src/routes/packs/index.ts:648-655` spreads `...item` directly), so any field missing from the outer whitelist leaks to mobile as `undefined`:
```
{
  where: and(...conditions),
  columns: {
    id: true, name: true, description: true, weight: true, weightUnit: true,
    quantity: true, category: true, consumable: true, worn: true, image: true,
    notes: true, packId: true, catalogItemId: true, userId: true, deleted: true,
    isAIGenerated: true, templateItemId: true, createdAt: true, updatedAt: true
  },
  with: {
    catalogItem: { columns: { id: true, name: true, brand: true, weight: true, weightUnit: true, images: true, categories: true, productUrl: true, sku: true, price: true, ratingValue: true } }
  }
}
```
(Every `packItems` column except `embedding`.)

**Patterns to follow:**
- Drizzle relational query column filtering — see e.g. `packages/api/src/routes/catalog/index.ts:399-403` (`packItems: { columns: { id: true }, where: ... }`).

**Test scenarios:**
- (From U1) GET /packs response items have no `embedding` key.
- (From U1) GET /packs/:packId/items response has no `embedding` on packItem or nested catalogItem; catalogItem has no fat JSONB.
- (From U1) GET /packs/:packId/weight-breakdown returns the SAME numeric breakdown as before (regression: numeric correctness). Seed a pack with mixed worn/consumable items and assert per-category totals match expected.
- New: bytecount sanity check — for a pack with 5 items linked to fat catalogItems, the response body length post-fix is at least 50% smaller than pre-fix. (Not for pass/fail; for confidence.)

**Verification:** Tests pass; manual smoke against local DB.

---

### U7. Add row-byte budget to `executeSql` AI tool

**Goal:** Prevent AI agents from accidentally egressing MB of data with `SELECT *` against fat tables.

**Requirements:** R5.

**Dependencies:** none (independent of projection changes).

**Files:**
- `packages/api/src/services/executeSqlAiTool.ts` — add post-execution byte check
- `packages/api/src/services/__tests__/executeSqlAiTool.test.ts` — create (no existing test file for this service)

**Approach:**
- After `result = await Promise.race(...)` at line 41, before returning the success object at line 50-56, compute `byteCount = JSON.stringify(resultWithRows.rows ?? []).length`.
- If `byteCount > 1_048_576`, return:
  ```
  { error: 'Result exceeds 1 MB byte budget. Project specific columns or reduce limit.', query: finalQuery, byteCount }
  ```
- Otherwise, append `byteCount` to the success object for telemetry visibility.
- Constant `BYTE_BUDGET_BYTES = 1_048_576` at top of file with comment explaining tradeoff (Worker still paid DB read; guard protects Worker→client + LLM context).

**Patterns to follow:**
- Existing error-return shape (line 18, 23, 43): `{ error: string, query: string }`.

**Test scenarios:**
- **Happy path:** query returning a small result set (e.g., `SELECT 1`) succeeds, response includes `byteCount` field.
- **Reject path:** mock `db.execute` to return synthetic large `rows` array (~1.5 MB stringified) — assert function returns `{error, query, byteCount}`, no `data` or `success` keys.
- **Boundary:** exactly 1 MB serialized — succeeds (uses `>`, not `>=`).
- **Existing read-only validation:** `INSERT INTO ...` still returns the existing read-only error (unchanged behavior).
- **Existing timeout:** still returns timeout error (unchanged behavior).

**Verification:** New test file green; smoke test via AI agent — `SELECT * FROM catalog_items LIMIT 100` returns the byte-budget error.

---

### U8. Post-deploy verification + monitoring checklist

**Goal:** Confirm the changes actually moved the bill, not just the audit's prediction of it.

**Requirements:** Origin assumption: "Verify before declaring success on the next bill" (Open Question 1 from origin).

**Dependencies:** U2-U7 deployed to production.

**Files:**
- No code. This unit is a verification checklist to include in the PR description / runbook.

**Approach:**
- Capture **before** baseline (within 24h before merge): screenshots from Neon dashboard of (a) compute hours over last 7d, (b) data transfer / egress over last 7d, (c) top 10 queries by total bytes scanned.
- After merge + deploy, wait 24-48h for traffic to normalize, then capture the same three views.
- Expectations:
  - Top-N queries: `catalogService.getCatalogItems` and `upsertCatalogItems` SQL signatures should drop in bytes-scanned ranking.
  - Compute hours: incremental drop, larger if catalog ingest runs occur during the post-window.
  - Egress: meaningful drop, especially on any day with ETL activity.
- At next billing cycle close: compare $ delta vs prior cycle, controlling for catalog ingest volume.
- If bill stays high: re-open the audit, prioritize Neon dashboard top queries directly rather than the audit's hypothesis.

**Test scenarios:** N/A — verification, not test.

**Verification:** Neon dashboard top-queries list re-ordered; compute hours visibly dropped post-deploy; next month's bill meaningfully lower with comparable usage.

---

### U9. Lint script + CI gate preventing projection-discipline regressions

**Goal:** Stop future regressions of the Tier-1 column-projection pattern. Lock in the gains from U2-U6 so a future PR can't reintroduce a `SELECT *` against `catalog_items` or `pack_items` without an explicit reviewer-acknowledged exception.

**Requirements:** R2 (eliminate the foot-gun structurally — this is the lint-layer complement to the schema-layer pivot table that's deferred).

**Dependencies:** U2-U6. Must land AFTER the existing projection fixes so the rule doesn't flag pre-fix code on its first CI run.

**Files:**
- `packages/api/scripts/lint/no-unprojected-fat-table-queries.ts` (new) — TS lint script following the existing repo convention at `packages/api/scripts/lint/` (siblings: `no-circular-deps.ts`, `no-duplicate-deps.ts`)
- `.github/workflows/checks.yml` (modify) — add a step that invokes the lint script alongside the existing lint steps (lines 45-50 area)
- `packages/api/scripts/lint/__tests__/no-unprojected-fat-table-queries.test.ts` (new) — fixture-based tests for the rule itself: a synthetic file with known-bad patterns fails, a synthetic file with known-good patterns passes
- `packages/api/scripts/lint/__fixtures__/unprojected-fat-table-queries/` (new) — fixture files for the test

**Approach:**

The script walks TypeScript source files using `ts-morph` (or the TypeScript compiler API directly if `ts-morph` isn't already a dep — check `package.json`). For each `.ts` file under `packages/api/src/`, find calls matching these patterns and flag them when the target table is `catalogItems` or `packItems`:

1. **Untyped `db.select()`** chained to `.from(catalogItems)` or `.from(packItems)` — `select` with no argument map ships every column.
2. **`db.query.catalogItems.findFirst/findMany` or `db.query.packItems.findFirst/findMany`** where the first arg object does NOT contain a `columns:` key. Whitelist is mandatory because Drizzle's relational query builder returns full rows by default.
3. **`.returning()` with no argument map** in a chain rooted at `catalogItems` or `packItems` (insert/update/upsert paths).
4. **Drizzle relational `with:` shortcuts** that use `with: { catalogItem: true }` or `with: { packItems: true }` (boolean form pulls every column from the joined table).

Each violation prints `<file>:<line>:<column>: <rule>: <description>` and exits non-zero. The script accepts `--fix-suggestion` to print a suggested whitelist (from `packages/db/src/schema.ts`), but never auto-applies — projection choice is human judgment.

**Allow-list mechanism.** For genuine exceptions (e.g., `getEmbeddingText` legitimately needs most JSONB cols), allow inline opt-out via a magic comment on the offending line: `// lint:allow-unprojected-fat-table reason: <text>`. The script greps for this comment when emitting a violation; if present, the violation is downgraded to a noted skip. This avoids ergonomic friction without losing visibility.

**Patterns to follow:**
- `packages/api/scripts/lint/no-circular-deps.ts` (existing TS lint script style)
- `packages/api/scripts/lint/no-duplicate-deps.ts` (same)
- CI step shape in `.github/workflows/checks.yml:45-50`

**Test scenarios:**
- **Happy path — bad patterns flagged:**
  - Fixture file with `db.select().from(catalogItems)` → exit 1, prints violation with file:line.
  - Fixture file with `db.query.catalogItems.findFirst({ where: ... })` (no `columns:`) → flagged.
  - Fixture file with `db.query.packItems.findMany({ where: ..., with: { catalogItem: true } })` → flagged (both the outer no-columns AND the inner `true` shortcut).
  - Fixture file with `.returning()` (no arg) on a chain rooted at `catalogItems` → flagged.
- **Happy path — good patterns pass:**
  - Fixture with `db.select({ id: catalogItems.id, name: catalogItems.name }).from(catalogItems)` → exit 0.
  - Fixture with `db.query.catalogItems.findFirst({ where: ..., columns: { id: true } })` → passes.
  - Fixture with `.returning({ id: catalogItems.id })` → passes.
- **Allow-list:** fixture with the magic-comment override on a bad pattern → exits 0, prints a noted-skip line.
- **Other tables:** fixture with `db.select().from(users)` → NOT flagged (rule is scoped to fat tables only).
- **CI integration:** intentionally introduce a bad pattern in a feature branch test commit → checks.yml fails. Revert → checks.yml passes.

**Verification:**
- `bun packages/api/scripts/lint/no-unprojected-fat-table-queries.ts` returns exit 0 on the current tree (after U2-U6 fixes ship).
- The lint script's own tests pass.
- A deliberate regression in a throwaway feature branch fails CI.

---

## Test Strategy

- **Characterization tests first** (U1) lock current behavior end-to-end.
- **All units run against the integration test pool** (`packages/api/test/`) — real DB via local Neon HTTP proxy at `db.localtest.me`, vitest single-worker mode.
- **No additional unit-test framework changes.** Existing config in `packages/api/vitest.config.ts` is sufficient.
- **Sequential test execution required** (already the project default; see config at `vitest.config.ts:30-37`).
- **Test data:** the new `seedFullCatalogItem` helper introduced in U1 is the canonical way to create a catalog item with realistic fat JSONB and embedding for subsequent tests.

---

## Risks

### R-risk-1. Mobile or web client reads a fat-JSONB field on a list endpoint that we now drop

**What:** U4 drops `variants/techs/links/reviews/qas/faqs` from GET /catalog list responses. U6 drops `packItems.embedding` from list responses (clients should never have used this, but in principle could). Zod schema permits undefined for all dropped fields, so no parse error. But if mobile code reads `item.reviews` on a catalog list view, it'll silently get undefined and likely render nothing instead of a review count badge or similar.

**Mitigation:**
- Before merging U4/U6: grep mobile features for these field accesses on list contexts:
  ```
  rg -t ts "\.(reviews|qas|faqs|techs|links|variants)\b" apps/expo/features apps/web apps/admin
  ```
- For any hits in a list view code path, either keep the field on the projection or move the read to the detail endpoint.
- Document the wire-shape change in the PR description so any non-grep-visible consumers (cached UIs, snapshot tests) get caught at review.

**Rollback:** Single-file revert of the affected service method or route handler. Each projection is isolated.

### R-risk-2. `upsertCatalogItems` return-type narrowing surfaces a hidden caller

**What:** U2 tightens return type from the lie of `Pick<CatalogItem, 'id'>[]` to actual `Pick<...>` with 6 fields. TypeScript should flag any caller that reads a field outside the new projection; ts compile catches it.

**Mitigation:** `bun check-types` in CI catches this before merge. If a real caller surfaces, expand the projection (keeping it narrower than full row).

### R-risk-3. `embeddings-stats` two-scan, PUT/PATCH overfetch, and DbUtils overfetch (Tier 2) keep contributing

**What:** Tier 2 callsites stay in for this PR. They keep paying for unused data but at smaller per-call scale than Tier 1. Next month's bill won't show maximal improvement.

**Mitigation:** Explicit, accepted — origin defers Tier 2 to bundle with the pivot migration. Document in U8 that residual cost from these paths is expected.

### R-risk-4. `executeSql` byte budget rejects legitimate aggregation queries

**What:** An AI-generated `SELECT category, COUNT(*) FROM catalog_items GROUP BY category` returning 10K small rows could exceed 1 MB serialized.

**Mitigation:** Error message guides the AI to project columns or reduce limit. In production, monitor logs for byte-budget rejections — if false positives are common, raise to 2 MB or tier-cap by table.

### R-risk-5. Drizzle relational query whitelist syntax mistakes

**What:** Whitelisting many columns via `{x: true, y: true, ...}` is verbose and easy to typo. A missing column = silently undefined in response = silent breakage.

**Mitigation:** Characterization tests from U1 fail loudly if any expected key is missing. Implementer copies the list from `packages/db/src/schema.ts` rather than retyping.

---

## Deferred Implementation Notes

- **Exact `columns:` whitelist for each projected query** — implementer copies from `packages/db/src/schema.ts` minus the dropped fields rather than hand-typing.
- **Boundary handling at exactly 1 MB for executeSql** — use `>`, not `>=`, so exactly-1-MB results pass. Decided at implementation; not architecturally significant.
- **Whether to refactor `getTableColumns(catalogItems)` into a named `LIST_COLUMNS` constant exported from schema** — would DRY the projection between U4 and any future list endpoint. Decide during U4 implementation; if a second use case shows up, extract; otherwise keep inline.
- **`computePackBreakdown` exact field reads** — verify against `packages/api/src/utils/compute-pack.ts` source at U6 implementation time before finalizing the weight-breakdown whitelist.
- **`PackService.getPackDetails` callers** — enumerate via `rg` at U5 implementation time.

---

## Open Questions

- **OQ1 (carried from origin):** Does Neon's dashboard show a top-bytes-scanned query that contradicts this audit hypothesis? — Addressed by U8.
- **OQ2 (carried from origin, deferred):** Embedding pivot table versioning model (single-row-per-item with `model_version` field vs multi-row with `(item_id, model_version)` PK). Out of scope for this plan; resolves during the pivot migration plan.
- **OQ3 (carried from origin, deferred):** Is JSONB pivot worth it? Deferred to empirical assessment after this plan + pivot migration ship.
- **OQ4 (new from planning):** Are there any non-Zod-parsed routes that leak `embedding` to client? Likely none, but U1's characterization tests will surface any by failing the "no embedding key in response" assertion against current code.
- **OQ5 (new from planning):** Will the `executeSql` byte budget produce a noticeable false-positive rate in production AI tool usage? Unknown until deployed; monitor logs for 1-2 weeks post-merge and adjust if needed.

---

## Verification (Plan-Level)

- All existing tests pass + new characterization tests pass on a feature branch off `origin/development`.
- `bun check-types` clean.
- `bun check` (Biome) clean.
- Manual smoke against local Neon HTTP proxy (`db.localtest.me`): catalog list, catalog detail, similar, vector-search, packs list, pack items, weight-breakdown all return expected shapes.
- Mobile dogfood: open the app, view a pack, view items, navigate to similar items — no visible regression.
- Post-deploy (U8): Neon dashboard top-queries list shows reduced bytes scanned for `catalog_items`-touching queries; compute hours drop; next billing cycle bill is meaningfully lower with comparable usage volume.
