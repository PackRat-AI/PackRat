---
date: 2026-06-05
topic: persistent-query-metrics
focus: Persistent database query performance tracking (compute & egress metrics per query, permanent history, call-site attribution)
mode: repo-grounded
---

# Ideation: Persistent Database Query Performance Tracking

## Grounding Context

**PackRat Architecture:** Bun monorepo (Elysia API on Cloudflare Workers + Drizzle ORM + Neon PostgreSQL with pgvector embeddings). Cost drivers: `catalog_items` and `pack_items` tables (50–100 KB/row unprojected; Tier-1 projection fixes shipped June 2026).

**Current State:**
- Projection discipline: lint enforced (`scripts/lint/no-unprojected-fat-table-queries.ts`); Tier-1 audit complete; cost reduction ~50–90% on hot paths
- Observability: Neon Console visual-only dashboards (compute/transfer trends, top-100 queries from pg_stat_statements); manual SQL snapshots; Sentry breadcrumbs documented but not auto-applied
- **Gap:** No persistent per-query metrics (ephemeral pg_stat_statements lost on compute suspend; no permanent call-site attribution; no per-endpoint cost breakdown; no trend history)

**Infrastructure Available:** AsyncLocalStorage (Cloudflare Workers `nodejs_compat`), Sentry (already initialized), Drizzle ORM (extensible via middleware), Workers Analytics Engine, Durable Objects, D1, R2.

**Context from Prior Work:**
- Neon Cost Profiling Runbook: documented 5-layer measurement methodology (console baseline → table stats → per-row sampling → Worker-side egress → post-deploy verification)
- Tier-1 Cost Projections Plan: established projection discipline + lint patterns
- Vector Search Cost Regression (June 2026): showed how one optimization (HNSW index on SELECT) exposed hidden cost surface (unaccelerated threshold-filter count query)

## Ranked Ideas

### 1. Drizzle Middleware + AsyncLocalStorage Request-Scoped Buffering

**Description:** Attach a Drizzle logger callback to all `createDb()` instances. Capture every query execution `{query, duration_ms, rowCount, estimatedEgressBytes}` into a request-scoped array (via AsyncLocalStorage, already used by Sentry). At request-end, flush the entire batch atomically to persistent storage (D1, Neon `query_metrics` table, Workers Analytics Engine, or R2).

**Rationale:** Core mechanism enabling all downstream detection, attribution, and alerting. Captures at ORM boundary (catches all query paths: Drizzle relational, raw SQL, `.execute()`). Request-scoped buffering is atomic (all-or-nothing per request). AsyncLocalStorage already in use via `@sentry/cloudflare`. Storage backend is pluggable (start with D1 for CF-native co-location; migrate to Neon or Analytics Engine later). Minimal instrumentation overhead.

**Downsides:** Adds 1–5ms per request for buffer management; requires choosing and implementing one persistence backend; does not auto-emit call-site attribution (needs SQLCommenter).

**Confidence:** 95%

**Complexity:** Medium

**Status:** Unexplored

---

### 2. SQLCommenter for Call-Site Attribution

**Description:** Auto-inject SQLCommenter-format SQL comments (`/*key=value, ...*/`) into every query carrying request context (requestId, userId, route, feature). Wrap Drizzle's query builder or use a logger hook to append comments before execution. Comments survive pg_stat_statements normalization, allowing post-hoc correlation of query hash back to originating endpoint and service.

**Rationale:** W3C standard (used at scale by Google, Stripe); production-proven. Bakes attribution directly into SQL text—survives Neon's ephemeral pg_stat_statements and enables external log parsing. Call-site attribution is automatic via request context in AsyncLocalStorage. Works across all SQL surfaces (Drizzle relational, raw `sql.raw()`, ETL workflows). Enables query-cost-per-endpoint analysis, Neon log parsing, service-map generation.

**Downsides:** Adds ~10–50 bytes per query (minor); requires async-local context threadability (available via `nodejs_compat`); parsing comments in post-hoc tools requires custom logic.

**Confidence:** 94%

**Complexity:** Low

**Status:** Unexplored

---

### 3. Query Fingerprinting + Histogram Aggregation (Persistent Time-Series)

