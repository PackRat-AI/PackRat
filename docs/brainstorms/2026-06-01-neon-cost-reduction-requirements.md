# Neon PostgreSQL Cost Reduction — Audit + Plan

- **Date:** 2026-06-01
- **Status:** Audit complete on `origin/development` (cb9f64d33). No code changes yet. Tier-1 fixes proposed but not committed.
- **Worktree / branch:** `~/Code/PackRat-neon-audit` (detached HEAD off origin/development — branch off before committing fixes)
- **Trigger:** Neon bill for the recent month — $33 compute + $14 egress — vs much lower historical baseline. Catalog ingest activity is a known driver this month, but the suspicion is that ongoing query inefficiency compounds the spike.

## Problem

Neon costs jumped this month. Two drivers suspected, both verified in code:

1. **Catalog ingest spike (one-off):** A large ETL run this cycle. The ETL path itself is structured (CSV stream → batches of 100 → upsert + embedding gen), but `upsertCatalogItems` does `.returning()` (untyped) on every batch — Postgres ships full rows back including the new 1536-dim embedding and all fat JSONB. For a 30K-row chunk that's ~30K × 50–100 KB of needless DB→Worker traffic *per chunk*.

2. **Hot-path query overfetch (ongoing):** Multiple AI tool, REST list, and pack-detail endpoints select full rows from `catalog_items` and `pack_items`. Both tables have `vector(1536)` embedding columns and (for catalog) several large JSONB columns (`reviews`, `qas`, `faqs`, `techs`, `links`, `variants`). A single full catalog row is ~50–100 KB. List endpoints with `limit: 20–100` therefore ship 1–10 MB per request, much of which is paid for but never used by the client.

The fix is mostly column projection — a small, behavior-preserving code change with disproportionate cost impact. The structural follow-on (move embeddings to pivot tables) eliminates the foot-gun for good.

## Goals

- **Cut bill cycle-over-cycle.** Get compute + egress back toward the historical baseline. No specific dollar target — both lines should drop visibly.
- **Eliminate the "untyped select ships embeddings" foot-gun.** Either via projection discipline (Tier 1) or schema change (deferred Tier).
- **Don't break existing behavior.** Response shapes that include heavy JSONB stay as-is unless the schema is intentionally split; we only stop selecting columns whose values are then discarded.
- **Preserve vector search semantics.** All confirmed-good vector search paths (correct embedding-out destructure pattern) stay as-is.

## Non-goals

- Migrate to Cloudflare D1. Not on the table for this cycle. (Re-evaluate only if Neon bill remains painful after Tier 1 + structural fixes.)
- Add caching layers (Redis, KV, edge cache). Not the bottleneck and adds operational surface.
- Touch the Neon plan tier or driver choice. Driver selection (`packages/api/src/db/index.ts`) is already correct: WS pool for routes, HTTP for queues.
- Rework the catalog data model beyond the embedding pivot table (e.g. don't split JSONB → relational normalized tables — that's a different project).

## Success criteria

- Next month's Neon bill shows clear compute + egress drop (with catalog ingest activity comparable to a normal month).
- No regressions in tests; no user-visible behavior change.
- After Tier-1 ships: every `db.select()` / `findFirst` / `findMany` against `catalog_items` or `pack_items` either explicitly projects columns or has a documented justification for pulling the full row.

## Audit findings

All file references repo-relative.

### Schema

`packages/db/src/schema.ts:132-222` — `catalogItems`:
- Fat JSONB: `categories`, `images`, `variants`, `techs`, `links`, `reviews`, `qas`, `faqs`
- Vector: `embedding vector(1536)` (line 214)
- HNSW index: `embedding_idx` (line 220)

`packages/db/src/schema.ts:225-259` — `packItems`:
- Vector: `embedding vector(1536)` (line 249)
- HNSW index: `pack_items_embedding_idx` (line 254)

Inferred type `CatalogItem = InferSelectModel<typeof catalogItems>` (line 526) includes `embedding` — the type system encourages shipping it everywhere unless explicitly stripped.

### Tier 1 — Hot-path overfetch (the bill drivers)

