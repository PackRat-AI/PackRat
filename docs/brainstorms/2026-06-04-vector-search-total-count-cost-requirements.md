# Vector Search `totalCount` Bypasses HNSW — Investigation Scope

- **Date:** 2026-06-04
- **Status:** Captured signal from PR #2554 review (Copilot, low-confidence). Real concern, not a regression introduced by the HNSW fix. Investigation needed before deciding which option fits.
- **Related:** PR #2554 (HNSW fix), [docs/brainstorms/2026-06-01-vector-search-hnsw-unused-requirements.md](./2026-06-01-vector-search-hnsw-unused-requirements.md), PR #2544 (Tier-1 projections)

## Problem

`CatalogService.vectorSearch` returns a `total` field alongside the paged items, computed via a second query:

```ts
this.db
  .select({ totalCount: count() })
  .from(catalogItems)
  .where(vectorWhere);   // includes distance < 0.9 (post-HNSW-fix) or 1 - distance > 0.1 (pre-fix)
```

HNSW indexes only accelerate `ORDER BY <vector-op> LIMIT top-K` patterns. Counting matches under a distance threshold has to compute the distance for every row that passes other WHERE predicates — it doesn't use the index for the predicate evaluation. So this count query likely does a full filter scan over ~1.79M `catalog_items` rows, computing cosine distance for each, on every vector-search call.

**This pre-dates PR #2554.** The pre-HNSW-fix code had the same query shape (`gt(similarity, 0.1)` instead of `lt(distance, 0.9)`). PR #2554's HNSW fix makes the SELECT path ~115× cheaper without making the count path worse — but the count remains the dominant cost on every call once the SELECT becomes cheap.

## Hypothesis

The `total` field is over-engineered for actual consumer needs:

- **AI tool callers** (the catalogVectorSearch tool exposed to Vercel AI SDK) don't paginate — they take the top N and move on. Don't need `total`.
- **Mobile search** likely paginates but with infinite-scroll patterns where `nextOffset` is sufficient; the user-visible "showing X of Y results" string is the only consumer of `total`.
- **Web search** could go either way — depends on whether the search results page shows a result count.

If most consumers don't need `total`, paying for a full-scan count on every call to satisfy the few that do is wasteful.

## Options

### A — Make `total` opt-in via query parameter

```ts
async vectorSearch({ q, opts = {}, includeTotal = false }: { ... }) {
  const items = await /* top-K HNSW query */;
  const total = includeTotal ? await /* count query */ : undefined;
  return { items, total, /* ... */ };
}
```

REST callers that need it pass `?includeTotal=1`. AI tool calls don't pass it; pay zero for the count. Default-off pushes consumers to think about whether they need it.

**Pro:** simple, backward-compatible if `total` was already nullable, callers control cost
**Con:** API contract change; mobile/web that already expected `total` need updating

### B — Drop `total` entirely; use `nextOffset`-based pagination

Already returned. Consumers paginate by checking whether `items.length === limit` (more results may exist) or `< limit` (last page).

**Pro:** removes the cost line entirely; cleanest API
**Con:** consumers lose "X of Y" UX; breaking API change

### C — Approximate count via `pg_class.reltuples` + selectivity estimate

```sql
SELECT (SELECT reltuples FROM pg_class WHERE relname='catalog_items') * <estimated_selectivity_under_threshold>
```

No row scan, just metadata + a guess. For vector similarity, "rows under distance threshold T" maps roughly to a fraction of the embedding space, but the relationship is highly query-dependent. Hard to make reliable.

**Pro:** instant, zero scan cost
**Con:** estimate quality is shaky; consumers expecting accuracy will be confused

### D — Drop the threshold filter from the count query; count = `LIMIT` or `count() <= LIMIT * 10`

For pagination UX, knowing "are there at least 100 results" is often enough. Could count up to `limit * 10` and report "100+" or the exact number.

```sql
SELECT count(*) FROM (
  SELECT 1 FROM catalog_items WHERE embedding IS NOT NULL ORDER BY embedding <=> $1 LIMIT 100
) sub;
```

HNSW serves the inner query (top-100); count is over the small result set.

**Pro:** HNSW-eligible, instant; supports "100+" UX
**Con:** loses precision for high-result-count queries

### E — Accept the cost (do nothing)

Document the cost in a code comment; revisit if Neon bill or vector-search latency becomes a problem.

**Pro:** zero work
**Con:** the count query becomes the dominant cost on every vector search post-HNSW-fix; was previously hidden by the equally-expensive SELECT path

## Goals

- Quantify the count query's actual cost (EXPLAIN ANALYZE + Worker latency measurements post-HNSW-fix)
- Identify all consumers of `total` across mobile + web + AI tool callers
- Pick one of A-E based on cost-impact vs. consumer-impact trade-off

## Non-goals

- Reworking the entire vector search API surface
- Tuning HNSW parameters (deferred to its own plan)
- Pivot-table migration (deferred to its own plan)

## Investigation plan

1. **Wait for PR #2554 to merge** so the count query becomes the visible cost line (currently hidden by the equally-expensive SELECT)
2. **EXPLAIN ANALYZE the count query** against prod after the HNSW fix lands. Real cost number, not estimate.
3. **Grep consumer code** for `total` reads on vector search responses:
   - `apps/expo/features/catalog/hooks/useVectorSearch.ts`
   - AI tool consumers (`packages/api/src/utils/ai/tools.ts`)
   - Any web app catalog search hooks
4. **Spot-check what mobile renders** with `total` — is it a numeric badge? "X of Y" string? Or unused?
5. **Decide A-E** based on findings

## Open questions

- Does mobile's catalog search actually display the total? If unused → Option B (drop it) is cheapest
- Does the AI tool's `catalogVectorSearch` consumer use the `total` field in its prompt context? If unused → don't compute it on the AI-tool path even if REST keeps it
- Is "100+" UX acceptable for any caller? → Option D becomes attractive

## Verification (post-decision)

- For options A/B/D: response shape change tracked + characterization tests updated
- For option C: a comparison test that says "estimate is within 20% of true count over a sample of 50 queries" or similar tolerance
- Worker-side latency measurement (Sentry breadcrumb) showing vectorSearch p50/p99 dropped post-decision

## Scope boundaries

**In scope (this investigation):**
- Diagnose the count cost post-PR-#2554
- Audit consumers of `total`
- Pick + implement one option

**Deferred (separate plans):**
- HNSW parameter tuning
- Pivot-table migration
- The embedding-regen anomaly investigation
- Broader vector-search API redesign
