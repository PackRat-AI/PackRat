# Vector Search Bypassing HNSW Index — Hotfix Scope

- **Date:** 2026-06-01
- **Status:** Confirmed via EXPLAIN against prod (Neon MCP read-only). Hotfix straightforward; capturing scope before implementation so the change has a clear paper trail.
- **Related:** PR #2544 (Tier-1 projections), [docs/runbooks/neon-cost-profiling.md](../runbooks/neon-cost-profiling.md)

## Problem

`pg_stat_user_indexes` shows the `embedding_idx` HNSW index on `catalog_items` (14 GB) has **0 lifetime scans** despite vector search being a shipped feature exposed via:

- `/catalog/vector-search` REST endpoint (AI tool + mobile)
- `catalogVectorSearch` AI tool definition
- Pack generation (`PackService.generatePacks` → `batchVectorSearch`)
- `/catalog/:id/similar` (similar items)
- `/packs/:packId/items/:itemId/similar` (similar pack items)
- `/packs/:packId/item-suggestions` (recommendations)

`pg_stat_database.stats_reset` is null — stats have never been reset — so the zero is a lifetime measurement, not a windowed artifact.

EXPLAIN comparison against the production database confirms the root cause is the query shape, not pgvector instrumentation:

**Current shape** (Drizzle pattern, all 5 callsites):
```sql
SELECT id, ..., 1 - (embedding <=> $1) AS similarity
FROM catalog_items
WHERE 1 - (embedding <=> $1) > 0.1
ORDER BY 1 - (embedding <=> $1) DESC
LIMIT 10
```
Planner picks **Seq Scan + Sort** (parallel workers). Total cost: **427,921**.

**HNSW-eligible shape**:
```sql
SELECT id, ..., 1 - (embedding <=> $1) AS similarity
FROM catalog_items
WHERE embedding <=> $1 < 0.9            -- equivalent threshold, raw distance
ORDER BY embedding <=> $1               -- raw distance ASC, HNSW recognises this
LIMIT 10
```
Planner picks **Index Scan using embedding_idx (HNSW)**. Total cost: **3,704**.

**~115× cheaper.** Subtracting from 1 is opaque to the planner: it can't see through arithmetic on an indexed column, so the `ORDER BY` is treated as ordering by a computed expression rather than the operator that HNSW serves.

Every vector search since the feature shipped has computed cosine distance for all ~1.79M catalog rows + sorted, instead of an HNSW top-k traversal. The 14 GB index has been paying storage + write-amplification cost for zero read benefit.

## Hypothesis

Drizzle's idiomatic "similarity-as-percentage" pattern wraps the distance for caller convenience. The wrapping is structurally incompatible with the planner's ability to recognise HNSW-eligible `ORDER BY`. The fix is to keep the wrapping for the **response payload** (callers want a similarity score, not a distance) but order by the **raw distance** in the SQL.

## Goals

- Restore HNSW for every catalog vector search → ~115× planner cost reduction per query
- Reduce Neon compute spend proportional to vector-search call volume
- Validate the fix via post-deploy EXPLAIN ANALYZE + `pg_stat_user_indexes.idx_scan` going up from 0
- Preserve the existing `similarity` field in API response payloads (no consumer breakage)

## Non-goals