| # | File:line | Problem | Fix |
|---|---|---|---|
| 1 | `packages/api/src/services/catalogService.ts:136, 164` | `getCatalogItems` selects `...getTableColumns(catalogItems)` → full rows incl. embedding + JSONB on every list call. Triggered by AI tool `getCatalogItems` (limit up to 100) and REST `GET /catalog` (default 20). | Explicit projection of list-relevant cols only: `id, name, brand, model, weight, weightUnit, price, ratingValue, images, categories, productUrl, availability, sku`. Keep heavy JSONB for detail endpoints. |
| 2 | `packages/api/src/services/packService.ts:51` | `getPackDetails` uses `catalogItem: true` in Drizzle `with` — pulls full catalog row (embedding + JSONB) for every linked item. Pack with 20 items ≈ 1–2 MB egress per call. | `with: { catalogItem: { columns: { id, name, brand, weight, weightUnit, images, categories } } }`. |
| 3 | `packages/api/src/routes/packs/index.ts:67-72` | `GET /packs` list: `findMany({ with: { items: true } })` pulls `packItems.embedding` for every item across every pack. Mobile hot path. | `with: { items: { columns: <all packItems cols EXCEPT embedding>, where: ... } }`. |
| 4 | `packages/api/src/routes/packs/index.ts:643-646` | `GET /packs/:packId/items`: items + full catalogItem, both with embeddings. Worst single endpoint — 2+ MB per call. | Project packItems (drop embedding) and catalogItem (drop embedding + reviews/qas/faqs/techs/links/variants). |
| 5 | `packages/api/src/routes/packs/index.ts:258-261` | `GET /packs/:packId/weight-breakdown` pulls all packItems incl. embedding for a weight aggregation that uses none of it. | `with: { items: { columns: { weight, weightUnit, category, quantity, worn, consumable } } }`. |
| 6 | `packages/api/src/services/catalogService.ts:368` | `upsertCatalogItems().returning()` — full rows × N per batch during ETL. For 30K rows / chunk: ~30K × 50–100 KB ships back to worker for nothing (only `id` + `sku` are used). **Most likely Tier-1 driver of this month's compute/egress spike.** | `.returning({ id: catalogItems.id, sku: catalogItems.sku })`. |
| 7 | `packages/api/src/services/catalogService.ts:478` | `handleEmbeddingsBatch` does `db.select().from(catalogItems).where(inArray(...))` — untyped. Pulls everything when only the fields `getEmbeddingText` reads are needed. | Project the `getEmbeddingText` field set: `{ id, name, description, categories, brand, model, variants, techs, color, size, material, reviews, qas, faqs }`. |

### Tier 2 — Smaller but real

| # | File:line | Problem | Fix |
|---|---|---|---|
| 8 | `packages/api/src/routes/catalog/index.ts:446-448` | `GET /catalog/:id/similar` source-item fetch — `findFirst` with no `columns:` filter. Only uses `.embedding`. | `columns: { id: true, embedding: true }`. |
| 9 | `packages/api/src/routes/catalog/index.ts:517-519` and `packages/api/src/routes/packs/index.ts:782-784` | PUT/PATCH existingItem fetch — `findFirst` pulls all cols. JSONB cols are used (for `getEmbeddingText`), but `embedding` itself isn't. | Project all cols except `embedding`. Small win individually; combined with similar patterns, real. |
| 10 | `packages/api/src/routes/catalog/index.ts:209-229` | `GET /catalog/embeddings-stats` — two sequential `COUNT(*)` full scans. | Combine: `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE embedding IS NULL) AS without FROM catalog_items`. |
| 11 | `packages/api/src/utils/DbUtils.ts:6-22` and `:25-56` | `getPackDetails` joins items+catalogItem+user fully. `getCatalogItems` does untyped `db.select().from()`. Used by `gap-analysis`, `item-suggestions`. | `getPackDetails`: project packItems (drop embedding except where suggestions need it), drop catalogItem entirely for gap-analysis, drop user. `getCatalogItems`: explicit projection. |

### Tier 3 — Security / correctness risk (cost-adjacent)

| # | File:line | Problem | Fix |
|---|---|---|---|
| 12 | `packages/api/src/services/executeSqlAiTool.ts` | AI tool allows arbitrary read-only SELECT up to 1000 rows, no column or row-byte limit. AI could run `SELECT * FROM catalog_items LIMIT 1000` → ~100 MB egress in one tool call. Read-only + 30s timeout are present; row-byte guard is missing. | Add a result-byte budget (e.g. abort if cumulative serialized result > 1 MB). Optionally: reject queries against `catalog_items` that don't enumerate columns; or strip `*` against tables with vector cols. |
| 13 | `packages/schemas/src/catalog.ts:6-97` | `CatalogItemSchema` response shape includes all fat JSONB (`variants, techs, links, reviews, qas, faqs`). Even when the DB query is projected, the schema makes "all the heavy stuff" the default response shape — encourages future regressions. | Split into `CatalogItemListSchema` (slim) and `CatalogItemDetailSchema` (full). Bigger refactor; defer until after Tier 1 ships. |

### Vector search — confirmed correct ✓

All vector search call sites correctly destructure the embedding out of the SELECT before returning to the caller:

- `packages/api/src/services/catalogService.ts:242` (`vectorSearch`)
- `packages/api/src/services/catalogService.ts:304` (`batchVectorSearch`)
- `packages/api/src/routes/catalog/index.ts:455` (`/catalog/:id/similar`)
- `packages/api/src/routes/packs/index.ts:915` (`/packs/:packId/items/:itemId/similar`)

