---
title: "refactor: Migrate catalog ETL to Cloudflare Workflows"
type: refactor
status: active
date: 2026-05-20
origin: docs/audits/2026-05-16-etl-audit.md
supersedes: docs/plans/2026-05-19-001-fix-etl-pipeline-audit-remediation-plan.md
---

# refactor: Migrate catalog ETL to Cloudflare Workflows

## Summary

Replace the Cloudflare-Queues-based catalog ETL pipeline with a Cloudflare Workflows-based pipeline. Workflows natively provides durable step execution, automatic memoized retries, durable state between steps, and built-in instance status — eliminating roughly half the original audit-remediation plan, which was manually reconstructing those primitives on top of Queues + Postgres. The audit's findings about CSV correctness (chunk-boundary row alignment, header injection), observability, validator hardening, log retention, and the operational runbook remain real and are addressed here. Delivered in three phases: spike + producer-side rewiring; correctness + observability; hardening + tests + docs.

---

## Problem Frame

The catalog ETL audit at `docs/audits/2026-05-16-etl-audit.md` enumerated 16 findings (2 P0, 5 P1, 6 P2, 5 P3) and live prod data (192 runs / 74 failed = 38% failure rate; 7 large jobs falsely marked `failed` by a wall-clock-based sweep on 2026-05-14) confirmed the pipeline is silently incorrect. The first attempted remediation (the now-superseded `2026-05-19-001` plan) tried to fix the Queues-based design in place. Doc review on that plan surfaced a load-bearing P0: the design relied on atomicity between Postgres transactions and Cloudflare Queue `sendBatch` calls that the runtime cannot provide, plus the `drizzle-orm/neon-http` driver doesn't support session-bound transactions with external awaits. Resolving that fork added an outbox table, a cron dispatcher, a watchdog sweep, and a driver switch — making it ~8 units of plumbing to manually rebuild durable execution.

Cloudflare Workflows ships durable execution natively: `step.do(name, fn)` is automatically memoized and retried, step results are persisted between steps (≤1 MiB each), step.sleep survives Worker restarts, instance state IS the job state, and the dashboard surfaces stuck/errored/complete instances without a custom sweep. The producer becomes a one-line `env.ETL_WORKFLOW.create({ params })` call; the entire chunk-completion state machine, DLQ wiring, sweep cron, and outbox plumbing collapse into Workflows-managed state.

---

## Requirements

- R1. **Every catalog source CSV is fully ingested or fully failed-and-recoverable.** No partial completion, no premature "completed" status, no orphan rows.
- R2. **Chunk-boundary correctness.** No row is dropped, invalidated, or duplicated at byte-range chunk boundaries. CSV headers wider than 4 KB do not silently misalign columns.
- R3. **Operators can re-ingest any historical job from scratch** without invoking the original producer endpoint. The 7 historical jobs from 2026-05-14 are recoverable via this path.
- R4. **Every completed ingest has post-ingestion row-count verification.** R2 source row count is compared to the ingested count and surfaced as observable signal; significant deltas emit Sentry warnings.
- R5. **Failures are visible.** Every workflow error reaches Sentry with `jobId`, `chunkIndex`, source key, and step name. Operators can debug without reading raw Worker logs.
- R6. **Embedding-fallback degradation is observable.** A workflow that completed without embeddings is distinguishable from a fully-successful one.
- R7. **Validator rejects unsafe URLs and oversize fields.** Mobile/web cannot be tricked into rendering `javascript:`, IDN homograph, or RFC-1918 URLs from the catalog.
- R8. **`invalid_item_logs` retention is bounded.** A bad upload cannot fill Neon storage indefinitely.
- R9. **A documented runbook exists** covering trigger / inspect / retry / repair / reconcile / drain operations against Workflows.
- R10. **Test coverage exists for every behavior above**, including the cases the legacy global queue-mock currently hides.

---

## Scope Boundaries

- The plan does not migrate the embeddings pipeline. `EMBEDDINGS_QUEUE` continues to operate as a Cloudflare Queue with the existing producer/consumer pattern. Only the catalog ETL pipeline moves to Workflows.
- The plan does not rewrite the existing `etl_jobs` data for the 7 historical jobs falsely marked `failed`. The re-ingest workflow is the recovery mechanism; the actual recovery run is operational, not a code unit.
- The plan does not raise queue concurrency on `EMBEDDINGS_QUEUE` or alter its configuration.
- The plan does not change the catalog data model, `catalogItems`, or downstream consumers (`apps/expo`, `apps/guides`, `apps/landing`).
- The plan does not introduce a separate ETL Worker; the existing `packages/api` Worker hosts both the HTTP routes and the new Workflow binding.

### Deferred to Follow-Up Work

