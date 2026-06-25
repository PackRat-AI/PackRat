# Catalog Embedding Regen Anomaly — Investigation Scope

- **Date:** 2026-06-01
- **Status:** Captured signal from PR #2544 verification work. No scope committed; awaiting investigation before sizing a fix.
- **Related:** PR #2544 (Tier-1 cost projections), [docs/brainstorms/2026-06-01-neon-cost-reduction-requirements.md](./2026-06-01-neon-cost-reduction-requirements.md) (F4 finding in U2 doc review)

## Problem

While running `pg_stat_user_tables` to baseline catalog table activity ahead of PR #2544's U8 verification, the numbers surfaced an anomaly:

| Metric | Value |
|---|---|
| `catalog_items` rows (from `product_sku` distinct count) | ~126,000 |
| `n_tup_ins` (lifetime inserts) | 1,789,703 |
| **`n_tup_upd` (lifetime updates)** | **5,556,406** |
| Updates per row | **~44** |
| `n_tup_del` (lifetime deletes) | 10 |

44 updates per row over the table's lifetime is high enough to warrant a dedicated investigation. The most plausible explanation maps cleanly onto an existing code-review finding.

## Hypothesis (most likely)

**The embedding-regen diff loop in `upsertCatalogItems` has been a no-op since it shipped, causing every ETL upsert to regenerate the embedding regardless of whether the source text changed.**

This is **F4** from the PR #2544 plan's doc-review pass (feasibility reviewer's catalogService.ts:378-409 finding):

> The upsert at catalogService.ts:345-368 uses `excluded.<col>` for all non-special columns, so the returned row's `name` / `description` / `categories` / `brand` will equal the input's values after upsert — `inputItem[field] !== item[field]` will always be false, and the regen path is effectively dead code today.

If true, then:

1. Every ETL upsert (1.79M lifetime inserts via the ETL path, plus the upsert branch on existing-SKU writes) regenerates the embedding via OpenAI.
2. Each regeneration is a write to `catalog_items` — counts in `n_tup_upd`.
3. The OpenAI cost is also paid every time (not just Neon — the AI Gateway egress + the embedding API call).

Two side effects compound:

- **Compute waste:** every embedding write churns the HNSW index, dirties pages, increases checkpointer / WAL load. The Neon compute meter ticks for every one.
- **Cost waste beyond Neon:** OpenAI text-embedding-3 calls are billed per token. 5.56M unneeded calls × N tokens per call adds up; would need actual rate math to size.
- **Dead-tuple bloat:** 5.56M updates create 5.56M dead tuples that autovacuum has to reclaim. With pgvector + fat JSONB rows, each dead tuple is expensive to vacuum.

PR #2544's U2 commit narrowed `.returning()` to project only the fields the diff loop reads — that exposed the bug at the type level (the projection forced the regen path to read input items instead of the returned rows, which masked the underlying issue). The narrowing is correct; the diff loop is still wrong.

## Alternative explanations (less likely, worth ruling out)

1. **Embedding backfill / migration runs** — the `handleEmbeddingsBatch` path issues an UPDATE per item. If backfill has run multiple times across the table's lifetime, that legitimately contributes to `n_tup_upd`. Estimated max: 126K × N backfill runs. If backfill has run ~40× lifetime, that alone explains the count without any bug. **Should check ETL job history / cron history to count backfill runs.**

2. **Manual admin updates** — `routes/admin/index.ts` has a PUT path that updates catalog items. If a human or scraper has been editing items at scale, those count too. Likely a small contribution.

3. **A re-ranking / score refresh job** — if anything writes computed scores back to catalog_items rows on a schedule, that's per-row updates. The schema doesn't show an obvious "score" column, but worth checking for cron / scheduled jobs touching the table.

The investigation should distinguish these contributions rather than assume the F4 hypothesis is the whole story.

## Goals

- **Quantify each contributor to `n_tup_upd`.** ETL upsert regen vs. backfill runs vs. manual edits vs. anything else.
- **If F4 is confirmed:** fix the diff to actually compare source text (not the post-upsert `excluded.col = input.col` values) so regen only fires on genuine changes.
- **If backfill is the contributor:** decide whether the lifetime-update count is acceptable or whether backfill should track progress and skip already-embedded rows.
- **Reduce embedding API cost** as a side effect if regen frequency drops.