The embedding is used for `ORDER BY cosineDistance` only, never returned. However, all four still ship the fat JSONB cols in results — addressing this is part of the structural fix (Tier 3 #13) or out-of-scope for now.

### Compute / scale-to-zero

- **Driver choice is correct.** `packages/api/src/db/index.ts`: Elysia routes use `createDb()` → `NeonPool` (WS); queue handlers use `createDbClient(env)` (HTTP, no pool). `idleTimeoutMillis: 0` on `pg.Pool` (line 44) only applies to non-Neon URLs — not the prod path.
- **No polling loops, crons, or healthchecks found** that would block scale-to-zero on their own.
- **ETL ingest is the most likely Tier-1 compute driver for this month's spike** — confirmed via Findings #6 and #7. Many chunks process in parallel, each doing 4+ DB round trips per 100-row batch, with `.returning()` shipping full rows back. The fix in #6 alone is expected to cut ingest-time DB traffic by ~90%.

## Recommended sequence

1. **Tier 1 fixes, single PR or short series of PRs.** Order by impact-per-effort:
   1. `upsertCatalogItems.returning({id, sku})` (5 min, huge ETL-time win)
   2. `getCatalogItems` service projection (15 min)
   3. `GET /packs` list + `GET /packs/:packId/items` projections (30 min, mobile hot path)
   4. `getPackDetails` projection (10 min)
   5. `/packs/:packId/weight-breakdown` projection (5 min)
   6. `handleEmbeddingsBatch` projection (5 min)
   7. `embeddings-stats` single-query combine (5 min)
   - All behavior-preserving. Add or extend tests around shapes returned to clients before merging.
2. **Tier 3 #12 — `executeSql` row-byte budget.** Independent of Tier 1; ship in its own PR. Prevents a future AI runaway from spiking the bill in one tool call.
3. **Structural fix — embedding pivot tables (deferred but decided).** New tables `catalog_item_embeddings` (`id`, `catalog_item_id` FK, `embedding vector(1536)`, `model_version`, `updated_at`) and `pack_item_embeddings`. Vector indexes live on these tables only. Vector search becomes a JOIN (cheap on Postgres with proper indexes). Migration + every write path touches. Bonus wins: embedding versioning (when swapping models), async backfill (item exists → embedding job → embedding row), independent vector-index tuning, smaller `catalog_items`/`pack_items` heap → faster scans. Plan with `/ce-plan` after Tier 1 lands.
4. **Out-of-scope structural follow-on (do not commit to this cycle):** fat JSONB pivot (`catalog_item_content`) and split response schemas (Tier 3 #13). Re-evaluate after observing post-Tier-1 + post-pivot bill.

## Scope boundaries

**In scope (this cycle):**
- Tier-1 column projection fixes (#1–7)
- Tier-3 #12 `executeSql` row-byte budget
- Test coverage for shape regressions

**Deferred for the next iteration:**
- Embedding pivot tables (structural fix; plan with `/ce-plan`)
- Tier-2 projection cleanups (#8–11) — bundle with the pivot migration so we touch each callsite once
- Tier-3 #13 response-schema split (`CatalogItemListSchema` vs `CatalogItemDetailSchema`)

**Outside this product's identity / not considered:**
- Migrating off Postgres (D1 / SQLite)
- Adding cache layers (Redis, KV, edge)
- Changing Neon plan tier or driver topology
- Reworking the catalog data model beyond the embedding pivot

## Dependencies / assumptions

- **Assumption:** Neon's compute is currently warm during catalog ingest because of sustained ETL queue activity; reducing per-batch DB traffic (#6, #7) will let compute scale to zero in idle windows during ingest. To validate: check Neon's compute-hours chart before/after the ingest fix lands.
- **Assumption (unverified — should check Neon dashboard before declaring victory):** the top-N queries by total bytes scanned will include the catalogService getCatalogItems path and ETL upsert. If the dashboard surfaces an unexpected query as a bigger driver, we re-prioritize.
- **Dependency:** post-fix bill needs a clean catalog-ingest-comparable month to assess. If ingest activity drops, compute may fall on its own and confuse the signal.

## Open questions

1. Does Neon's dashboard show a specific top-bytes-scanned query that contradicts this audit? (Verify before declaring success on the next bill.)
2. Should the embedding pivot tables version embeddings from day one (i.e. `(catalog_item_id, model_version)` as PK, multiple rows per item), or single-row-per-item with `model_version` as metadata? Versioning enables A/B'ing embedding models; single-row is simpler. Defer to planning.
3. After Tier 1 lands and the pivot ships, is JSONB-pivot for `reviews/qas/faqs` worth it? Depends on how often those cols are actually read post-projection-discipline — wait for empirical signal before deciding.

## Handoff

Recommended next workflow: `/ce-plan` against this doc to design the Tier-1 PR(s) + the pivot-table migration. Audit findings above can be lifted directly into the plan's task list.
