# Neon Cost Profiling

Methodology and runnable SQL for diagnosing Neon Postgres cost spikes and verifying cost-reduction PRs. Anchored to the 2026-06-01 catalog-projection audit ([docs/brainstorms/2026-06-01-neon-cost-reduction-requirements.md](../brainstorms/2026-06-01-neon-cost-reduction-requirements.md)) but intended as a generic toolkit for future investigations.

## When to use this

- A cost-reduction PR shipped and you want to prove the projection / query / index change actually moved Neon's compute or egress
- The bill jumped unexpectedly and you need to find which tables / queries are responsible
- You're sizing the catalog (or any other heavy table) before designing a structural change like a pivot-table migration

## What Neon meters, and how to see each

| Cost line | Where it surfaces | Diagnostic angle |
|---|---|---|
| **Compute hours** | Neon Console → Monitoring → Compute trend | "How much time is at least one query in flight (or the compute holding idle past the 5-min cutoff)?" |
| **Data transfer (egress)** | Neon Console → Monitoring → Data transfer | "How many bytes left Neon's network to my Worker / clients today?" |
| **Storage** | Neon Console → Storage tab | Heap + TOAST + indexes per table |

The Console gives you visual baselines without any SQL. For deeper attribution use the queries below.

## Step 1 — Console-only baseline (no SQL)

Before any code change, screenshot:

1. **Monitoring → Compute** (last 7 days). Look for "always-on" plateaus vs. valleys with scale-to-zero.
2. **Monitoring → Data transfer** (last 7 days). Spikes correlate with ingest jobs or hot-list traffic.
3. **Monitoring → Top Queries**. Sort by **Total time** and by **Rows returned**, screenshot both. This data is from `pg_stat_statements` preloaded at the compute layer — readable in the Console without `CREATE EXTENSION` in your database.
4. **Storage tab**. Per-table size + growth rate.

Repeat 24-48 hours after deploy. The diffs are your before/after evidence without touching the schema.

## Step 2 — Table-level read-load snapshot (no extension)

Always-available via `pg_stat_user_tables`. Run before AND after a cost-reduction PR; save both outputs.

```sql
SELECT relname,
       seq_scan,                                              -- # of full / range scans
       seq_tup_read,                                          -- total rows fetched by seq scans (the big number to watch)
       idx_scan,                                              -- # of index scans
       idx_tup_fetch,                                         -- rows fetched via index
       n_tup_ins, n_tup_upd, n_tup_del,                       -- mutation counts (good for spotting runaway updates)
       pg_size_pretty(pg_relation_size(relid))   AS heap,
       pg_size_pretty(pg_total_relation_size(relid)) AS total
FROM pg_stat_user_tables
WHERE relname IN ('catalog_items', 'pack_items', 'packs')     -- swap in tables you care about
ORDER BY seq_tup_read DESC;
```

What the columns tell you:

- `seq_tup_read` deltas — the projection wins land here. If U2-U6 cut catalog SELECTs in half, this drops in half.
- `n_tup_upd` divided by row count — a "lifetime updates per row" sanity check. Anything above ~5 is suspicious and worth investigating (the catalog-projections audit surfaced ~44 updates/row, which traced back to a no-op embedding-regen diff loop).
- `idx_scan` vs `seq_scan` ratio — on small tables (< ~1 MB) Postgres prefers seq scan and that's correct; on large tables a high seq_scan count usually means a missing or unused index.

To reset and get a clean window (requires owner role):

```sql
SELECT pg_stat_reset_single_table_counters((SELECT relid FROM pg_stat_user_tables WHERE relname='catalog_items'));
```

## Step 3 — Per-row size distribution (no extension, sampled)

`pg_column_size(table.*)` over the full table will time out on anything > a few thousand rows because each call has to detoast the large JSONB and vector columns. Use `TABLESAMPLE BERNOULLI` to sample 1-5% instead.

**Per-column average sizes** (which JSONB column dominates the bytes):

```sql
SELECT
  COUNT(*) AS sampled,
  pg_size_pretty(AVG(pg_column_size(embedding))::bigint) AS avg_embedding,
  pg_size_pretty(AVG(pg_column_size(reviews))::bigint)   AS avg_reviews,
  pg_size_pretty(AVG(pg_column_size(qas))::bigint)       AS avg_qas,
  pg_size_pretty(AVG(pg_column_size(faqs))::bigint)      AS avg_faqs,
  pg_size_pretty(AVG(pg_column_size(techs))::bigint)     AS avg_techs,
  pg_size_pretty(AVG(pg_column_size(variants))::bigint)  AS avg_variants,
  pg_size_pretty(AVG(pg_column_size(images))::bigint)    AS avg_images
FROM catalog_items TABLESAMPLE BERNOULLI (1);
```

**Distribution percentiles** (how skewed — i.e., is the bill driven by a long tail of fat rows or by every row equally?):

```sql
SELECT
  COUNT(*) AS sampled,
  pg_size_pretty(percentile_cont(0.5)  WITHIN GROUP (ORDER BY pg_column_size(c.*))::bigint) AS p50,
  pg_size_pretty(percentile_cont(0.9)  WITHIN GROUP (ORDER BY pg_column_size(c.*))::bigint) AS p90,
  pg_size_pretty(percentile_cont(0.99) WITHIN GROUP (ORDER BY pg_column_size(c.*))::bigint) AS p99,
  pg_size_pretty(MAX(pg_column_size(c.*))::bigint) AS max_observed
FROM catalog_items TABLESAMPLE BERNOULLI (1) c;
```