## Non-goals

- Reworking the embedding pipeline architecture (queue cadence, model selection, dimension count). Those are separate concerns.
- Pivot-table migration. That's already in flight as a separate follow-on; the regen path will move with it but the diff bug should be fixed first regardless of where embeddings live.
- Cost-modeling the OpenAI savings precisely until investigation confirms the hypothesis.

## Success criteria

- A measured breakdown of what's driving the 5.56M updates (X% from ETL regen, Y% from backfill, Z% from manual)
- If F4 is confirmed: a fix that drops regen calls to a measurably small fraction of upserts (target: regen only on actual source-text changes, which for a stable catalog should be < 1% of upserts after initial population)
- Reduction in `n_tup_upd` growth rate post-fix
- Reduction in OpenAI embedding API call count post-fix

## Investigation plan

1. **Read the regen path carefully** (`packages/api/src/services/catalogService.ts:378-409` post-PR-#2544). Confirm whether the input-vs-returned comparison is structurally a no-op as F4 claims.
2. **Inspect ETL job history** for backfill runs. How many times has `catalogService.queueEmbeddingJobs()` been invoked? Each invocation does one UPDATE per item without an embedding.
3. **Add structured logging or Sentry breadcrumbs** to the regen path so future ETL runs report "regenerated N of M embeddings, skipped K because unchanged." This makes the diagnosis observable rather than a one-shot SQL forensic.
4. **Sample recent updates** via `SELECT id, updated_at, length(name) AS name_len FROM catalog_items ORDER BY updated_at DESC LIMIT 100` to spot patterns — bursts of identical-second updates suggest backfill; spread-out updates suggest per-write regen.
5. **Check OpenAI bill / AI Gateway logs** for embedding call volume. If the call rate matches the upsert rate (rather than the change rate), that's hard confirmation of F4.

## Scope boundaries

**In scope (this investigation):**
- Diagnosis of the 5.56M update count
- Fix the regen diff if F4 is confirmed
- Add observability so future regressions are visible

**Deferred:**
- Pivot table migration (separate plan)
- Backfill workflow redesign (separate plan if needed)
- Cost-modeling the savings (do this after measurement, not before)

## Open questions

1. **Is backfill scheduled** or only run manually? Affects how many lifetime invocations are plausible.
2. **Has the OpenAI embedding model changed** during the table's lifetime? Model version changes would legitimately trigger full-table re-embedding.
3. **Is the AI Gateway logging embedding calls** in a way we can count by timestamp? Would directly answer "how many regen calls actually happened."
4. **Should regen be opt-out instead of opt-in?** I.e., default to NEVER regen on upsert unless the row explicitly requests it via a flag. Safer than fixing the diff if the diff has been wrong since shipping.

## Handoff

Recommended next step: assign a small `/ce-plan` to investigate (1-2 hours of code reading + SQL + AI Gateway log inspection). The plan's first unit is "confirm or refute F4 via observability + code re-read"; if confirmed, subsequent units are the fix + the bloat-cleanup VACUUM consideration.

If F4 is confirmed and the AI Gateway logs show 5M+ embedding calls, this is likely a non-trivial OpenAI cost recovery in addition to the Neon side — worth prioritizing.

---

## Refined understanding (2026-06-05 investigation, post-merge)

**Hypothesis confirmed at the code level. The bug shape is different than first framed.** Reading the merged `catalogService.ts:451-495`:

The UPSERT `set` clause uses `excluded.<col>` for the embedding-watched columns (name/description/categories/brand). After UPSERT runs, the returned row's values exactly equal the input's values. Therefore `inputItem[field] !== item[field]` is **structurally always false**, `itemsToUpdate` is always empty, and the regen branch on line 497 **never fires**. The diff is dead code.

**So where do the embeddings actually come from?** Upstream, in `processValidItemsBatch`:

```ts
const embeddings = await generateManyEmbeddings({ ... });  // ALWAYS called for every batch row
const itemsWithEmbeddings = mergedItems.map((item, index) => ({
  ...item,
  embedding: embeddings[index],
}));
const upsertedItems = await catalogService.upsertCatalogItems(itemsWithEmbeddings);
```

Every ETL row gets a fresh OpenAI text-embedding-3 call, regardless of whether the catalog row already exists with a byte-identical embedding from unchanged source text. The UPSERT then writes `embedding = excluded.embedding` for every row.

**`pg_stat_user_tables` delta Jun 1 → Jun 5 confirms the steady-state hypothesis:**
- `catalog_items.n_tup_ins`: 1,789,703 → 1,789,703 (no change)
- `catalog_items.n_tup_upd`: 5,556,406 → 5,556,406 (no change in 4 days)

Zero updates during 4 days of live traffic. The runaway only fires during ETL ingest. 5.56M lifetime updates ÷ 1.79M rows ≈ 3.1 lifetime ETL re-runs touching every row — matches "we did a lot of data loading this month for catalog."

## Real cost lines, in priority

1. **OpenAI text-embedding-3 API spend** — biggest hit, real $. Every ETL row × every run.
2. **Cloudflare AI Gateway hit count** — likely caching identical embedding requests automatically. If caching is enabled with reasonable TTL, may already absorb most of the OpenAI cost. **Verify before designing the fix.**
3. **Postgres n_tup_upd churn** — every UPSERT conflict counts. Bytes are likely identical (text-embedding-3 is deterministic on identical input), so HOT-update suppression may avoid HNSW index churn. Needs `pg_stat_user_indexes.embedding_idx.idx_tup_read` delta after next ETL run to verify.
4. **Network + Worker compute** — round trip + serialization on every redundant call.

## Fix shape

**Move the diff upstream into `processValidItemsBatch`.** Before calling `generateManyEmbeddings`:

```ts
// 1. Bulk-fetch existing rows by SKU, projecting only the fields getEmbeddingText reads
const existingBySku = await catalogService.fetchExistingForRegen(skus);  // new method

// 2. Partition: needs-fresh-embedding vs reuse-existing
const itemsNeedingEmbedding = mergedItems.filter(item => {
  const existing = existingBySku.get(item.sku);
  if (!existing) return true;
  return getEmbeddingText({ item }) !== getEmbeddingText({ item: existing });
});

// 3. Generate only for the partition
const freshEmbeddings = itemsNeedingEmbedding.length > 0
  ? await generateManyEmbeddings({ values: itemsNeedingEmbedding.map(getEmbeddingText), ... })
  : [];

// 4. Upsert all items; only carry embedding for those that got fresh ones
const embeddingBySku = new Map(itemsNeedingEmbedding.map((item, i) => [item.sku, freshEmbeddings[i]]));
const itemsToUpsert = mergedItems.map(item => ({
  ...item,
  embedding: embeddingBySku.get(item.sku) ?? undefined,
}));
```

UPSERT `set` clause needs modification so `embedding` column is only written when explicitly provided (e.g., `embedding = COALESCE(excluded.embedding, catalog_items.embedding)`).

**Also delete the dead diff in `upsertCatalogItems`** — confusing and never-firing.

**Optional durable safeguard:** add an `embedding_source_hash` column (sha256 of `getEmbeddingText` output). Compare hashes instead of re-running `getEmbeddingText` on existing rows. Faster, and avoids fetching JSONB columns for the diff.

## Open questions for the fix

- **Is Cloudflare AI Gateway already deduplicating identical embedding requests?** If yes, the OpenAI $ cost is already minimal; the fix recovers Worker compute + Postgres writes only. If no, the fix recovers full OpenAI $.
- **Should we add the `embedding_source_hash` column** for durable dedup, or rely on per-call `getEmbeddingText` comparison? Hash column needs migration + backfill; comparison is simpler but recomputes text every time.
- **What's `processValidItemsBatch`'s typical N per batch?** If small (<100), the existence-check round-trip cost matters less; if large (~30K), batch the SKU lookup with reasonable IN-clause limits.