- **Soft-delete / discontinued-item reconciliation** (audit P3 #3): documented as accepted limitation in the runbook (catalog is scraper-controlled, not user content).
- **Embeddings-queue DLQ + retry policy**: separate plan once the catalog ETL pivot is proven in production.
- **Workflows-based scraper orchestration**: out of scope. Scrapers continue to write CSVs to `packrat-scrapy-bucket`; this plan only touches what happens after the file lands.
- **`@sentry/cloudflare` cold-start performance regression**: measured if observed, addressed in a follow-up. Not blocking this plan.

---

## Context & Research

### Relevant Code and Patterns

- **Producer endpoint** (current): `packages/api/src/routes/catalog/index.ts:229-293` — `POST /catalog/etl`. Will be reduced to a Workflow trigger.
- **Per-chunk processor** (current, to be replaced): `packages/api/src/services/etl/processCatalogEtl.ts` (208 lines). Its inner logic (R2 byte-range read, CSV parse, batch flush, embeddings + upsert + invalid-log handoff) becomes the body of `step.do()` calls inside the new workflow.
- **Queue producer/consumer** (current, to be removed): `packages/api/src/services/etl/queue.ts` — `queueCatalogETL` and `processQueueBatch`. Deleted at end of Phase 1.
- **R2 access**: `packages/api/src/services/r2-bucket.ts:193-360` — `R2BucketService` wrapping AWS S3 client. Works inside Workflows the same as inside a Worker handler. Will be spike-tested in U1.
- **Drizzle Neon access**: `packages/api/src/db/index.ts:82-84` — `createDbClient(env)` returns the neon-http driver. Inside a `step.do()` callback, single-statement DB calls and multi-statement batched transactions both work; the issue with the Queues-based plan was awaiting *external* RPCs inside `db.transaction()`. In Workflows, each `step.do()` is its own unit of atomicity, so the driver's HTTP-batch limitation is no longer a blocker.
- **Embeddings**: `packages/api/src/services/catalogService.ts` — `generateManyEmbeddings` + the existing `EMBEDDINGS_QUEUE` pattern. Unchanged. The ETL workflow calls this inside a `step.do()`; embedding failures increment a counter (R6) without re-firing on retry (memoization).
- **Existing ETL test**: `packages/api/test/etl.test.ts` — integration test against real Postgres via Docker wsproxy at `localhost:5434`. New workflow-based tests follow the same fixture/mock pattern. `packages/api/test/setup.ts:544-551`'s global queue mock is removed since the queue no longer participates.
- **Schema location**: `packages/db/src/schema.ts:446-510`. Smaller migration than the superseded plan needed — most chunk-tracking columns are absorbed into Workflows instance state.
- **Wrangler config**: `packages/api/wrangler.jsonc` — new `workflows` binding added; the `packrat-etl-queue` producer + consumer entries removed at the end of Phase 1 once the producer cuts over.
- **Admin routes**: `packages/api/src/routes/admin/analytics/catalog.ts` — `GET /admin/analytics/catalog/etl` continues to read from `etl_jobs`; admin retry/repair endpoints now trigger workflow instances rather than enqueue messages.
- **Admin CLI**: `packages/cli/src/commands/admin/etl.ts` — subcommands re-target the new admin endpoints.

### Institutional Learnings

- `docs/solutions/` carries no prior Workflows or queue-based-ETL learnings — this is the first project Workflows footprint. After Phase 2 ships, `/ce-compound` candidates: (a) "Cloudflare Workflows step.do idempotency for batch ETL", (b) "Migration from Queues-based state machine to Workflows".

### External References

- **Cloudflare Workflows API** (verified 2026-05-20): <https://developers.cloudflare.com/workflows/>. `step.do(name, fn)` is idempotent + memoized by step name within an instance. Built-in retries with configurable backoff; `step.sleep` / `step.sleepUntil` for durable waits.
- **Workflows limits** (verified 2026-05-20): <https://developers.cloudflare.com/workflows/reference/limits/>. 10,000 steps per instance (configurable to 25,000); 30s CPU per step (configurable to 5 min); wall-clock unlimited per step; step output max 1 MiB; 50,000 concurrent running instances on Paid; 1 GB state per instance.
- **Workflows pricing**: documented but ambiguous in the public docs as of plan-write — verified in U1 spike with `wrangler workflows`/dashboard inspection at PackRat's scale (~250 jobs/day × ~3 steps/job).
- **Cloudflare Queues** (existing, retained for `EMBEDDINGS_QUEUE` only): <https://developers.cloudflare.com/queues/configuration/javascript-apis/>.
- **R2 S3 API compatibility**: <https://developers.cloudflare.com/r2/api/s3/api/> — range reads via AWS SDK work identically inside Workflows.
- **Sentry on Cloudflare**: <https://docs.sentry.io/platforms/javascript/guides/cloudflare/> — first-party `@sentry/cloudflare` with `Sentry.withSentry({ fetch, queue, workflow })` wrapping pattern.

---

## Key Technical Decisions

- **One workflow per source CSV.** `CatalogEtlWorkflow` takes `{ objectKey, source, scraperRevision }` as params; the instance ID derives from `(source, filename)` so duplicate triggers for the same file (e.g., from a producer-side retry) are no-ops via Workflows' instance-id idempotency. This subsumes the deepening pass's per-chunk idempotency table entirely.
- **Chunks become workflow steps, not queue messages.** For each chunk index, the workflow runs `step.do(\`chunk-${i}\`, async () => processChunk(...))`. Workflows memoizes the step result, so a retry of a partially-completed workflow resumes from the last unfinished step. The audit's P0 #1 (premature completion) and P0 #2 (swallowed errors) are non-findings.
- **No `etl_job_chunks`, `etl_outbox_messages`, `etl_dlq_events`, `chunks_total/chunks_completed/last_progress_at/superseded_*` columns.** Workflows instance state IS the job state. The `etl_jobs` table retains its existing shape (id, status, source, filename, started_at, completed_at, total_processed, total_valid, total_invalid, scraper_revision) plus three new columns for DB-side denormalization that admin queries need: `workflow_instance_id text` (the Workflows instance id), `verified_at timestamp`, `verified_row_count integer`. The `total_embedding_failures integer DEFAULT 0 NOT NULL` column is also added for R6.
- **Repair-from-scratch creates a new workflow instance with a new `(source, filename, scraperRevision)` triple keyed by a fresh nonce in the instance id**, so the original instance and the repair instance are both queryable in the Workflows dashboard and both have rows in `etl_jobs`. A new `superseded_by_job_id text` column on `etl_jobs` (FK to `etl_jobs.id`, `ON DELETE SET NULL`) links them; a `superseded_at timestamp` preserves the timeline even after FK cleanup. CHECK prevents self-reference.
- **R2 source ETag captured at workflow start.** New `source_etag text` and `source_last_modified timestamp` columns on `etl_jobs`. Repair-from-scratch compares the stored ETag against fresh `r2.head().etag` and returns 409 on mismatch unless `?force=true` is supplied. For legacy rows (the 7 historical jobs), the U1 migration backfills ETag once by reading `r2.head()` at migration time — closing the audit's source-verification gap without an operator escape hatch.
- **Reconciliation is the final step of every workflow.** No separate queue; no `verified_row_count_partial` checkpoint column needed (a single step can run for 5 min CPU + unlimited wall-clock, which covers all realistic source sizes; if a workflow ever hits the 5-min step CPU limit, it's split into N counting steps by chunk range). Reconciliation reads the source via `r2.get(key)` and counts logical rows using `csv-parse` (not raw newline counting — this closes the audit-corrected finding about quoted multi-line CSV fields).
- **Row-boundary alignment lives in the producer (`chunkCsvForR2` helper).** Each chunk window's `byteEnd` is snapped to the last `\n` in a small (64 KB) tail-read; chunks emit on row boundaries; the consumer no longer needs `skipPartialRow` logic. The 64 KB peek reads are parallelized with `Promise.all` so the producer-side CPU budget is not strained for multi-GB files. Resolves audit P1 #3/#4/#5.
- **Header injection for non-first chunks uses a bounded-expand re-fetch loop** (4 KB → 16 KB → 64 KB), throwing a typed `EtlHeaderError` if no newline appears in 64 KB. Resolves audit P1 #3 silent column misalignment.
- **Workflow retry policy** is per-step: `{ limit: 3, delay: '30s', backoff: 'exponential' }` for chunk-processing steps; `{ limit: 0 }` for reconciliation (a delta is data, not a failure — surface to Sentry and continue). On total workflow failure (all retries exhausted), Workflows marks the instance `errored`, the workflow's final cleanup step runs (set `etl_jobs.status='failed'`, capture Sentry event with all chunk failure history). No DLQ table needed; the Workflows dashboard is the forensic surface.
- **`@sentry/cloudflare` wraps `{ fetch, queue, workflow }`** in `packages/api/src/index.ts`. Per-step `Sentry.startSpan` for chunk processing; `Sentry.captureException` on step failure; tags include `jobId`, `workflowInstanceId`, `chunkIndex`, `r2Key`. `error_stack` is contractually free of raw CSV row data (documented at call sites; the U10 test asserts it). Sentry source-map upload via `@sentry/cli sourcemaps upload` is wired into CI as part of U6 — not just `upload_source_maps: true` in wrangler.jsonc.
- **URL validator** (U7) restricts to `http(s):`, rejects IDN homograph (deny non-ASCII hostnames or normalize via punycode and compare), rejects RFC-1918 / loopback / link-local hostnames after DNS resolution-pattern check (string-level, not network). Length cap 2048. SKU charset `/^[A-Za-z0-9_.\-\/]+$/` max 200 chars.
- **`invalid_item_logs` retention runs as a scheduled Workflow** (or a CF Cron Trigger calling a deletion step). Batched DELETE: loop `DELETE FROM invalid_item_logs WHERE id IN (SELECT id FROM invalid_item_logs WHERE created_at < now() - interval '90 days' LIMIT 10000)` until 0 rows; surface Sentry warning if a single run hits a max-iteration cap.

---

## Open Questions

### Resolved During Planning

- **Queues vs Workflows for execution.** Resolved: Workflows. Eliminates ~8 units of plumbing that the prior plan needed.
- **Per-chunk idempotency.** Resolved: free via `step.do(name, fn)` memoization. No `etl_job_chunks` table.
- **DB+Queue atomicity.** Resolved: no longer applicable. Each `step.do()` is its own unit of durability; Workflows persists step results between steps.
- **Drizzle driver choice.** Resolved: stay on `neon-http`. The audit-plan blocker (transactions with external awaits) doesn't apply because each step is atomic.
- **Stuck-job sweep design.** Resolved: not needed. Workflows surfaces stuck/errored instances natively in the dashboard.
- **DLQ design.** Resolved: not needed. Failed workflow instances are the forensic record.
- **CSV parser for reconciliation.** Resolved: use `csv-parse` (not raw newline counting). Closes the quoted-multiline-field correctness gap.
- **Workflow instance ID strategy.** Resolved: deterministic ID `${source}-${filename}` for first ingest (prevents duplicate triggers); repair-from-scratch uses `${source}-${filename}-repair-${nonce}`.
- **Producer cutover strategy.** Resolved: coexist both paths during transition. The producer endpoint accepts a `?engine=workflow|queue` query parameter (default `workflow`); operators can fall back to the queue path during a rollback window. After Phase 1 bakes for a week with no fallback usage, the queue path is removed in a Phase 2 cleanup PR.

### Deferred to Implementation

- **Workflows pricing at PackRat's scale.** ~250 jobs/day × ~3 chunks/job = ~750 step executions/day. U1's spike confirms cost is comfortably within Workers Paid; if not, escalate before Phase 2.
- **Exact step CPU budget per chunk.** The 30s default is likely sufficient; if R2 + Drizzle + embeddings + upsert overruns, bump to `cpu_ms: 60000` or split chunk processing into sub-steps (parse → embed → upsert).
- **Reconciliation step CPU budget for the largest historical files (50,100 rows / ~30 MB).** Likely <10s in CPU; verified in U1 spike.
- **Cron trigger for retention sweep — separate Workflow vs traditional cron-handler.** Both work; choose based on Phase 3 ergonomics.
- **Sentry sampling rate** for Workflows spans. Default `tracesSampleRate: 0.1`; tune in production.

---

## Output Structure

    packages/api/src/
    ├── workflows/
    │   ├── catalog-etl-workflow.ts          (NEW — the main ETL workflow)
    │   ├── retention-workflow.ts            (NEW — invalid_item_logs sweep)
    │   └── shared/
    │       ├── chunkCsvForR2.ts             (NEW — row-boundary-aligned chunking)
    │       └── reconcileJob.ts              (NEW — final-step row count comparison)
    ├── services/etl/
    │   ├── CatalogItemValidator.ts          (MODIFIED — U7 hardening)
    │   ├── mergeItemsBySku.ts               (MODIFIED — aggregate log per batch)
    │   ├── processValidItemsBatch.ts        (MODIFIED — embedding-fallback counter)
    │   ├── processLogsBatch.ts              (MODIFIED — rethrow on DB failure)
    │   ├── constants.ts                     (NEW — ITEM_FLUSH_BATCH_SIZE etc.)
    │   ├── processCatalogEtl.ts             (DELETED — superseded by workflow)
    │   └── queue.ts                         (DELETED at end of Phase 1)
    ├── routes/catalog/index.ts              (MODIFIED — producer triggers workflow)
    ├── routes/admin/analytics/catalog.ts    (MODIFIED — retry/repair/reconcile route workflows)
    ├── utils/logger.ts                      (NEW — small; structured-field wrapper)
    └── index.ts                             (MODIFIED — withSentry + workflow export)

    packages/db/src/schema.ts                (MODIFIED — 5 new columns on etl_jobs)
    packages/api/drizzle/0048_etl_workflow_columns.sql   (NEW)
    packages/api/wrangler.jsonc              (MODIFIED — workflows binding; retire ETL_QUEUE end of Phase 1)
    packages/cli/src/commands/admin/etl.ts   (MODIFIED — subcommands target workflow endpoints)
    packages/api/test/                       (NEW workflow tests)
    docs/runbooks/etl-pipeline.md            (NEW)

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification.*

```text
Producer  ─── POST /catalog/etl ──┐
                                  │
                                  ▼
        ┌─────────────────────────────────────────────┐
        │ chunkCsvForR2(key)                          │
        │   r2.head → chunks[]                        │
        │   parallel(Promise.all):                    │
        │     for each window: peek tail, align       │
        │       byteEnd to last '\n'                  │
        └─────────────────────────────────────────────┘
                                  │
                          INSERT etl_jobs
                          (status='running',
                           source_etag, source_last_modified)
                                  │
                          env.ETL_WORKFLOW.create({
                            id: `${source}-${filename}`,
                            params: { objectKey, source,
                                      scraperRevision, chunks,
                                      jobId }
                          })
                                  │
                                  ▼
        ┌─────────────────────────────────────────────┐
        │ CatalogEtlWorkflow.run({ event, step }):    │
        │                                             │
        │   for each chunk in params.chunks:          │
        │     await step.do(`chunk-${i}`, {           │
        │       retries: { limit: 3, delay: '30s',    │
        │                  backoff: 'exponential' },  │
        │       timeout: '5 minutes',                 │
        │     }, async () => {                        │
        │       // - r2.get(key, range)               │
        │       // - csv-parse with backpressure      │
        │       // - flush valid → embeddings → upsert│
        │       // - flush invalid → logs             │
        │       // - return { rowsProcessed,          │
        │       //            rowsValid, rowsInvalid }│
        │     })                                      │
        │                                             │
        │   await step.do('aggregate', async () => {  │
        │     // sum chunk results, UPDATE etl_jobs   │
        │     // SET total_processed, total_valid,    │
        │     //     total_invalid                    │
        │   })                                        │
        │                                             │
        │   await step.do('reconcile', async () => {  │
        │     // csv-parse R2 source, count rows,     │
        │     // UPDATE verified_at,                  │
        │     //         verified_row_count           │
        │     // Sentry.captureMessage on delta       │
        │   })                                        │
        │                                             │
        │   await step.do('finalize', async () => {   │
        │     // UPDATE status='completed',           │
        │     //         completed_at=now()           │
        │   })                                        │
        └─────────────────────────────────────────────┘

On step failure exhausting retries:
  → Workflow instance → 'errored' state
  → Workflows dashboard surfaces with full step history
  → Sentry capture from a Sentry.withSentry workflow wrapper
  → A final 'errored' lifecycle hook runs:
    UPDATE etl_jobs SET status='failed', completed_at=now()

Scheduled (CF Cron Trigger or scheduled workflow):
  retention-workflow:
    loop: DELETE FROM invalid_item_logs WHERE id IN (
            SELECT id FROM invalid_item_logs
            WHERE created_at < now() - interval '90 days'
            LIMIT 10000
          )
    until 0 rows affected
    or max iterations (Sentry warning if hit)
```

---

## Implementation Units

### U1. Workflows spike: R2 + Drizzle Neon + csv-parse inside step.do

**Goal:** Prove the integration works at PackRat's actual scale before committing to the migration. 30-60 minutes of focused work; output is a GO/NO-GO with concrete observations.

**Requirements:** Gates R1-R10 (if Workflows can't host the workload, the entire plan blocks).

**Dependencies:** None

**Files:**
- Create: `packages/api/src/workflows/spike-etl-workflow.ts` (throwaway; deleted after the spike or kept as a reference fixture)
- Modify: `packages/api/wrangler.jsonc` (add workflows binding for the spike)
- No tests — this is a manual spike.

**Approach:**
- Build a minimal workflow with three steps:
  1. `step.do('head', () => r2.head('v2/cotopaxi/cotopaxi_2026-05-14T16-54-05.csv'))` — verify R2 binding works inside step.do.
  2. `step.do('chunk', () => r2.get(key, { range: { offset: 0, length: 1024*1024 } }).then(b => b.text()))` — verify byte-range read returns useable string.
  3. `step.do('parse-and-write', async () => { /* csv-parse 100 rows, INSERT into a scratch test table via Drizzle Neon, return { rowsWritten } */ })` — verify csv-parse + Drizzle work inside step.do.
  4. `step.sleep('rest', '5 seconds')` — verify durable sleep works.
  5. `step.do('verify-memoization', async () => { console.log('this should fire exactly once even across retries'); return Date.now(); })` — trigger an artificial retry (throw on first call via a counter file) and verify the second attempt sees the memoized result.
- Run via `wrangler dev --remote` (Workflows requires remote bindings) or `wrangler workflows trigger` against deployed dev environment.
- Observe in Workflows dashboard: step durations, retry behavior, total instance latency, billing meter delta.
- Document: pricing observed for this run, any unexpected friction, blocker confirmation/clearance.

**Patterns to follow:**
- The Workflows quickstart example pattern from <https://developers.cloudflare.com/workflows/get-started/guide/>.
- Existing `R2BucketService` instantiation pattern at `packages/api/src/services/r2-bucket.ts:193-210`.
- Existing `createDbClient(env)` pattern from `packages/api/src/db/index.ts:82-84`.

**Test scenarios:**
- *Test expectation: none — this is a manual spike. The workflow itself is throwaway.*

**Verification:**
- Spike workflow completes successfully end-to-end in the Workflows dashboard.
- Memoization confirmed: the artificially-retried step shows the same return value on the second attempt.
- Pricing observed at the dashboard's billing meter is within an order of magnitude of "negligible" for one run. (Extrapolated to 250 jobs/day, must stay clearly under any concerning threshold.)
- Document one of: GO (proceed to U2), GO-WITH-CAVEATS (proceed but note the friction), NO-GO (fall back to the superseded plan's outbox design).

---

### U2. Drizzle migration 0048: workflow_instance_id, verification columns, supersession, embedding-failure counter, etag capture

**Goal:** Add the minimal schema columns Workflows-based execution needs for DB-side denormalization (admin queries continue to work without hitting the Workflows API for every list).

**Requirements:** R1, R3, R4, R6

**Dependencies:** U1 (spike must pass before committing migration to the new architecture)

**Files:**
- Modify: `packages/db/src/schema.ts` (add columns to `etlJobs`; UNIQUE constraint on `catalogItemEtlJobs`)
- Create: `packages/api/drizzle/0048_etl_workflow_columns.sql`
- Create: `packages/api/drizzle/meta/0048_snapshot.json` (generated)
- Modify: `packages/api/drizzle/meta/_journal.json` (generated)
- Test: `packages/api/test/db-schema-etl.test.ts` (new — assert columns exist with expected defaults)

**Approach:**
- Columns added to `etl_jobs`:
  - `workflow_instance_id text` (nullable — legacy queue-based rows leave NULL until repair)
  - `verified_at timestamp` (nullable)
  - `verified_row_count integer` (nullable)
  - `total_embedding_failures integer DEFAULT 0 NOT NULL`
  - `superseded_by_job_id text` (nullable, FK to `etl_jobs.id` `ON DELETE SET NULL`)
  - `superseded_at timestamp` (nullable)
  - `source_etag text` (nullable)
  - `source_last_modified timestamp` (nullable)
- CHECK constraints on `etl_jobs`:
  - `etl_jobs_no_self_supersede CHECK (superseded_by_job_id IS NULL OR superseded_by_job_id <> id)`
- Indexes:
  - `etl_jobs_workflow_instance_id_idx` on `(workflow_instance_id)` — for the admin "find by workflow" lookup
  - `etl_jobs_superseded_by_idx` on `(superseded_by_job_id)`
- Modification to `catalog_item_etl_jobs`: add `UNIQUE (catalog_item_id, etl_job_id)` so retried upserts use `ON CONFLICT DO NOTHING`.
- **Source-ETag backfill (one-shot, in the migration itself)**: a `DO $$ BEGIN UPDATE etl_jobs SET source_etag = NULL, source_last_modified = NULL WHERE status IN ('completed', 'failed'); END $$;` is a no-op for the 7 historical jobs in the sense that the ETag is genuinely unknown — but a companion *operational* step (in U10 runbook) calls `r2.head()` for each of the 7 jobids and `UPDATE etl_jobs SET source_etag = $1, source_last_modified = $2 WHERE id = $3` ONLY IF the file still exists. This is the documented forensic recovery procedure; it does not run inside the SQL migration.
- Drizzle generator: `bun run --cwd packages/api db:generate`. Hand-verify the generated SQL emits literal `DEFAULT 0 NOT NULL` for `total_embedding_failures` (Drizzle Kit sometimes drops SQL-side defaults).

**Patterns to follow:**
- Existing `etl_jobs` definition at `packages/db/src/schema.ts:460-479`.
- Migration `0027_past_madrox.sql` (added `scraper_revision` + index) for the "add column + index" pattern.

**Test scenarios:**
- Happy path: After migration, all 8 new columns present with documented defaults; both indexes queryable; UNIQUE constraint on `catalog_item_etl_jobs` prevents duplicate inserts.
- Edge case: Existing rows have `workflow_instance_id = NULL`, `total_embedding_failures = 0`, `source_etag = NULL`.
- Error path: `INSERT etl_jobs SET superseded_by_job_id = id` violates the no-self-supersede CHECK.
- Error path: Re-running the migration is a no-op (Drizzle's migration log handles this).

**Verification:**
- `bun run --cwd packages/api db:migrate` applies cleanly against a fresh Docker Postgres + against a Postgres seeded with current-prod-shape `etl_jobs` rows.
- `bun lint:custom` passes.
- `bun test:api:unit` includes the new schema test and it passes.

---

### U3. Define CatalogEtlWorkflow + producer cutover

**Goal:** Replace `processCatalogEtl.ts` + `queue.ts` + `processQueueBatch` with a single `CatalogEtlWorkflow` class. Producer endpoint switches from `sendBatch` to `env.ETL_WORKFLOW.create()`. Old queue path coexists during transition (via `?engine=workflow|queue`).

**Requirements:** R1, R3, R5

**Dependencies:** U2 (schema columns must exist for workflow to write them)

**Execution note:** Test-first for the workflow class itself. Write the integration test (small CSV, 3 chunks, full ingest path) before implementing the workflow body — the test acts as the executable specification of the desired behavior.

**Files:**
- Create: `packages/api/src/workflows/catalog-etl-workflow.ts` (the main workflow class)
- Create: `packages/api/src/workflows/shared/chunkCsvForR2.ts` (row-boundary-aligned chunking; parallel peek reads via `Promise.all`; pulled forward from old plan's U6/U7)
- Modify: `packages/api/src/index.ts` (export `CatalogEtlWorkflow`; extend the Worker module type)
- Modify: `packages/api/wrangler.jsonc` (add `workflows` binding `ETL_WORKFLOW`; keep `packrat-etl-queue` for the coexistence window)
- Modify: `packages/api/src/routes/catalog/index.ts` (producer accepts `?engine=workflow|queue`; default `workflow`; both paths INSERT into `etl_jobs` with `source_etag` capture)
- Modify: `packages/api/src/services/etl/types.ts` (`CatalogEtlWorkflowParams` type)
- Delete (Phase 1 cleanup PR, *after* coexistence window): `packages/api/src/services/etl/processCatalogEtl.ts`, `packages/api/src/services/etl/queue.ts`
- Test: `packages/api/test/etl-workflow-integration.test.ts` (new — end-to-end test using a mocked `step` runtime)

**Approach:**
- `CatalogEtlWorkflow extends WorkflowEntrypoint<Env, CatalogEtlWorkflowParams>`:
  ```text
  async run(event, step) {
    const { jobId, objectKey, chunks } = event.payload;

    const chunkResults = [];
    for (const [i, chunk] of chunks.entries()) {
      const result = await step.do(
        `chunk-${i}`,
        {
          retries: { limit: 3, delay: '30s', backoff: 'exponential' },
          timeout: '5 minutes',
        },
        async () => this.processChunk(jobId, objectKey, chunk, i),
      );
      chunkResults.push(result);
    }

    await step.do('aggregate', async () => this.aggregateCounters(jobId, chunkResults));
    await step.do('reconcile', async () => this.reconcile(jobId, objectKey));
    await step.do('finalize', async () => this.finalizeJob(jobId));
  }
  ```
- `processChunk` body absorbs the existing `processCatalogETL` logic: R2 byte-range read, csv-parse with backpressure, batch flush, embedding fallback path (increments `total_embedding_failures`), invalid-log handoff. Returns `{ rowsProcessed, rowsValid, rowsInvalid }` — small enough to fit in the 1 MiB step output cap.
- Header injection for non-first chunks uses the bounded-expand re-fetch loop (4K → 16K → 64K → throw `EtlHeaderError`).
- `chunkCsvForR2`: producer-side row-boundary alignment with parallel 64KB peek reads (closes audit P1 #3/#4/#5 + the previously-flagged producer CPU budget concern). Returns `Array<{ chunkIndex, chunksTotal, byteStart, byteEnd }>` plus the captured `etag` + `lastModified`.
- Producer endpoint writes `etl_jobs` row with `source_etag`, `source_last_modified`, `workflow_instance_id`; then `env.ETL_WORKFLOW.create({ id: \`${source}-${filename}\`, params: { jobId, objectKey, source, scraperRevision, chunks } })`. The deterministic instance ID prevents duplicate triggers for the same file (Workflows rejects duplicate IDs).
- Producer's `?engine=queue` branch keeps the old `queueCatalogETL` flow for rollback. Removed in the Phase 1 cleanup PR after one week of bake.
- Test uses Workflows' test harness (`@cloudflare/vitest-pool-workers`) or mocks the `step` object directly with an in-memory implementation that exercises memoization.

**Patterns to follow:**
- Workflows quickstart: <https://developers.cloudflare.com/workflows/get-started/guide/>.
- Existing `R2BucketService` and `createDbClient` instantiation patterns.
- Existing CSV parse + backpressure handling in `processCatalogEtl.ts:80-130` (lifted into `processChunk`).

**Test scenarios:**
- Happy path: 3-chunk CSV (small fixture), workflow runs end-to-end, final `etl_jobs.status = 'completed'`, `total_processed = 100` (or fixture row count), `verified_at` set, `total_embedding_failures = 0`.
- Edge case: One chunk throws a transient error; Workflows retries once and succeeds; final state correct; `aggregate` step's input includes the retried chunk's eventual success result (memoization).
- Edge case: Embedding service throws on chunk 1's flush; `total_embedding_failures` increments by the flush size; chunk still completes (embedding fallback); workflow continues; `verified_at` set.
- Edge case: Chunk boundary lands on a row boundary; total row count matches `wc -l` minus header.
- Edge case: Header row >4 KB (synthetic fixture with 60 columns of long names); re-fetch expands to 16 KB; columns mapped correctly.
- Error path: All retries on chunk 0 exhaust; workflow instance enters `errored`; lifecycle hook flips `etl_jobs.status = 'failed'`; Sentry captures with full step history.
- Error path: Duplicate trigger for the same `(source, filename)` returns the existing instance ID; no duplicate row inserted.
- Integration: Producer endpoint with `?engine=workflow` triggers a workflow; with `?engine=queue` triggers the legacy path. Both produce a working ingest. Compared row counts match.

**Verification:**
- Integration test passes against the test Postgres.
- `bun api` dev server: hitting `POST /catalog/etl?engine=workflow` with a real R2 fixture triggers a visible workflow instance in `wrangler workflows list catalog-etl-workflow`.
- Workflow instance completes; `etl_jobs` row reflects expected counters; Sentry event present on simulated chunk failure.

---

### U4. Validator hardening: scheme, IDN, SSRF, length caps, SKU charset

**Goal:** Eliminate audit P3 #2 attack surface — `javascript:`, IDN homograph, RFC-1918, oversize fields cannot enter the catalog.

**Requirements:** R7

**Dependencies:** None (independent; can land any time)

**Files:**
- Modify: `packages/api/src/services/etl/CatalogItemValidator.ts`
- Test: `packages/api/test/etl-validator.test.ts` (new or extend existing)

**Approach:**
- `isValidUrl`:
  - Parse with `new URL()`.
  - Reject scheme other than `http:` / `https:` → reason `INVALID_URL_SCHEME`.
  - Reject length > 2048 → `URL_TOO_LONG`.
  - Reject IDN homograph: if `url.hostname` contains any non-ASCII character, run through `punycode.toUnicode` and compare to original; reject mixed-script labels via the Unicode IDNA `getStringPrepProfile` heuristic (or a small allow-list of Latin-only scripts). Reason `INVALID_URL_HOMOGRAPH`.
  - Reject private/loopback/link-local hostnames via string-level pattern check (no DNS resolution — that adds an unbounded fetch surface and is itself an SSRF risk): block hostname literals matching `/^(?:127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|fc00:|fd00:|fe80:|localhost$|::1$)/i`. Reason `INVALID_URL_PRIVATE`.
- Length caps: `name ≤ 500`, `description ≤ 50000`, `brand ≤ 200`, `category ≤ 200`.
- SKU regex: `/^[A-Za-z0-9_.\-\/]+$/` max 200.

**Patterns to follow:**
- Existing validator at `packages/api/src/services/etl/CatalogItemValidator.ts`.
- Invalid-log shape at `packages/api/src/services/etl/processLogsBatch.ts`.

**Test scenarios:**
- Happy path: `https://example.com/product/123` accepted.
- Error path: `javascript:alert(1)` rejected (`INVALID_URL_SCHEME`).
- Error path: `https://192.168.1.1/admin` rejected (`INVALID_URL_PRIVATE`).
- Error path: `https://xn--pypal-4ve.com/` rejected (`INVALID_URL_HOMOGRAPH`).
- Error path: `https://localhost/` rejected (`INVALID_URL_PRIVATE`).
- Edge case: URL of exactly 2048 chars accepted; 2049 rejected.
- Edge case: SKU `ABC-123_/test.sku` accepted; SKU `<script>` rejected.
- Integration: A real prod-shape CSV with an injected `javascript:` URL run through the workflow → row in `invalid_item_logs`, no `catalog_items` insert.

**Verification:**
- New tests pass.
- `bun test:api` overall green.

---

### U5. Retry, repair-from-scratch, reconcile admin endpoints (workflow-aware)

**Goal:** Operators can trigger a new workflow instance from a historical `jobId` (retry), force a re-ingest with verification (repair-from-scratch), or trigger reconciliation against any job.

**Requirements:** R3, R4

**Dependencies:** U3 (workflow class must exist)

**Files:**
- Modify: `packages/api/src/routes/admin/analytics/catalog.ts` (rewrite `POST /admin/etl/:jobId/retry`; add `POST /admin/etl/:jobId/repair-from-scratch`; add `POST /admin/etl/:jobId/reconcile`)
- Modify: `packages/cli/src/commands/admin/etl.ts` (add/refresh subcommands)
- Modify: admin list endpoint response shape (include `workflowInstanceId`, `verifiedAt`, `verifiedRowCount`, `totalEmbeddingFailures`)
- Test: `packages/api/test/etl-admin-retry-repair-reconcile.test.ts` (new)

**Approach:**
- `POST /admin/etl/:jobId/retry`: look up original `(source, filename, scraperRevision)`; verify `r2.head` of the original `filename` matches stored `source_etag` (409 on mismatch unless `?force=true`); INSERT a new `etl_jobs` row with `superseded_by_job_id = :jobId`, `superseded_at = now()`; trigger workflow with a fresh instance ID `${source}-${filename}-retry-${nonce}`.
- `POST /admin/etl/:jobId/repair-from-scratch`: same shape as retry but always sets supersession even for `completed` jobs. Use case: an operator suspects a `completed` job is undercount.
- `POST /admin/etl/:jobId/reconcile`: synchronously reads the source via `r2.get(key)`, csv-parses + counts logical rows, updates `verified_at` + `verified_row_count` on the target job. For very large files the operator can pass `?async=true` to trigger a workflow whose only step is reconcile.
- Both endpoints accept `?dryRun=true` returning the planned action without side effects.
- 7-job historical recovery procedure documented in U8 runbook: for each of the 7 jobIds, operator (a) verifies R2 source still exists, (b) backfills `source_etag` via a one-time SQL UPDATE using the current `r2.head().etag`, (c) calls `POST /admin/etl/:jobId/repair-from-scratch` (no `force` needed once etag is backfilled).

**Patterns to follow:**
- Admin route structure at `packages/api/src/routes/admin/analytics/catalog.ts:178-235`.
- Workflow trigger pattern from U3.

**Test scenarios:**
- Happy path: Retry of a `failed` job whose source still exists → 409? No, 200 (ETag matches), new workflow instance triggered, new `etl_jobs` row with `superseded_by_job_id` set.
- Happy path: Repair-from-scratch on a `completed` job → new workflow instance, supersession recorded.
- Edge case: Retry when source has been overwritten (ETag mismatch) → 409; operator must use `?force=true`.
- Edge case: `?dryRun=true` returns planned action; no side effects.
- Edge case: Reconcile on a tiny job returns inline; on a synthetic 1 GB fixture with `?async=true` triggers a reconcile-only workflow.
- Integration: Repair-from-scratch on a 50,100-row file produces a new job whose `total_processed = 50100`, `verified_row_count = 50100`.
- Covers AE: The 7 historical jobs from 2026-05-14 are recoverable via this endpoint after the manual ETag backfill step.

**Verification:**
- Endpoints documented in OpenAPI spec via `@elysiajs/openapi`.
- CLI subcommands invoke endpoints with proper auth.
- `bun test:api` passes.

---

### U6. Observability: Sentry wiring, structured logger, error propagation fixes

**Goal:** Every workflow error reaches Sentry with structured context. Embedding fallback observable via counter + Sentry breadcrumb. Internal error-propagation fixes from audit P2 #2/#3/#4.

**Requirements:** R5, R6

**Dependencies:** U3 (workflow class to instrument)

**Files:**
- Modify: `packages/api/package.json` (add `@sentry/cloudflare`, pin version)
- Modify: `packages/api/src/index.ts` (wrap with `Sentry.withSentry({ ...opts, fetch, workflow, queue })`)
- Modify: `packages/api/wrangler.jsonc` (`upload_source_maps: true`)
- Modify: `.github/workflows/api-deploy.yml` (or equivalent) (add `@sentry/cli sourcemaps upload` step after deploy)
- Create: `packages/api/src/utils/logger.ts` (thin wrapper: `info/warn/error(event, ctx)`; emits JSON line + Sentry breadcrumb when initialized)
- Modify: `packages/api/src/workflows/catalog-etl-workflow.ts` (instrument each step with `Sentry.startSpan`; capture exceptions in step bodies)
- Modify: `packages/api/src/services/etl/processLogsBatch.ts` (rethrow on DB failure — audit P2 #2)
- Modify: `packages/api/src/services/etl/processValidItemsBatch.ts` (embedding-fallback path atomically increments `etl_jobs.total_embedding_failures`, emits Sentry warning — audit P2 #3)
- Modify: `packages/api/src/services/etl/mergeItemsBySku.ts` (per-batch summary log instead of per-SKU — audit P3 #1)
- Modify: All ETL files' `console.*` → `logger.*` (mechanical)
- Modify: `packages/api/src/services/etl/processCatalogEtl.ts` *if it still exists* (writer IIFE wrap — audit P2 #4); deletion in Phase 1 cleanup makes this moot
- Create: `packages/api/src/services/etl/constants.ts` (`ITEM_FLUSH_BATCH_SIZE = 100`, `CF_QUEUE_BATCH_SIZE = 100` — audit P2 #6)
- Test: `packages/api/test/sentry-instrumentation.test.ts` (mock `@sentry/cloudflare`; assert capture shape)
- Test: `packages/api/test/etl-error-propagation.test.ts` (rethrows, fallback counter increments)

**Approach:**
- Wrap the default export at `packages/api/src/index.ts` with `Sentry.withSentry(getOptions, { fetch, workflow, queue })`. Options factory reads `env.SENTRY_DSN`, `env.ENVIRONMENT`, sets `tracesSampleRate: 0.1`.
- Workflow instrumentation: each `step.do(name, fn)` callback wraps the body in `Sentry.startSpan({ op: 'workflow.step', name, attributes: { jobId, workflowInstanceId, chunkIndex } }, ...)`. Capture errors before rethrowing.
- Source-map upload: `@sentry/cli sourcemaps upload --release=$SENTRY_RELEASE ./dist` in CI after `wrangler deploy` — symbolicated stack traces in Sentry. Just `upload_source_maps: true` in wrangler.jsonc only ships maps to Cloudflare, not Sentry.
- `error_stack` contract: the Sentry capture call sites use `Sentry.captureException(err, { tags: { jobId, workflowInstanceId, chunkIndex }, contexts: { ... } })` and pass error-message-only payloads — never include raw CSV row data. U10 test asserts no row-data substrings leak into the captured payload across all error paths.
- Compatibility flags: verify `@sentry/cloudflare`'s required flags for the chosen version against the current `wrangler.jsonc` flags. `nodejs_compat` is already set; if the chosen version requires `nodejs_compat_v2` or `nodejs_als`, add them.

**Patterns to follow:**
- Reference: <https://docs.sentry.io/platforms/javascript/guides/cloudflare/>.
- Workflows-specific tracing: workflow-aware spans via `withSentry`'s `workflow` wrapper.

**Test scenarios:**
- Happy path: Successful workflow → one `startSpan` per step, no `captureException`.
- Error path: A `step.do` throws → `captureException` called with `{ jobId, workflowInstanceId, chunkIndex }` tags; span marks status error; workflow retries per step retry policy.
- Edge case: `SENTRY_DSN` empty (dev without secret) → no Sentry calls; logger still emits lines; no crash.
- Edge case: `processLogsBatch` DB INSERT fails → exception propagates → step retried by Workflows.
- Edge case: Embedding service throws → `total_embedding_failures` increments atomically by the batch size; `etl.embedding.fallback` Sentry warning fires once per batch.
- Integration: A forced chunk failure in dev produces a Sentry event visible in the project with the expected tags.

**Verification:**
- `grep -rn 'console\.' packages/api/src/services/etl/ packages/api/src/workflows/` returns nothing.
- A real `bun api` cold-start log contains the Sentry init line.
- Sentry test project receives an event from a forced workflow failure.
- CI sourcemaps upload step succeeds; minified frames in Sentry show original filenames.

---

### U7. Retention sweep: scheduled handler with batched DELETE

**Goal:** Bounded growth of `invalid_item_logs`. Naive single-statement DELETE is replaced with a batched loop to survive multi-million-row pruning.

**Requirements:** R8

**Dependencies:** None

**Files:**
- Create: `packages/api/src/workflows/retention-workflow.ts` *(or)* `packages/api/src/services/retention/invalidLogRetention.ts` + a `scheduled()` handler arm — pick one based on Phase 3 ergonomics
- Modify: `packages/api/src/index.ts` (`scheduled` handler dispatches on `event.cron`, or workflow trigger registered)
- Modify: `packages/api/wrangler.jsonc` (add `"triggers": { "crons": ["0 9 * * *"] }` — top-level `triggers` wrapper, not bare `crons`)
- Test: `packages/api/test/etl-log-retention.test.ts` (new)

**Approach:**
- Sweep: loop
  ```text
  DELETE FROM invalid_item_logs
  WHERE id IN (
    SELECT id FROM invalid_item_logs
    WHERE created_at < now() - interval '90 days'
    LIMIT 10000
  );
  ```
  until `0 rows affected` OR `iterations >= 100`. Pause briefly between iterations (`await scheduler.wait(100)`). If max iterations hit, Sentry warning with the deleted-row count so operators know more remains.
- 90-day window default; configurable via `env.INVALID_LOG_RETENTION_DAYS`.
- Daily cron at 09:00 UTC.

**Patterns to follow:**
- CF Cron Triggers config: <https://developers.cloudflare.com/workers/configuration/cron-triggers/>.

**Test scenarios:**
- Happy path: Seed table with 30k rows older than 90 days and 100 rows younger → sweep deletes exactly 30k in 3 iterations, leaves 100 rows.
- Edge case: Empty table → sweep deletes 0 rows; no error; no Sentry warning.
- Edge case: 1.5M rows older than 90 days → sweep hits max iterations cap at 1M deleted, emits Sentry warning, leaves remaining for next run.
- Edge case: `INVALID_LOG_RETENTION_DAYS=30` env override → 30d-old logs swept.

**Verification:**
- New test passes.
- `wrangler dev --test-scheduled` exercises the handler; assertion via DB row count delta.

---

### U8. Runbook at `docs/runbooks/etl-pipeline.md`

**Goal:** A new on-caller can trigger / inspect / retry / repair / reconcile / drain operations against Workflows without reading source.

**Requirements:** R9

**Dependencies:** U3, U5 (operator-facing endpoints must exist)

**Files:**
- Create: `docs/runbooks/etl-pipeline.md`

**Approach:**
Sections:
1. **Architecture overview** — producer → workflow instance → step.do chunks → aggregate → reconcile → finalize, with a small Mermaid diagram.
2. **Triggering an ETL** — `curl POST /catalog/etl` (params, auth); CLI equivalent.
3. **Inspecting workflow status** — `wrangler workflows instances list catalog-etl-workflow`; `wrangler workflows instances describe <id>`; admin dashboard query.
4. **Retrying a failed workflow** — `curl POST /admin/etl/:jobId/retry`; CLI `packrat-admin etl retry <jobId>`.
5. **Repair-from-scratch** — including the explicit one-time procedure for the seven 2026-05-14 jobs (list jobIds; describe ETag backfill step; describe expected output).
6. **Reconciliation** — manual sync endpoint vs async-workflow trigger; interpreting delta.
7. **Draining the queue (legacy path)** — only relevant during the coexistence window; how to verify drain before removing the queue config.
8. **DLQ alternative** — since Workflows is the forensic record, the runbook explains: "Failed workflow instances are queryable for 90 days via dashboard; `wrangler workflows instances describe <id>` shows full step history with errors."
9. **Accepted limitations** — soft-delete/discontinued-item reconciliation is not in scope; catalog grows monotonically.
10. **References** — link to the audit, this plan, Workflows docs, Sentry project.

**Patterns to follow:**
- First runbook in `docs/runbooks/`; establishes the convention.

**Test scenarios:**
- *Test expectation: none — documentation only.*

**Verification:**
- Reviewer walks through each documented procedure in dev and confirms expected output.

---

### U9. Test gap backfill

**Goal:** Cover the behaviors the legacy global queue-mock hid; add fixtures for byte-range edge cases.

**Requirements:** R10

**Dependencies:** U3, U4, U6 (units under test must exist)

**Files:**
- Modify: `packages/api/test/setup.ts` (remove the global queue mock — `processQueueBatch` no longer exists)
- Create: `packages/api/test/etl-workflow-multi-chunk.test.ts`
- Create: `packages/api/test/etl-csv-edge-cases.test.ts`
- Create: `packages/api/test/fixtures/etl/` (synthesized at test startup with deterministic seed):
  - `small-1chunk.csv` (~10 KB)
  - `medium-3chunk.csv` (~50 MB synthetic, splits into 3 chunks)
  - `wide-header.csv` (6 KB header)
  - `bom-prefixed.csv` (starts with BOM)
  - `quoted-header.csv` (CSV-quoted commas in header)
  - `quoted-multiline.csv` (newlines inside quoted fields — gated by U3 csv-parse reconciliation, not raw byte counting)

**Approach:**
- Each new test exercises the real workflow integration against the test Postgres + mocked `step` runtime.
- Specific assertions:
  - Multi-chunk workflow completes with one `status='completed'` transition.
  - Header > 4 KB: re-fetch expands to 16 KB, columns mapped correctly.
  - Row-spanning chunk: no rows dropped or duplicated; total row count matches `wc -l - 1`.
  - BOM-prefixed file: stripped before header extraction.
  - Quoted-multiline file: csv-parse counts logical rows correctly; reconcile delta = 0.
  - Embedding fallback: `total_embedding_failures` increments; chunk completes; Sentry warning fires once per batch.
  - Step memoization: forced retry of one chunk produces the same return value on the second attempt (mocked step runtime asserts this).

**Patterns to follow:**
- Existing `packages/api/test/etl.test.ts` for fixture setup + Docker Postgres pattern.
- Vitest mocking conventions from `packages/api/test/setup.ts`.

**Test scenarios:**
- (Each described above.)

**Verification:**
- `bun test:api` passes.
- Coverage delta is positive on `packages/api/src/workflows/` and the modified ETL service files.

---

## System-Wide Impact

- **Interaction graph:** Producer endpoint → `chunkCsvForR2` (parallel peek reads) → INSERT etl_jobs with source_etag → `env.ETL_WORKFLOW.create(...)` → workflow instance runs `chunk-*` steps in order → `aggregate` → `reconcile` → `finalize`. Failed instances surface in Workflows dashboard. Sentry wraps every entry point (`fetch`, `workflow`, `queue` — the last for the unchanged embeddings queue). One scheduled cron arm for retention sweep.
- **Error propagation:** Errors thrown inside `step.do` callbacks are captured by `Sentry.captureException`, rethrown to Workflows runtime, retried per step config; exhaustion routes the instance to `errored`; the workflow's terminal `errored` lifecycle hook flips `etl_jobs.status='failed'` and captures a final Sentry event with step history. Inner code (`processLogsBatch`, `processValidItemsBatch` embedding fallback) rethrows on DB failure so the step retries with the right backoff.
- **State lifecycle:** Workflows step results are durably persisted and memoized by step name; retries are exactly-once-on-success. No `chunks_total/chunks_completed/last_progress_at` columns are needed because instance state is the source of truth. `etl_jobs` carries only the denormalized counters needed by admin queries.
- **API surface parity:** Producer `POST /catalog/etl` keeps the same request body shape; accepts an additional optional `?engine=workflow|queue` parameter (default `workflow`) during the coexistence window. Admin endpoints: rewritten retry, new repair-from-scratch, new reconcile. Old endpoints (`/admin/etl/reset-stuck`) are removed in U3's PR (no replacement needed — Workflows surfaces stuck instances natively).
- **Integration coverage:** U9 exercises the full pipeline end-to-end. The legacy global queue mock at `packages/api/test/setup.ts:544-551` is removed since the queue no longer participates in catalog ETL.
- **Unchanged invariants:** `EMBEDDINGS_QUEUE` and `LOGS_QUEUE` configuration; `catalog_items` upsert behavior (still SKU-keyed); OpenAPI client generated by `@elysiajs/openapi` for non-ETL routes; admin auth surface (`adminAuthGuard`); scraper-revision pinning; mobile and web apps untouched.

---

## Risks & Dependencies

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Workflows pricing surprises at PackRat's scale** | Med (unknown until measured) | Med | U1 spike captures dashboard billing meter for one run; extrapolate to ~750 step-executions/day. Escalate before Phase 2 if cost trajectory exceeds Workers Paid base. |
| **`step.do` output exceeds 1 MiB cap** for very wide chunks | Low | Med | Chunk-step returns aggregated counters only (`{ rowsProcessed, rowsValid, rowsInvalid }`), not row data. Detail rows go to `catalog_items` / `invalid_item_logs` via DB writes inside the step. |
| **Producer's parallel newline-peek reads collide with R2 rate limits** for multi-GB files | Low | Med | `Promise.all` over ≤50 chunks × one 64KB read each = ≤50 concurrent R2 GETs; well within R2's documented per-bucket throughput. If issue surfaces, bound concurrency with a small p-limit. |
| **`@sentry/cloudflare` requires compatibility_flags beyond `nodejs_compat`** | Low | Med | Verify against the pinned Sentry version at U6 start; add any missing flags as part of U6. |
| **Coexistence window misuse** (operators flip `?engine=queue` after cutover) | Low | Low | Producer logs a Sentry breadcrumb on `?engine=queue` usage; runbook documents the deprecation. Cleanup PR removes the option entirely a week after cutover. |
| **The 7 historical jobs' R2 sources have been deleted** by a separate retention policy | Low | Low | U8 runbook procedure verifies `r2.head` before invoking repair; if missing, accept as documented data loss. |
| **Workflow instance ID collision** if the same `(source, filename)` is triggered twice (deterministic ID) | Low | Low | Workflows returns the existing instance on duplicate; producer endpoint treats this as success and returns the existing `jobId`. Documented behavior. |
| **`csv-parse` reconciliation is slower than naive byte counting** for very large files | Low | Low | At ~10MB/s parse rate, a 100MB file takes ~10s — well within step CPU. If a 1 GB+ file appears, the reconcile step is split by byte range (each sub-step parses 200 MB). |
| **Drizzle Kit emits SQL without literal `DEFAULT 0 NOT NULL`** | Med | High | U2 implementer hand-verifies generated `.sql`; schema smoke test asserts via `information_schema.columns`. |
| **Down-migration loses Phase-2+ data** once writes start landing | Cert if attempted | High | Migration is **forward-only after U3 ships**; documented in U2's test scenarios and migration header. Rollback strategy is a forward-fix migration. |
| **Wide-CSV fixture in U9 destabilizes CI** | Low | Low | Synthesize at test startup with deterministic seed (no checked-in large file); cap size in test mode via env. |

---

## Documentation / Operational Notes

- The new runbook at `docs/runbooks/etl-pipeline.md` (U8) is the operator entry point.
- Sentry project must be provisioned (or confirmed existing) before U6 lands. `env.SENTRY_DSN` is already validated in `packages/api/src/utils/env-validation.ts:9, 94` — verify the prod and dev env have it set via `wrangler secret list`.
- Rollout sequencing:
  - **Phase 1** ships U1 + U2 + U3. Producer accepts `?engine=workflow|queue`; default `workflow`. Coexistence window of one week. Daily `wrangler workflows instances list` check during the window.
  - **Phase 1 cleanup PR** (one week after Phase 1): delete `processCatalogEtl.ts`, `queue.ts`, the `?engine=queue` branch, the `packrat-etl-queue` config. `setup.ts:544-551` global queue mock removed.
  - **Phase 2** ships U4 + U5 + U6 + U7. Validator hardening, admin endpoints, observability, retention.
  - **Phase 3** ships U8 + U9. Runbook + test backfill.
- The 7 historical-job recovery is a one-time operational task after Phase 2; record the run in the runbook's `## Historical Recoveries` appendix.
- New env vars: `INVALID_LOG_RETENTION_DAYS` (optional, default 90). Add to `.env.example` in Phase 3.

---

## Phased Delivery

### Phase 1 — Workflows foundation + producer cutover (U1, U2, U3)

Spike → migration → workflow class → producer accepts both engines. Independently shippable in 2-3 PRs (spike result attached to U2's PR; U2 + U3 in one PR or split). After Phase 1 bakes for one week, Phase 1 cleanup PR removes the legacy queue path entirely.

### Phase 2 — Validator + admin endpoints + observability + retention (U4, U5, U6, U7)

Hardening + the operator surface that lets the 7-job recovery happen. 2-3 PRs.

### Phase 3 — Runbook + test backfill (U8, U9)

Documentation + test coverage. 1-2 PRs.

---

## Documentation Plan

- `docs/runbooks/etl-pipeline.md` — created in U8.
- `CLAUDE.md` ETL section — minor update in a Phase 3 PR to link the runbook and note the Workflows architecture.
- Update `docs/audits/2026-05-16-etl-audit.md` footer linking to this plan (so future readers know remediation went through Workflows).
- `/ce-compound` candidates after each phase:
  - Phase 1: "Cloudflare Workflows step.do idempotency for batch ETL"
  - Phase 1: "Migrating a Cloudflare Queues state machine to Workflows"
  - Phase 2: "Sentry on Cloudflare Workers via `@sentry/cloudflare` (fetch + workflow + queue)"
  - Phase 3: "ETL operational runbook structure (Workflows edition)"

---

## Operational / Rollout Notes

- Each phase's PR is gated on the previous phase having shipped to prod and observed for at least 24h. Particular care during Phase 1's coexistence window — monitor `wrangler workflows instances list` daily and confirm the workflow path is the one being exercised.
- The 7-job recovery happens after Phase 2 lands; document the jobIds and the run in the runbook recoveries appendix.
- New env vars: `INVALID_LOG_RETENTION_DAYS` (optional, default 90). Add to `.env.example` in Phase 3.
- Wrangler secrets to verify: `SENTRY_DSN`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `PACKRAT_SCRAPY_BUCKET_R2_BUCKET_NAME`. None new; confirm presence before Phase 2 deploy via `wrangler secret list`.
- Rollback: each PR is independently revertable until U3's cleanup. Once the legacy queue path is removed, rollback requires a forward-fix.

---

## Sources & References

- **Origin audit:** `docs/audits/2026-05-16-etl-audit.md`
- **Superseded plan:** `docs/plans/2026-05-19-001-fix-etl-pipeline-audit-remediation-plan.md` (Queues + outbox design; pivoted to Workflows on 2026-05-20)
- Related code:
  - `packages/api/src/services/etl/`
  - `packages/api/src/routes/catalog/index.ts`
  - `packages/api/src/routes/admin/analytics/catalog.ts`
  - `packages/api/wrangler.jsonc`
  - `packages/db/src/schema.ts`
  - `packages/api/test/etl.test.ts`
  - `packages/cli/src/commands/admin/etl.ts`
- Live prod evidence (pulled 2026-05-19 + 2026-05-20): `GET https://packrat-api.orange-frost-d665.workers.dev/api/admin/analytics/catalog/etl?limit=25` showed 192 runs / 74 failed, 7 jobs falsely-failed at 2026-05-14T16:24:04.470Z. Counters unchanged across the two pulls — pipeline is currently dormant.
- External docs:
  - <https://developers.cloudflare.com/workflows/>
  - <https://developers.cloudflare.com/workflows/get-started/guide/>
  - <https://developers.cloudflare.com/workflows/reference/limits/>
  - <https://developers.cloudflare.com/queues/configuration/javascript-apis/> (for the embeddings queue, retained)
  - <https://developers.cloudflare.com/r2/api/s3/api/>
  - <https://docs.sentry.io/platforms/javascript/guides/cloudflare/>
  - <https://developers.cloudflare.com/workers/configuration/cron-triggers/>