- Removing the HNSW index (it's about to start being useful)
- Tuning HNSW `m` / `ef_construction` parameters (defer until the index is actually being used and we have post-fix latency data)
- Pivot-table migration (deferred follow-on; the fix here works on the current schema)
- Changing the similarity threshold semantics (translate `1 - dist > 0.1` to `dist < 0.9` mechanically)

## Affected callsites

All confirmed via grep `cosineDistance` in `packages/api/src/`:

| File | Line | Function | Sort field today |
|---|---|---|---|
| `packages/api/src/services/catalogService.ts` | 304 | `vectorSearch` | `1 - (embedding <=> q)` DESC |
| `packages/api/src/services/catalogService.ts` | 367 | `batchVectorSearch` | `1 - (embedding <=> q)` DESC |
| `packages/api/src/routes/catalog/index.ts` | 455 | `/catalog/:id/similar` | `1 - (embedding <=> source.embedding)` DESC |
| `packages/api/src/routes/packs/index.ts` | 474 | `/packs/:packId/item-suggestions` | `1 - (embedding <=> avg_embedding)` DESC |
| `packages/api/src/routes/packs/index.ts` | 1038 | `/:packId/items/:itemId/similar` | `1 - (embedding <=> sourceItem.embedding)` DESC |

All 5 share the same fix pattern.

## Fix pattern

```ts
const distanceExpr = cosineDistance(catalogItems.embedding, embedding);     // raw distance, HNSW-eligible
const similarity = sql<number>`1 - ${distanceExpr}`;                          // for SELECT only

const items = await db
  .select({
    ...columnsToSelect,
    similarity,                            // keep in response — callers expect this
  })
  .from(catalogItems)
  .where(lt(distanceExpr, 0.9))           // equivalent to: 1 - distance > 0.1
  .orderBy(distanceExpr)                  // ASC by default — closest distance = highest similarity
  .limit(limit)
  .offset(offset);
```

Key points:

- **`distanceExpr` is a single Drizzle expression** that gets used in three places (SELECT, WHERE, ORDER BY) — Drizzle reuses the SQL fragment, planner sees the same operator each time
- **No change to the `similarity` field in the response** — callers see `{ ..., similarity: 0.87 }` exactly as before
- **`<=>` is the cosine-distance operator pgvector indexes on for `vector_cosine_ops`** (which is what `embedding_idx` uses per schema.ts:220 + 254)
- **Threshold flips:** `1 - distance > 0.1` becomes `distance < 0.9` (mechanically equivalent)

## Test plan

For each callsite, an EXPLAIN ANALYZE in CI or a test asserting the plan contains `Index Scan using embedding_idx` would lock the fix in. Integration test option:

```ts
const explain = await db.execute(sql`EXPLAIN (FORMAT JSON) ${vectorSearchQuery}`);
const plan = explain[0]['QUERY PLAN'][0].Plan;
// Walk the plan tree for any Index Scan using embedding_idx
expect(planUsesIndex(plan, 'embedding_idx')).toBe(true);
```

For batch vector search, similar — assert each sub-plan uses HNSW.

Existing functional vector-search tests stay green (response shape unchanged); the new tests guard against regression to seq-scan via future query refactors.

## Scope boundaries

**In scope (this hotfix):**
- Fix the 5 callsites
- Add HNSW-plan assertion tests for at least the two service methods (`vectorSearch` + `batchVectorSearch`)
- Update U1 vector-search characterization tests if they need to reflect new query shape (likely just response-shape tests, no change required)

**Deferred to follow-on:**
- Pack-items HNSW index — `pack_items_embedding_idx` (968 KB, also 0 scans). Same bug pattern in `/packs/:packId/items/:itemId/similar` callsite. The fix above covers it, but if pack_items vector search has other consumers, audit them too.
- HNSW parameter tuning (`m`, `ef_construction`)
- Index drop decision — the HNSW index becomes useful after this fix, so we keep it. If post-fix data shows vector search is genuinely low-volume, then revisit drop.

## Open questions

- **Does the `<=>` operator hand-rolled in raw SQL plan differently than Drizzle's `cosineDistance(...)` helper?** EXPLAIN should be identical (Drizzle emits the operator), but worth verifying once during implementation.
- **Are there any callers of the affected services that depend on the `similarity` field being computed from distance via specifically `1 - distance` math?** Unlikely (consumers treat similarity as opaque score), but worth a brief grep.
- **Does `cosineDistance` from Drizzle support being passed to `lt()` for the WHERE clause?** May need to use `sql\`${distanceExpr} < 0.9\`` directly. Resolves at implementation.

## Verification (post-deploy)

1. `pg_stat_user_indexes` on `embedding_idx` shows `idx_scan > 0` within minutes of first vector search hitting prod
2. Neon Console Top Queries: catalogService.vectorSearch query drops from top rankings (was likely #1 by total time)
3. `pg_stat_user_tables.seq_tup_read` on catalog_items grows more slowly (vector search no longer scanning the full table)
4. Latency on `/catalog/vector-search`, `/catalog/:id/similar`, etc. drops measurably (HNSW is ~log-time vs. linear)
5. Bill: noticeable compute hours reduction next cycle

## Cost framing

The Tier-1 PR (#2544) targeted egress + per-call hydration via projection. This hotfix targets the **planning cost per vector-search invocation**, which is orthogonal — even with perfect projection, the broken `ORDER BY` forced 1.79M cosine-distance computations per call.

The two compound: with projection (#2544) AND HNSW (this hotfix), a vector search goes from `Seq Scan + cosine on 1.79M rows + ship N × 26KB` to `HNSW top-K + ship N × 4KB`. The whole hot path becomes cheap.