**Description:** Normalize each query into a fingerprint `{table, operation, selected_columns_hash, where_clause_shape}` (no literal values). At query completion, increment aggregates per fingerprint per time-bucket (1-hour): call_count, min/max/p50/p95/p99 latency_ms, total_egress_bytes, total_row_count. Store aggregates in R2 as Parquet (weekly rollups), or continuously in D1/Clickhouse/Analytics Engine.

**Rationale:** Deduplicates naturally: same query fingerprint run 1000× in one hour = 1 aggregate row, not 1000. Enables trend detection ("top queries by egress this week"), anomaly alerting ("egress for catalog_search jumped 3×"), regression testing (compare before/after projections). Fingerprinting proven in APM (Datadog, New Relic); column-shape hash prevents query sprawl. Grounded in Neon's cost model (different column sets = different egress).

**Downsides:** Requires query normalization logic; initial column-shape hashing must be tuned to avoid under-grouping; aggregates are lower-resolution than raw events (can't drill to individual slow query).

**Confidence:** 88%

**Complexity:** Medium

**Status:** Unexplored

---

### 4. Workers Analytics Engine + Sentry Breadcrumb Integration

**Description:** Emit query metrics to two complementary sinks:
- **Workers Analytics Engine** (native Cloudflare, unlimited retention, time-series): per-query call counts, latency percentiles, egress bytes. Queryable via SQL API; Prometheus-exportable.
- **Sentry breadcrumbs** (per-request context): emit one breadcrumb per request with `{queryCount, totalComputeMs, totalEgressBytes, endpoint}` for cost alerting and exception linkage.

Route to Analytics Engine for long-term trends ("which endpoints cost most over the last 30 days"); route to Sentry for immediate actionability (per-request cost spike alerts, cost-per-exception correlation, budget overrun notifications).

**Rationale:** Both pieces of infrastructure already in place (Workers platform + Sentry initialization). Analytics Engine is unlimited-retention, included in Workers plan, Prometheus-compatible. Sentry is already sampled-traffic compatible and has native alerting on breadcrumb metrics. Pair them: granular metrics in Analytics Engine for root-cause analysis; aggregated requests in Sentry for actionability. Highly leveraging with zero new external dependencies.

**Downsides:** Requires wiring two emission paths; Analytics Engine queries require custom REST endpoint or SQL client; Sentry breadcrumbs are sampled.

**Confidence:** 87%

**Complexity:** Low

**Status:** Unexplored

---

### 5. Query Plan Capture + EXPLAIN Analysis Service

**Description:** For every query touching `catalog_items` or `pack_items`, run `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON)` in shadow mode (parallel execution, results discarded). Parse the plan JSON: detect sequential scans on unindexed filters, high buffer-hit ratios masking I/O, missing indexes. Store plans in a Durable Object or R2 per-query-fingerprint. Detect regressions: if the same query's plan changed, flag and alert.

**Rationale:** Neon's cost scale is driven by I/O plan choices. Capturing and analyzing plans gives permanent audit trail of indexing decisions. Enables proactive tuning (before slow queries surface in production). Plan regression detection catches silent performance degradation. Durable Objects provide stateful anomaly detection. Grounded: Tier-1 audit already identified indexes as a missing lever (beside projections).

**Downsides:** Plan capture adds latency per query (EXPLAIN runtime ~1–50ms, adds overhead); requires SQL parsing to detect anti-patterns; false positives possible (some Seq Scans intentional).

**Confidence:** 82%

**Complexity:** Medium

**Status:** Unexplored

---

### 6. Per-Request Cost Budget Enforcement + Rate-Limiting

**Description:** Declare a cost budget per endpoint (e.g., `GET /packs/{id}` ≤ 2 seconds compute + 8MB egress). At request-end, accumulate actual cost (from query metrics buffered in idea #1) and compare to budget. If exceeded, emit Sentry alert with breakdown (`query_hash, duration_ms, egress_bytes` ranked by cost). Optionally reject over-budget requests (return 429 + cost breakdown to client). Log all overruns to a `query_budget_overruns` table for trend analysis.

**Rationale:** Turns metrics into a control loop. Makes cost tangible and immediate to developers. Budget enforcement prevents blast radius: if one slow query pattern escapes, budget-overrun alerts fire within minutes. Grounded: established budget-aware culture (Tier-1 projections, projection lint). Actionable: developers see budget overrun immediately and fix root cause before merging.

**Downsides:** Requires calibrating budgets per endpoint (iterative); budget overruns without auto-rejection become noisy; distributed transaction complexity if enforcing across multiple services.

**Confidence:** 81%

**Complexity:** Medium

**Status:** Unexplored

---

### 7. ML Anomaly Detection + Cost Cardinality Tracking

**Description:** Train an Isolation Forest weekly on 7 days of per-query metrics (duration_ms, row_count, egress_bytes). Per-query fingerprint, learn baseline: "catalog_items SELECT {id, name} runs 50ms ± 10ms, returns 500 rows ± 100." At runtime, score each query; alert if actual significantly exceeds predicted (indicator of plan change, missing index, data explosion). In parallel, track unique query fingerprints via HyperLogLog cardinality; alert if new fingerprints appear faster than old retire ("query sprawl detected").

**Rationale:** Detects silent degradation that budget enforcement misses. Cardinality tracking detects structural problems (too many ad-hoc SQL variants, query generator bugs). Unlocks predictive alerting ("at current degradation rate, you'll exceed budget on June 20"). Grounded: Neon's cost scales with plan complexity; anomaly detection targets invisible changes (plan regression from stale stats, data distribution shift, accidental schema change).

**Downsides:** Requires ML infrastructure (lightweight model, training job + feature engineering); anomaly scores need tuning per workload; HyperLogLog approximation may miss rare fingerprints; model retraining weekly may miss intra-week regressions.

**Confidence:** 78%

**Complexity:** High

**Status:** Unexplored

---

## Rejection Summary

| Idea | Reason Rejected |
|---|---|
| Durable Objects metrics aggregation (standalone) | Subsumed by idea #1 (middleware) + Analytics Engine / D1 for storage |
| Workload-separated metrics (etl/api/admin) | Valuable reframing; implement as variant of #3 (fingerprint tag includes workload class) |
| Cost audit log + git correlation | Interesting for compliance, but secondary to core metrics; add in refinement |
| Embedding-specific tracking | Domain-specific optimization; implement as variant of #1 (filter for embedding queries) |
| Column-byte-weight metadata | Useful for egress estimation; integrate into #1's buffering layer's calculation |
| Cascade / N+1 detection | Valuable anti-pattern; add to #1's post-request analysis phase |
| Request sampling + reservoir algorithms | Useful optimization; layer onto #4 (Analytics Engine sampling) in refinement |
| Sentry attachment + full-request log | Subsumed by #4 (breadcrumb integration) + optional #1 variant |
| Neon webhook subscription | Valid but premature; start with #1 (app-side buffering); webhooks are follow-on source |
| pg_stat_statements snapshot cron | Ephemeral on Neon; #3 fingerprinting gives durable equivalent |
| Per-row size sampling | Manual, doesn't scale; #2 (column-byte estimates) + #4 (Analytics Engine) are scalable |
| Lineage tracing (DAG cost attribution) | Valuable for multi-service, but complex; brainstorm-candidate after proving #1–7 |
| Plan regression via git commit correlation | Cool but secondary; focus on #5 (plan storage + anomaly detection) first |
| Index auto-filing GitHub issues | Automation forward; start with alerts (#5), let ops create tickets |
| Budget-based custom user pricing | Premature; #6 uses flat cost model first |
| Async queue-based event deduplication | Complexity; use aggregation-time dedup (#3) instead |
| External APM (Datadog, Clickhouse) | Valid but introduces vendor lock-in; #4 (native CF + Sentry) proves value first |

---

## Next Step

The 7 survivors cover:
- **Collection** (#1): Drizzle middleware
- **Attribution** (#2): SQLCommenter
- **Aggregation** (#3): Fingerprinting + histograms
- **Visibility** (#4): Analytics Engine + Sentry
- **Optimization** (#5): Plan analysis + regression detection
- **Control** (#6): Cost budgets + enforcement
- **Prediction** (#7): Anomaly detection + cardinality

**Recommendation:** Start with #1 + #2 (core collection + attribution); they unblock #3–7. Brainstorm #1 in depth to finalize storage backend choice (D1 vs. Neon vs. Analytics Engine) before implementation.