A wide p50→p99 gap means list endpoints that sort by rating / popularity / usage pull mostly the fat rows — projection wins are larger than the average-row math suggests.

**TOAST vs main heap split** (instant — metadata only, no row scan):

```sql
SELECT
  pg_size_pretty(pg_relation_size('catalog_items'))      AS heap_main,
  pg_size_pretty(pg_relation_size(
    (SELECT reltoastrelid FROM pg_class WHERE relname='catalog_items')
  ))                                                      AS toast_storage,
  pg_size_pretty(pg_indexes_size('catalog_items'))       AS indexes,
  pg_size_pretty(pg_total_relation_size('catalog_items')) AS total;
```

High TOAST ratio (e.g., TOAST > main heap) means most rows have fat fields stored in out-of-line storage that get detoasted on access. Projection-discipline pays off the most for tables with this shape.

## Step 4 — Per-query depth (optional, requires `pg_stat_statements`)

`pg_stat_statements` is the canonical Postgres query profiler. **Neon preloads it at the compute layer** (which is how the Console's Top Queries panel works), but reading it from SQL needs the extension registered in your database:

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

**Conservative approach for production:** don't enable it on prod without testing first. Use Neon branching:

```bash
neon branches create --name test-pg-stat-statements --parent main
```

Then register the extension on the branch, confirm it behaves as expected, then decide whether to enable on main. Zero impact on prod traffic during validation.

Once enabled, the high-value query:

```sql
SELECT query,
       calls,
       rows,
       total_exec_time,
       mean_exec_time,
       shared_blks_read * 8192 AS bytes_read     -- pages × 8KB ≈ disk bytes
FROM pg_stat_statements
WHERE query ILIKE '%catalog_items%' OR query ILIKE '%pack_items%'
ORDER BY total_exec_time DESC
LIMIT 30;
```

`pg_stat_statements_reset()` (owner role required) clears the slate between before/after windows.

## Step 5 — Worker-side response-byte logging

DB-side measurement bounds what leaves Neon. Worker-side measurement bounds what reaches clients. Both matter for different cost lines (compute + Neon egress vs. Cloudflare bandwidth + LLM context cost).

Cheapest pattern — Sentry breadcrumb on every Drizzle call site or response handler:

```ts
import { apiAddBreadcrumb } from '@packrat/api/utils/sentry';

const rows = await catalogService.getCatalogItems({ limit });
apiAddBreadcrumb({
  category: 'db.egress',
  message: 'catalog.list',
  level: 'info',
  data: {
    rowCount: rows.items.length,
    serializedBytes: JSON.stringify(rows).length,
  },
});
```

Searchable later by `category:db.egress` in Sentry. Surface a percentile chart of `serializedBytes` per endpoint and you have a permanent per-request egress monitor.

For Worker → client specifically, wrap the response in a middleware that logs `response.headers.get('content-length')` (or computes from body length before returning) and ships to wrangler tail / Workers Logs.

## How to verify a cost-reduction PR (the U8 pattern)

The Tier-1 projections PR (2026-06-01) introduced this verification flow. Reuse it for future cost work:

**Before merge** (capture baseline):

1. Console screenshots: Compute trend (7d), Data transfer (7d), Top Queries (sorted by Total time AND by Rows returned).
2. Save the Step 2 `pg_stat_user_tables` output to a file (`baseline-pre-merge.txt`).
3. Run Step 3's three queries and save outputs.

**Merge and deploy.** Wait 24-48 hours for the metrics to populate against realistic traffic.

**After (verify):**

1. Console screenshots again. Same panels, same time window.
2. Re-run Step 2's pg_stat_user_tables query. Diff `seq_tup_read` and `n_tup_upd` against baseline.
3. Re-run Step 3's queries. Sizes themselves shouldn't change (projection doesn't shrink stored rows), but you're confirming the table grew on schedule and TOAST ratio is sane.

**What "good" looks like:**

- `seq_tup_read` on the target table dropped proportional to the projection change
- Top Queries panel: target queries dropped in rank, or disappeared entirely
- Compute hours: visibly lower steady-state, especially during idle traffic windows
- Data transfer: lower per-day total (factor in any non-cost-related traffic changes)
- Bill: lower at next cycle close, controlling for ingest activity

**What "investigate further" looks like:**

- Compute hours stay continuously warm post-deploy → projection alone wasn't enough; next lever is API-traffic batching to enable scale-to-zero windows
- Egress dropped but compute didn't → reads got cheaper but updates / inserts are still hot; investigate `n_tup_upd` growth
- Some queries dropped in rank but new ones appeared → the lint (if you have one) is doing its job catching new patterns; or some path bypasses the projection rule

## Related

- Projection-discipline rules: see `CLAUDE.md` → Conventions → API → "DB query projection discipline" (once PR #2544 lands)
- Lint enforcing the discipline: `scripts/lint/no-unprojected-fat-table-queries.ts`
- Cost-bearing projection types: `packages/db/src/projections.ts`
- Originating audit: `docs/brainstorms/2026-06-01-neon-cost-reduction-requirements.md`
- Tier-1 PR: https://github.com/PackRat-AI/PackRat/pull/2544
