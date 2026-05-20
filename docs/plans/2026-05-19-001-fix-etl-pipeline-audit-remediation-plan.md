---
title: "fix: ETL pipeline audit remediation"
type: fix
status: superseded
supersededBy: docs/plans/2026-05-20-001-fix-etl-pipeline-workflows-migration-plan.md
supersededReason: "Pivoted execution engine from Cloudflare Queues + outbox to Cloudflare Workflows on 2026-05-20. Workflows natively provides the durable-step + idempotency + retry + state semantics that ~8 of the 15 units in this plan were manually reconstructing. The audit findings about CSV correctness, validator hardening, observability, retention, and runbook remain real and carry into the successor plan; the queue-as-state-machine subplot is dropped."
date: 2026-05-19
deepened: 2026-05-19
origin: docs/audits/2026-05-16-etl-audit.md
---

# fix: ETL pipeline audit remediation

## Summary

Remediate the catalog ETL pipeline against every finding in the 2026-05-16 audit (2 P0, 5 P1, 6 P2, 3 P3), correct two stale assumptions the audit made about Cloudflare runtime APIs, add bucket-vs-job reconciliation (both an admin-triggered tool and automatic post-job verification), and add a "re-ingest from the top" recovery path for jobs the buggy stuck-job sweep has already corrupted. Delivered as one master plan in four sequenced phases — schema + P0 blockers first, then chunking correctness, then observability + reconciliation, then hardening + runbook.

---

## Problem Frame

The pipeline ingests scraper CSVs from R2 (`packrat-scrapy-bucket`) into Neon Postgres via a Cloudflare Queue consumer. It is currently silently incorrect: live prod admin data (192 runs / 74 failed = 38% failure rate) shows seven large jobs from 2026-05-14 marked `failed` with identical `completedAt` timestamps — the wall-clock-based stuck-job sweep firing on healthy long jobs — while the dashboard reports `successRate: 100%` on those same failed jobs. Audit `docs/audits/2026-05-16-etl-audit.md` enumerates the structural causes: a single shared `jobId` across byte-range chunks lets the first finishing chunk flip the parent job to `completed`, per-message exceptions are swallowed (no DLQ, no retry), byte-range chunk boundaries silently drop or invalidate rows that span them, retries discard chunking entirely, and there is no Sentry / structured logging anywhere in the ETL path.

The user's stated concern — *"some [data] is missing or falsely labeling as success"* — is corroborated on both ends: `completed` jobs can be premature (P0 #1), and `failed` jobs can be false failures (P1 #2). Either way the catalog count `totalItemsIngested: 304,431` cannot currently be trusted.

---

## Requirements

- R1. **No chunk causes premature job completion.** A multi-chunk job transitions to `completed` only when every chunk has succeeded.
- R2. **Per-message queue failures retry and ultimately DLQ.** No exception thrown by chunk processing is silently swallowed.
- R3. **Stuck-job sweep is progress-based, not wall-clock-based.** Healthy long-running jobs are not falsely marked `failed`.
- R4. **Chunk boundaries do not drop or invalidate rows.** Every row in the source CSV is processed exactly once.
- R5. **Retry / repair endpoints chunk the same way the producer does.** Retrying a large file does not single-shot it.
- R6. **CSV header injection for non-first chunks is correct or fails loudly.** No silent column misalignment.
- R7. **Every ETL job has post-ingestion verification.** R2 row count is compared to `totalProcessed` and the result is observable; significant deltas are surfaced.
- R8. **Operators can trigger a "from scratch" repair of any historical job** without invoking the original producer endpoint.
- R9. **Failures emit Sentry events with structured context.** Operators can debug a stuck job without paging through raw Worker logs.
- R10. **Embedding-fallback degradation is observable.** A job that completed without embeddings is distinguishable from a fully-successful one.
- R11. **Validator rejects unsafe URLs and oversize fields.** Mobile/web cannot be tricked into rendering `javascript:` URLs from the catalog.
- R12. **`invalid_item_logs` retention is bounded.** A bad upload cannot fill Neon storage indefinitely.
- R13. **A documented runbook exists for ETL operations.** A new on-caller can trigger / inspect / retry / drain without reading source.
- R14. **Test coverage exists for every behavior in R1–R12.** Specifically including the cases the global queue-mock in `packages/api/test/setup.ts` currently hides.

---

## Scope Boundaries

- The plan does not raise `max_concurrency` above 1 for the ETL queue. Concurrency bump is blocked on per-chunk idempotency keys that this plan introduces; the actual bump is a follow-up after this lands and bakes.
- The plan does not add a DLQ to the embeddings queue. ETL queue DLQ only.
- The plan does not migrate or rewrite the existing `etl_jobs` row data for the 7 historical jobs falsely marked `failed`. The repair-from-scratch endpoint introduced in U6 is the mechanism operators will use; the actual recovery run is operational, not a code unit.
- The plan does not change the producer endpoint's authentication, the source CSV schema, or the scraper revision pinning.
- The plan does not introduce a new ETL Worker — the current `packages/api` Elysia Worker continues to host both the HTTP routes and the queue consumer.
- The plan does not address `apps/landing` / `apps/guides` / `apps/expo` consumers of catalog data even when bucket-vs-job reconciliation finds drift. Surfacing inconsistencies is in scope; downstream cache invalidation is not.

### Deferred to Follow-Up Work

- **Concurrency bump on `packrat-etl-queue` consumer**: separate PR after this plan ships and per-chunk idempotency is verified in production for ≥2 weeks.
- **Embeddings-queue DLQ + retry policy**: separate plan; same shape as ETL DLQ work in U3, but a distinct surface.
- **Catalog reconciliation across multiple historical jobs**: only per-job reconciliation is in scope. Historical cross-source rollup ("did we lose 5% of the catalog last quarter?") is a separate analytics workstream.
- **Soft-delete / discontinued-item reconciliation** (audit P3 #3): documented as accepted limitation in the runbook (catalog is scraper-controlled, not user content). A future plan can add `availability='OutOfStock'` reconciliation if business requirements emerge.
- **CLI subcommand surface in `packages/cli/src/commands/admin/etl.ts`**: U12 wires the new admin endpoints into the existing CLI command file. Broader CLI ergonomics work is out of scope.

---

## Context & Research

### Relevant Code and Patterns

- **Producer endpoint:** `packages/api/src/routes/catalog/index.ts:229-293` — `POST /catalog/etl`, R2 head + 20 MB chunking at `:253-271`. Chunk creation logic to extract into a shared helper used by U6.
- **Queue producer:** `packages/api/src/services/etl/queue.ts:6-41` — `queueCatalogETL`; uses `sendBatch` with `batchSize: 100` (CF queue per-call cap).
- **Queue consumer dispatch:** `packages/api/src/services/etl/queue.ts:43-61` — `processQueueBatch` with the swallowed catch at `:50-60`. **This is the core P0 #2 surface.**
- **Per-chunk processor:** `packages/api/src/services/etl/processCatalogEtl.ts` — header injection (`:50-58`), partial-row skip (`:95-108`), batch flush (`:120-187`), per-chunk completion (`:188-191`), per-chunk failure (`:201-204`).
- **Atomic counter pattern (mirror this):** `packages/api/src/services/etl/updateEtlJobProgress.ts:16-23` — `sql\`COALESCE(${col}, 0) + ${n}\``. New `chunks_completed` / `total_embedding_failures` increments use the same idiom; the "set status=completed when chunks_completed+1 == chunks_total" branch uses a single `UPDATE ... SET ... WHERE` with a `CASE` expression in the same transaction.
- **Embeddings queue pattern (mirror this):** `packages/api/src/services/catalogService.ts:461-507` — consumer rethrows on failure so CF Queue retries fire. ETL consumer must adopt the same shape.
- **Admin routing pattern:** `packages/api/src/routes/admin/index.ts:117-237` mounts the admin prefix; `:230-237` enforces `adminAuthGuard` on every sub-route. New endpoints in `packages/api/src/routes/admin/analytics/catalog.ts` inherit the guard.
- **R2 access (S3-API not Workers binding):** `packages/api/src/services/r2-bucket.ts:193-360` — `R2BucketService({ env, bucketType: 'catalog' })` wraps `@aws-sdk/client-s3` against the R2 S3 endpoint. `r2.head(key)` and `r2.get(key, { range: { offset, length } })` are the surface. Range format `bytes=offset-(offset+length-1)` at `:675-691`.
- **Schema location:** `packages/db/src/schema.ts:446-510` — `etlJobs`, `invalidItemLogs`, `catalogItemEtlJobs`, status enum at `:460`. **Audit cites a stale path (`packages/api/src/db/schema.ts`); the file was extracted into the `packages/db` package — see merge `b14f4dbd5`.**
- **Drizzle migration location:** `packages/api/drizzle/NNNN_<name>.sql` + `meta/NNNN_snapshot.json` + `_journal.json`. Latest is `0047_cute_bloodscream.sql`; new migrations land at `0048` and `0049` (split per Drizzle Kit's enum-add constraint). Generated via `bun run --cwd packages/api db:generate`. Custom linter at `scripts/lint/check-drizzle-migrations.ts` runs in `lint:custom`.
- **Existing ETL integration test:** `packages/api/test/etl.test.ts` — mocks `R2BucketService` per-test, uses real Postgres via wsproxy at `localhost:5434`. Setup at `packages/api/test/setup.ts:535-572` globally mocks both `queueCatalogETL` and `processQueueBatch` (lines `:544-551`) — this is precisely *why* the per-message swallow in P0 #2 is invisible to CI today, and U14 must un-mock to cover it.
- **Wrangler config:** `packages/api/wrangler.jsonc:65-89` (prod queues) and `:161-194` (dev). Currently `max_batch_size: 1, max_concurrency: 1`, **no `dead_letter_queue`, no `max_retries`** on either consumer. Queue routing handler at `packages/api/src/index.ts:109-124`.
- **Admin CLI surface:** `packages/cli/src/commands/admin/etl.ts` already exists. New endpoints in U6 and U12 add corresponding subcommands.

### Institutional Learnings

- `docs/solutions/` has no prior ETL, Cloudflare Queues, R2 byte-range, or Sentry-in-Workers learnings — only an unrelated Better Auth CLI note and an Android UI bug. This remediation is greenfield from an institutional-knowledge standpoint, which makes it a strong `/ce-compound` target after each phase ships.

### External References

- **Cloudflare Queues — ack/retry semantics:** `message.ack()` / `message.retry({ delaySeconds })` / `ackAll()` / `retryAll()` documented at <https://developers.cloudflare.com/queues/configuration/javascript-apis/>. Throwing fails the un-acked remainder of the batch. `retryDelaySeconds` max is 24h per <https://developers.cloudflare.com/queues/platform/limits/>.
- **Cloudflare Queues — DLQ:** `dead_letter_queue` (string name) + `max_retries` (default 3, max 100) in the consumer block per <https://developers.cloudflare.com/queues/configuration/dead-letter-queues/>.
- **Cloudflare Workers Scheduler:** Only `scheduler.wait(ms)` is documented at <https://developers.cloudflare.com/workers/runtime-apis/scheduler/>. **`scheduler.yield()` does not exist** — the audit P2 #5 recommendation is wrong on this. Use `await scheduler.wait(0)` instead.
- **Wall-clock limit:** Queue consumer wall-clock cap is **15 minutes**, not 30 seconds, per <https://developers.cloudflare.com/queues/platform/limits/>. The audit's "30 s wall-clock" framing under P2 #5 is stale.
- **Sentry on Cloudflare:** Prefer the first-party `@sentry/cloudflare` over toucan-js. Wrap via `Sentry.withSentry(optsFn, { fetch, queue })` per <https://docs.sentry.io/platforms/javascript/guides/cloudflare/>. Queue instrumentation guidance at <https://docs.sentry.io/platforms/javascript/guides/cloudflare/tracing/instrumentation/queues-module/>.
- **Drizzle enum-add limitation:** `ALTER TYPE … ADD VALUE` inside the same transaction as code that uses the new value fails. Split migrations. Tracked at <https://github.com/drizzle-team/drizzle-orm/issues/3249>.
- **R2 range reads with AWS SDK:** R2's S3 API fully supports the `Range` header — `GetObjectCommand({ Range: 'bytes=0-1023' })` behaves identically to S3 per <https://developers.cloudflare.com/r2/api/s3/api/>.

---

## Key Technical Decisions

- **Track chunk completion via two new columns (`chunks_total`, `chunks_completed`) on the existing `etl_jobs` row, gated by a per-chunk idempotency table `etl_job_chunks(job_id, chunk_index, completed_at)` with PK on `(job_id, chunk_index)`.** Rationale: even at `max_concurrency: 1` today, Cloudflare Queues are *at-least-once* — a chunk whose DB writes succeed but whose ack is lost will be redelivered, which would double-increment a naive `chunks_completed = chunks_completed + 1` and either crash through `chunks_total` or transition the job to `completed` while a sibling chunk is still pending. The idempotency table makes the increment a deterministic side-effect of `INSERT … ON CONFLICT (job_id, chunk_index) DO NOTHING RETURNING 1`; the counter only bumps when the insert created a new row. This was originally scoped as a follow-up under "Deferred" but the deepening pass surfaced it as a correctness prerequisite — pulled forward into U1/U2.
- **No new `partial` enum value on `etl_job_status`.** Embedding-fallback degradation is observable via `total_embedding_failures > 0` on a `completed` row. Adding an enum value would force the audit P2 #3 split into two migrations (Drizzle Kit limitation) and complicate every admin filter without observable benefit.
- **Use `@sentry/cloudflare` (first-party), not toucan-js as the audit suggested.** Toucan still works but is no longer the recommended Sentry path on Workers as of 2026. `withSentry({ fetch, queue })` wraps both entry points in one call; no manual `waitUntil` plumbing needed.
- **Use `await scheduler.wait(0)` for yielding, not the non-existent `scheduler.yield()`.** Audit P2 #5 is corrected here.
- **Stuck-job sweep keyed on `last_progress_at < now() - interval '15 minutes'` AND `status = 'running'`,** not on `started_at`. The 15-min figure derives from the actual CF Queue consumer wall-clock cap (15 min), not the audit's stale 30 s/30 min framing. With per-chunk progress updates writing `last_progress_at`, any chunk making real progress is safe; only truly stalled jobs flip to `failed`.
- **Row-boundary alignment happens in the producer**, not the consumer. The producer's `r2.head(key)` flow does an extra small range read on each chunk-end region (e.g., 64 KB) to find the last `\n` and emits chunks with newline-aligned `byteEnd`. This eliminates both the partial-row skip bug (P1 #4) and the row-spanning-chunk bug (P1 #5) in one place. Consumer's `skipPartialRow` logic is removed.
- **CSV header re-read with bounded loop, not a fixed 4 KB slice.** For non-first chunks, the consumer fetches `[0, 4096)`, and if no `\n` appears, expands to `[0, 16384)`, then `[0, 65536)`. If still no newline, throw — header is malformed. Eliminates P1 #3 silent column misalignment.
- **Per-chunk idempotency key is `(jobId, chunkIndex)`** — added to `CatalogETLMessage`. Even though `max_concurrency: 1` means de-facto serialization today, threading the key now unblocks the future concurrency bump without another migration.
- **DLQ is a dedicated new queue `packrat-etl-dlq`** with a minimal consumer that captures the failure to Sentry, persists a row to a new `etl_dlq_events` table for forensics, and acks. The DLQ does *not* attempt to re-process — it's an event sink + visibility tool.
- **Reconciliation runs as both a manual admin endpoint and an automatic post-job step, with the automatic step on its own queue.** Manual endpoint stays synchronous (operator-explicit, scoped to one job). Automatic step is dispatched as a queue message to a new `packrat-etl-reconcile-queue` on the final-chunk completion transition, *not* via `ctx.waitUntil` — `waitUntil` shares the queue invocation's wall-clock budget, which for a multi-GB CSV exceeds the 15-min cap when added on top of the chunk's own processing time. The reconcile consumer streams the file in 100 MB byte-range windows with progress checkpointed to a transient column so retries resume. The consumer's `INSERT … RETURNING` includes `verified_at IS NULL` as an idempotency gate so a redelivered reconcile message is a no-op. Warning threshold remains `> max(10, ceil(0.01 * total_processed))`.
- **Repair-from-scratch endpoint creates a NEW `etl_jobs` row and links it to the old via a new nullable `superseded_by_job_id` column with `ON DELETE SET NULL` and a paired `superseded_at timestamp`.** No mutation of the old row's counters — preserves audit trail and lets the dashboard show "originally failed, repaired by job X". `ON DELETE SET NULL` (not `CASCADE`) so deleting one row never silently nukes a chain of repair attempts. A CHECK constraint prevents self-reference (`superseded_by_job_id != id`). The runbook procedure (U15) requires verifying R2 source presence + ETag match before invoking repair, so an overwritten source cannot silently re-ingest the wrong file.
- **Structured logger lives at `packages/api/src/utils/logger.ts`** as a thin wrapper around `console.*` for now, accepting a `LogContext` (jobId, chunkIndex, r2Key, etc.) and emitting JSON-prefixed lines. Sentry breadcrumbs piggyback on the same call surface. Not a full logger framework — that's a separate decision.

---

## Open Questions

### Resolved During Planning

- **Should the chunk completion track go on `etl_jobs` columns alone, or be paired with a per-chunk idempotency table?** Resolved during deepening: both. `etl_jobs.{chunks_total, chunks_completed}` are the counters; `etl_job_chunks(job_id, chunk_index)` is the idempotency gate that makes the increment safe under at-least-once delivery. See Key Technical Decisions.
- **Should embedding-fallback get a new enum value `partial`?** Resolved: no — use `total_embedding_failures` counter on a `completed` row.
- **Toucan-js or `@sentry/cloudflare`?** Resolved: `@sentry/cloudflare`. See External References.
- **Wall-clock budget for the stuck-job sweep cutoff?** Resolved: `last_progress_at < now() - interval '15 minutes'`, matching the actual queue-consumer wall-clock cap.
- **Should the row-boundary alignment happen in producer or consumer?** Resolved: producer. Single source of truth for chunk boundaries.
- **Should auto-reconcile use `ctx.waitUntil` or its own queue?** Resolved during deepening: dedicated queue (`packrat-etl-reconcile-queue`) with resumable byte-range streaming. `waitUntil` shares the chunk consumer's wall-clock budget, which fails at multi-GB files.
- **Should the DLQ consumer's INSERT + status UPDATE be transactional?** Resolved during deepening: yes, single `db.transaction()`. Same for the sweep's UPDATE + sentinel-event INSERT.
- **Should the migration split into 0048a/0048b/0048c?** Resolved during deepening: no — at ~200 rows, the single-migration approach is fine. Splitting becomes correct when `etl_jobs` exceeds ~100k rows, and the migration header carries a comment to revisit at that scale.

### Deferred to Implementation

- **Exact Drizzle migration sequencing within Phase 1.** All six columns + the partial index + the new `etl_dlq_events` table can land in a single migration `0048` since none touch the enum. Whether to split `superseded_by_job_id` (added later in U6) into its own migration `0049` or include it in `0048` is decided at U1 implementation. Either way the enum stays untouched in this plan.
- **`@sentry/cloudflare` instrumentation depth for the queue consumer.** The exact `Sentry.startSpan` attributes per queue message (some attributes are conventional, some are CF-specific) get finalized when U8 lands.
- **Sentry sampling rate** for the queue consumer. Default to `tracesSampleRate: 0.1` and tune in production; not a plan-time decision.
- **Exact threshold for "significant" reconciliation delta** that triggers a Sentry warning vs informational event. Default: `> max(10, ceil(0.01 * total_processed))` rows of delta. Tunable in production.
- **Cron schedule for `invalid_item_logs` retention sweep.** Daily at 09:00 UTC unless ops has a quieter window.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```text
Producer  ─── POST /catalog/etl ──┐
                                  │
                                  ▼
        ┌─────────────────────────────────────────────┐
        │ chunkCsvForR2(key)  (NEW shared helper)     │
        │   1. r2.head(key) -> size                   │
        │   2. for each 20 MB window:                 │
        │        peek (next 64 KB) to find last '\n'  │
        │        emit chunk with byteEnd = newline-1  │
        │   3. tag each chunk: { jobId, chunkIndex,   │
        │                        chunksTotal, byteRange }
        └─────────────────────────────────────────────┘
                                  │
                          INSERT etl_jobs
                          (status='running',
                           chunks_total=N,
                           chunks_completed=0)
                                  │
                          ETL_QUEUE.sendBatch(chunks)
                                  │
                                  ▼
        ┌─────────────────────────────────────────────┐
        │ processQueueBatch (REWRITE)                 │
        │   for message of batch:                     │
        │     try {                                   │
        │       processCatalogETL(msg)                │
        │       message.ack()                         │
        │     } catch (err) {                         │
        │       Sentry.captureException(err, {...})   │
        │       message.retry({ delaySeconds: 30 })   │
        │     }                                       │
        └─────────────────────────────────────────────┘
                                  │
                                  ▼
        ┌─────────────────────────────────────────────┐
        │ processCatalogETL (per chunk)               │
        │   r2.get(key, range) -> stream              │
        │   if chunkIndex > 0: re-fetch header        │
        │     (expand 4K→16K→64K, throw if no '\n')   │
        │   parse rows (csv-parse, backpressure)      │
        │   per 100 rows: scheduler.wait(0)           │
        │   flush valid -> processValidItemsBatch     │
        │     (embedding fallback increments          │
        │      total_embedding_failures atomically)   │
        │   flush invalid -> processLogsBatch         │
        │     (now RETHROWS on DB failure)            │
        │   on success:                               │
        │     UPDATE etl_jobs                         │
        │       SET chunks_completed = chunks_completed+1,
        │           last_progress_at = now(),         │
        │           status = CASE                     │
        │             WHEN chunks_completed+1         │
        │                  = chunks_total             │
        │             THEN 'completed'                │
        │             ELSE status                     │
        │           END                               │
        │     if completed (in same txn):             │
        │       enqueue ReconcileMessage to           │
        │       packrat-etl-reconcile-queue           │
        └─────────────────────────────────────────────┘
                                  │
                  (on completion transition)
                                  ▼
        ┌─────────────────────────────────────────────┐
        │ processReconcileBatch                       │
        │   reconcileJob(jobId, resumeFromByte=0):    │
        │     if verified_at IS NOT NULL: ack         │
        │     stream 100 MB byte-range windows        │
        │       checkpoint to                         │
        │         verified_row_count_partial          │
        │       if budget low: throw ResumeError      │
        │         (consumer re-enqueues)              │
        │     on EOF: UPDATE verified_at, count       │
        │     if delta > threshold: Sentry warning    │
        └─────────────────────────────────────────────┘
                                  │
                  (on any thrown error after retries)
                                  ▼
                          packrat-etl-dlq
                                  │
                                  ▼
        ┌─────────────────────────────────────────────┐
        │ dlqConsumer                                 │
        │   Sentry.captureException                   │
        │   INSERT etl_dlq_events                     │
        │   ack                                       │
        └─────────────────────────────────────────────┘

Background (CF Cron):
  stuck-job sweep: status='running' AND last_progress_at < now()-15min
                   -> status='failed', emit Sentry warning
  invalid-log retention: DELETE FROM invalid_item_logs WHERE created_at < now()-90d
```

---

## Implementation Units

### U1. Schema migration: chunk tracking, idempotency table, progress timestamp, embedding failures, reconciliation columns, DLQ events table, constraint hardening

**Goal:** Add the columns, tables, indexes, and constraints that the rest of the plan reads and writes. Lands first so every subsequent unit can compile and migrate against a known schema. Single migration `0048` is acceptable at the current ~200-row scale of `etl_jobs`; splitting into multiple migrations is unnecessary engineering at this size (revisit if `etl_jobs` exceeds ~100k rows).

**Requirements:** R1, R3, R7, R8, R10

**Dependencies:** None

**Files:**
- Modify: `packages/db/src/schema.ts` (add columns to `etlJobs`; add new `etlJobChunks` table; add new `etlDlqEvents` table; add UNIQUE constraint to `catalogItemEtlJobs`; export all)
- Create: `packages/api/drizzle/0048_etl_chunking_and_observability.sql`
- Create: `packages/api/drizzle/meta/0048_snapshot.json` (generated)
- Modify: `packages/api/drizzle/meta/_journal.json` (generated)
- Test: `packages/api/test/db-schema-etl.test.ts` (new — schema smoke test asserting columns exist with expected defaults; uses the existing Docker Postgres wsproxy setup at `localhost:5434`)

**Approach:**
- Columns added to `etl_jobs`:
  - `chunks_total integer` (nullable — single-chunk legacy jobs leave it null)
  - `chunks_completed integer DEFAULT 0 NOT NULL`
  - `last_progress_at timestamp` (nullable initially; backfilled to `started_at` for legacy rows in the same migration)
  - `total_embedding_failures integer DEFAULT 0 NOT NULL`
  - `verified_at timestamp` (nullable)
  - `verified_row_count integer` (nullable)
  - `verified_row_count_partial integer` (nullable — checkpoint for resumable reconcile in U10)
  - `superseded_by_job_id text` (nullable, FK to `etl_jobs.id` `ON DELETE SET NULL`)
  - `superseded_at timestamp` (nullable — paired with `superseded_by_job_id` so the timeline survives even after FK cleanup)
  - `source_etag text` (nullable — captured on producer insert from `r2.head(objectKey).etag`; U6's repair endpoint uses this for failure-closed source verification)
  - `source_last_modified timestamp` (nullable — same capture; redundant with etag but cheap)
- CHECK constraints on `etl_jobs`:
  - `etl_jobs_chunks_completed_lte_total CHECK (chunks_total IS NULL OR chunks_completed <= chunks_total)` — fail loudly on over-count.
  - `etl_jobs_no_self_supersede CHECK (superseded_by_job_id IS NULL OR superseded_by_job_id <> id)` — prevent self-referential repair loop.
- New indexes on `etl_jobs`:
  - Partial: `etl_jobs_running_progress_idx` on `(status, last_progress_at)` `WHERE status = 'running'` — for the U5 stuck-job sweep.
  - Partial: `etl_jobs_unverified_idx` on `(verified_at)` `WHERE status = 'completed' AND verified_at IS NULL` — for the U10 watchdog scan.
  - `etl_jobs_superseded_by_idx` on `(superseded_by_job_id)` — for the admin dashboard's "is this job superseded?" lookup.
- New table `etl_job_chunks` (per-chunk idempotency, see Key Technical Decisions):
  - `job_id text NOT NULL` (FK to `etl_jobs.id` `ON DELETE CASCADE`)
  - `chunk_index integer NOT NULL`
  - `completed_at timestamp DEFAULT now() NOT NULL`
  - `PRIMARY KEY (job_id, chunk_index)`
- New table `etl_dlq_events`: `id text PK`, `job_id text` (FK, nullable, `ON DELETE SET NULL`), `chunk_index integer`, `message_body jsonb`, `error_message text`, `error_stack text`, `attempts integer`, `source text` (one of `consumer`, `sweep`; defaults to `consumer`), `created_at timestamp DEFAULT now() NOT NULL`. Index on `created_at`.
- Modification to `catalog_item_etl_jobs`: add `UNIQUE (catalog_item_id, etl_job_id)` so a redelivered chunk's upsert can use `ON CONFLICT DO NOTHING` and not produce duplicate provenance rows.
- Backfill: `UPDATE etl_jobs SET last_progress_at = started_at WHERE last_progress_at IS NULL`. Safe — `etl_jobs` is ~200 rows; sub-100ms on Neon.
- Drizzle generator: `bun run --cwd packages/api db:generate` then verify the SQL file matches the design. **Verify Drizzle Kit emits `DEFAULT 0 NOT NULL` literally in the SQL** — Drizzle sometimes drops the SQL-side default and keeps only the JS-side, which would break inserts from in-flight old workers during a rolling deploy. **Do NOT touch the `etl_job_status` enum in this migration** — no new enum value is needed (see Key Technical Decisions).
- Drizzle Kit does not auto-emit `CONCURRENTLY` for indexes. At 200 rows the index build is instant so `CONCURRENTLY` is nice-to-have, not blocking. If the table grows >100k rows before this lands, hand-edit the generated SQL to use `CREATE INDEX CONCURRENTLY IF NOT EXISTS` and split each index into its own statement-breakpoint block.

**Patterns to follow:**
- Existing `etl_jobs` definition at `packages/db/src/schema.ts:460-479` for column shape and import style.
- Migration `0027_past_madrox.sql` (added `scraper_revision` + index) for the "add column + partial index" pattern.
- `scripts/lint/check-drizzle-migrations.ts` runs in `lint:custom`; the new migration must pass it.

**Test scenarios:**
- Happy path: After migration runs against a populated test DB, all 8 new `etl_jobs` columns are present with the documented defaults; `etl_job_chunks` and `etl_dlq_events` exist; the three new partial/normal indexes are queryable (`EXPLAIN SELECT ... WHERE status='running' ...` uses the running-progress index; the unverified index serves the watchdog).
- Happy path: `INSERT INTO etl_job_chunks (job_id, chunk_index) VALUES ('j1', 0)` succeeds; a duplicate insert returns no row via `ON CONFLICT DO NOTHING RETURNING 1` and the table still contains exactly one row.
- Edge case: Legacy rows have `chunks_total = NULL` and `last_progress_at` backfilled to `started_at`.
- Edge case: `chunks_completed DEFAULT 0` is correctly applied to existing rows (verify with a row that has `chunks_completed = 0` post-migration). The generated SQL must literally include `DEFAULT 0 NOT NULL` — assert via SQL `information_schema.columns`.
- Edge case: `UNIQUE (catalog_item_id, etl_job_id)` on `catalog_item_etl_jobs` prevents a duplicate-insert (returns conflict).
- Error path: Attempting to insert a row with `chunks_completed > chunks_total` violates the CHECK constraint and errors clearly.
- Error path: Attempting to set `superseded_by_job_id = id` violates the no-self-supersede CHECK.
- Error path: Re-running the migration on an already-migrated DB is a no-op (Drizzle's migration log handles this; smoke-test the up/down via `bun run --cwd packages/api db:migrate`).
- Edge case: Down-migration cleanly drops the new columns/tables on a DB with no Phase 2+ data. **Once Phase 2 ships and writes start landing in the new columns, the migration is forward-only** — document in the migration header comment.

**Verification:**
- `bun run --cwd packages/api db:migrate` applies cleanly against a fresh Docker Postgres + against a Postgres seeded with current-prod-shape `etl_jobs` rows.
- `bun lint:custom` passes on the new migration.
- `bun test:api:unit` includes the new schema test and it passes.

---

### U2. P0 #1 fix: chunk-completion lifecycle in producer + consumer

**Goal:** A multi-chunk job's `status` transitions to `completed` only after every chunk has finished. Premature completion eliminated.

**Requirements:** R1

**Dependencies:** U1

**Files:**
- Modify: `packages/api/src/routes/catalog/index.ts` (producer endpoint sets `chunks_total` on `etl_jobs` insert and tags each `CatalogETLMessage` with `chunkIndex` and `chunksTotal`)
- Modify: `packages/api/src/services/etl/types.ts` (extend `CatalogETLMessage.data` with `chunkIndex: number` and `chunksTotal: number`; `byteStart`/`byteEnd` remain)
- Modify: `packages/api/src/services/etl/processCatalogEtl.ts` (rewrite the `:188-191` success-path UPDATE to use the `CASE` expression that flips status only when `chunks_completed + 1 = chunks_total`; also update `last_progress_at` on every counter write)
- Modify: `packages/api/src/services/etl/updateEtlJobProgress.ts` (include `last_progress_at: sql\`now()\`` in the update set so every progress write refreshes the sweep timestamp)
- Test: `packages/api/test/etl-chunk-completion.test.ts` (new)

**Approach:**
- Producer: compute `chunks` first, then `INSERT etl_jobs (..., chunks_total) VALUES (..., ${chunks.length})` — a single round-trip including `chunks_total`. Then `sendBatch` with each message carrying `chunkIndex` 0..N-1 and `chunksTotal: N`. Setting `chunks_total` in the initial INSERT (rather than a separate follow-up UPDATE) eliminates a window where a chunk consumer could observe `chunks_total IS NULL` and silently fail the `chunks_completed + 1 = chunks_total` CASE comparison.
- Consumer success path runs inside a single Drizzle `db.transaction()`:
  1. `INSERT INTO etl_job_chunks (job_id, chunk_index) VALUES ($1, $2) ON CONFLICT (job_id, chunk_index) DO NOTHING RETURNING 1` — the idempotency gate. If no row returned, this is a redelivery; skip the increment, ack the message, return.
  2. If the insert created a row, run the atomic UPDATE: `UPDATE etl_jobs SET chunks_completed = chunks_completed + 1, last_progress_at = now(), status = CASE WHEN chunks_completed + 1 = chunks_total THEN 'completed' ELSE status END, completed_at = CASE WHEN chunks_completed + 1 = chunks_total THEN now() ELSE completed_at END WHERE id = $1 AND status = 'running' RETURNING status, chunks_completed, chunks_total`.
  3. The `WHERE status = 'running'` gate prevents clobbering a row the U5 sweep has already flipped to `failed` (status-flip-flop hazard).
  4. If the returned row shows the transition to `completed`, *and* this transaction was the one that created the chunk-row in step 1, send a message to `packrat-etl-reconcile-queue` (see U10) for the auto-reconcile.
- On per-chunk failure: the consumer no longer flips the parent job to `failed` immediately. Instead it lets the message throw / retry. The parent job only flips to `failed` via (a) DLQ consumer when retries are exhausted, or (b) the stuck-job sweep (U5).
- Single-chunk legacy jobs: when `chunks_total IS NULL`, the `etl_job_chunks` insert still gates the increment; legacy rows backfilled to `chunks_total = 1` migrate cleanly. Backwards-compatible with any in-flight legacy messages.
- The CHECK constraint `chunks_completed <= chunks_total` from U1 is the loud-failure safety net — if the idempotency gate ever leaks (e.g., a code bug bypasses the chunk-table insert), the next `UPDATE` errors with a constraint violation rather than silently corrupting the counter.

**Patterns to follow:**
- Atomic SQL update idiom at `packages/api/src/services/etl/updateEtlJobProgress.ts:16-23`.
- Drizzle transaction shape: `await db.transaction(async (tx) => { ... })`.

**Test scenarios:**
- Happy path: 5-chunk job; chunks 0..3 complete successfully → status remains `running` with `chunks_completed = 4`; chunk 4 completes → status flips to `completed`, `completed_at` set, `etl_job_chunks` has 5 rows.
- Happy path (idempotency): Chunk 2 succeeds, ack lost, CF redelivers → second attempt's `INSERT … ON CONFLICT DO NOTHING RETURNING` returns no row → increment is skipped → `chunks_completed` increments exactly once over the two deliveries.
- Edge case: Chunks complete out of order (chunk 3 finishes before chunk 1) → status flips only when all five have incremented; the `etl_job_chunks` rows record actual completion order.
- Edge case: Single-chunk legacy job (`chunks_total = 1`) → flips to `completed` on its one success; `etl_job_chunks` has 1 row.
- Edge case: Sweep flips job to `failed` mid-flight; the next chunk's UPDATE `WHERE … AND status = 'running'` returns zero rows → transaction sees the conflict, logs warning, lets the operator route to repair-from-scratch.
- Error path: One chunk throws; other chunks succeed → parent job stays `running` while CF Queue retries the failed chunk; if retries exhaust, DLQ consumer (U3) handles state transition.
- Error path: CHECK constraint trips (hypothetical leaked-idempotency bug) → UPDATE errors loudly, chunk retries, no silent corruption.
- Integration: With `R2BucketService` mocked to return a small CSV split into 3 chunks via `byteRange`, the full producer→queue→consumer cycle ends in exactly one `status=completed` transition for the parent job AND exactly one reconcile message enqueued.
- Integration (idempotency at scale): Replay every chunk message twice → `etl_job_chunks` has exactly `chunks_total` rows, counters match, status = `completed`.

**Verification:**
- Re-running `etl.test.ts` plus the new test under `bun test:api` shows no `status='completed'` write until `chunks_completed = chunks_total`.
- A manual prod-shape replay (`POST /catalog/etl` against the dev Worker with a CSV that produces ≥3 chunks) shows the dashboard's `successRate` remain at the running state until all chunks finish.

---

### U3. P0 #2 fix: explicit ack/retry + DLQ wiring

**Goal:** No per-message exception is silently swallowed. Failures retry; exhausted retries land in a dedicated DLQ that emits Sentry events and persists for forensics.

**Requirements:** R2, R9

**Dependencies:** U1 (for `etl_dlq_events` table)

**Files:**
- Modify: `packages/api/src/services/etl/queue.ts` (rewrite `processQueueBatch` for explicit per-message ack/retry; remove the swallow at `:50-60`)
- Create: `packages/api/src/services/etl/processDlqEvent.ts` (DLQ consumer; INSERT into `etl_dlq_events`, capture Sentry exception, ack)
- Modify: `packages/api/src/index.ts` (extend the `queue()` switch at `:109-124` with arms for `packrat-etl-dlq` and `packrat-etl-dlq-dev`)
- Modify: `packages/api/wrangler.jsonc` (declare `packrat-etl-dlq` and `packrat-etl-dlq-dev` as producer + consumer; add `dead_letter_queue: "packrat-etl-dlq"` and `max_retries: 3` to the ETL consumer block at `:78-82` and dev equivalent at `:178-182`)
- Modify: `packages/api/src/services/etl/processCatalogEtl.ts` (when a chunk's processing throws, also UPDATE `last_progress_at` and increment a transient `last_error_at` if useful — see Approach for trade-off; primary work is removing the per-chunk `status='failed'` write at `:201-204` since the DLQ consumer is now responsible for state transition)
- Test: `packages/api/test/etl-queue-retry.test.ts` (new — covers the global-mock blind spot in `setup.ts:544-551`)

**Approach:**
- Rewrite `processQueueBatch`:
  ```text
  for (const message of batch.messages) {
    try {
      await processCatalogETL({ message: message.body, env });
      message.ack();
    } catch (err) {
      logger.error('etl.chunk.failed', { jobId, chunkIndex, err });
      Sentry.captureException(err, { tags: { jobId, chunkIndex, r2Key }, contexts: { queue: { messageId: message.id, attempts: message.attempts } } });
      message.retry({ delaySeconds: 30 });
    }
  }
  ```
  (Sentry wiring lives in U8; in U3 the call sites are added as no-ops that U8 fills in.)
- DLQ consumer reads from `packrat-etl-dlq` and, inside a single `db.transaction()`, performs: (1) `INSERT INTO etl_dlq_events (… source = 'consumer')` capturing `{ jobId, chunkIndex, message_body, error_message, error_stack, attempts }`, (2) `UPDATE etl_jobs SET status = 'failed', completed_at = now() WHERE id = $1 AND status = 'running'` — the `WHERE status = 'running'` clause is the no-op gate that prevents racing the U5 sweep. `Sentry.captureException` fires *before* the transaction (so the event survives even if the DB transaction rolls back) with tags `{ jobId, chunkIndex, r2Key }`. The `error_stack` field is contractually free of raw CSV row data — only structural error messages — to avoid accidental PII capture (documented at the call site).
- Wrangler config additions:
  ```text
  // producer
  { "queue": "packrat-etl-dlq", "binding": "ETL_DLQ" }
  // consumer
  { "queue": "packrat-etl-dlq", "max_batch_size": 10, "max_batch_timeout": 30 }
  // on the existing ETL consumer:
  "dead_letter_queue": "packrat-etl-dlq",
  "max_retries": 3
  ```
  Same shape applied to `*-dev` queues.
- The removal of the per-chunk `status='failed'` write at `processCatalogEtl.ts:201-204` is critical — leaving it would race with the DLQ consumer's state transition.
- `processCatalogETL` rethrows on any internal failure (it already does); no behavioral change other than the consumer's catch now retries instead of swallowing.

**Patterns to follow:**
- Embeddings consumer pattern at `packages/api/src/services/catalogService.ts:461-507` for the rethrow shape.
- Existing `queue()` dispatch at `packages/api/src/index.ts:109-124` for the new DLQ arm.

**Test scenarios:**
- Happy path: Single message processes successfully → `message.ack()` called exactly once; no retry; no DLQ row.
- Error path: Transient throw (simulated R2 5xx) → first call: `message.retry({ delaySeconds: 30 })` and no DLQ; second call succeeds → ack. Total DLQ rows = 0.
- Error path: Permanent throw (4 attempts all fail) → exhausts `max_retries: 3` → message routed to `packrat-etl-dlq` → DLQ consumer inserts row in `etl_dlq_events` with `attempts = 4`, captures Sentry, flips `etl_jobs.status = 'failed'`.
- Integration: Un-mock `processQueueBatch` (override `setup.ts:544-551` per-file with `vi.doUnmock`) and exercise the real consumer against an in-memory queue stub.
- Edge case: Two messages in a batch, first throws and second succeeds (this should not happen at `max_batch_size: 1` but the code path supports it) → first retries, second acks; no cross-contamination of state.

**Verification:**
- New test passes with the per-message catch removed; passes with the catch present too (so the test actually proves the new behavior).
- `bun test:api` overall still green.
- Inspecting `packrat-etl-dlq` queue depth in `wrangler queues info packrat-etl-dlq-dev` after a forced failure shows zero (because the DLQ consumer drains immediately).

---

### U4. Sweep cleanup: remove the broken wall-clock stuck-job sweep before U5 replaces it

**Goal:** Take the existing `POST /admin/etl/reset-stuck` endpoint out of production rotation before U5's progress-based replacement lands, to stop new false-failures while the rest of Phase 2 ships.

**Requirements:** R3

**Dependencies:** None (independent of U1; this is a code removal)

**Files:**
- Modify: `packages/api/src/routes/admin/analytics/catalog.ts` (remove or guard the `POST /admin/etl/reset-stuck` route at `:384-409`; if removed, also remove from the OpenAPI spec)
- Modify: `packages/cli/src/commands/admin/etl.ts` (drop any subcommand wired to the removed endpoint)
- Test: `packages/api/test/admin-etl-routes.test.ts` (new or extend existing — assert the route returns 410 Gone or is absent)

**Approach:**
- Two options, both acceptable:
  - **Remove the route entirely.** Anyone calling it gets a 404. Cleanest. Recommended if no automation depends on it.
  - **Replace the route body with a 410 Gone response** that links to the runbook (added in U15) and the new sweep design from U5. Use if there's any concern about external automation calling it.
- Existing endpoint logic at `:384-409` does `UPDATE etl_jobs SET status='failed' WHERE status='running' AND started_at < now() - interval '30 minutes'`. This is the SQL that wrongly failed the 7 jobs on 2026-05-14.
- This unit ships before U5 lands the replacement, so for a short window there is no automated sweep at all. Acceptable because stuck-job recovery in that window is operational (U15 runbook documents the manual SQL).

**Patterns to follow:**
- Existing admin route removal pattern (none in repo as of this writing); fall back to standard Elysia route definition omission.

**Test scenarios:**
- Happy path: `POST /admin/etl/reset-stuck` returns 410 (or 404 if removed) — test asserts on the chosen behavior.
- Edge case: Admin CLI subcommand for the old endpoint no longer exists (or returns a clear "removed, see runbook" message).

**Verification:**
- `bun test:api` passes with the new assertion.
- Manual `curl` against dev Worker returns the chosen status code.

---

### U5. P1 #2 fix: progress-based stuck-job sweep

**Goal:** Replace the wall-clock-based sweep with one that uses `last_progress_at` so healthy long jobs (e.g., 50,100-row `evo` file) are not falsely failed.

**Requirements:** R3

**Dependencies:** U1 (for `last_progress_at`), U2 (for the `last_progress_at` write-on-progress), U4 (so the old sweep is gone first)

**Files:**
- Create: `packages/api/src/services/etl/sweepStuckJobs.ts` (the sweep function — pure DB logic, no HTTP)
- Modify: `packages/api/src/routes/admin/analytics/catalog.ts` (new `POST /admin/etl/sweep-stuck` endpoint that calls `sweepStuckJobs` and returns the affected rows; for manual triggering)
- Modify: `packages/api/wrangler.jsonc` (declare a CF Cron Trigger for the sweep, e.g., `*/5 * * * *`)
- Modify: `packages/api/src/index.ts` (add `scheduled()` handler that invokes `sweepStuckJobs` on the cron event; if a `scheduled` handler doesn't yet exist, add one)
- Test: `packages/api/test/etl-stuck-job-sweep.test.ts` (new)

**Approach:**
- Sweep runs inside a single `db.transaction()`:
  1. `UPDATE etl_jobs SET status='failed', completed_at = now() WHERE status='running' AND COALESCE(last_progress_at, started_at) < now() - interval '15 minutes' RETURNING id, source, filename, started_at, last_progress_at, chunks_total, chunks_completed`. (The `COALESCE` defends against any legacy row that somehow escaped the U1 backfill.)
  2. For each returned row, `INSERT INTO etl_dlq_events (job_id, error_message, source) VALUES ($1, 'sweep:no_progress', 'sweep')` so the forensic table is the single source of truth for *every* failed transition — whether triggered by the consumer DLQ or by the sweep. `chunk_index = NULL` in sweep-sourced events.
- Returned rows also feed a Sentry warning event per affected job (`level: warning`, tags `{ jobId, source: 'sweep' }`, extra includes `chunks_completed/chunks_total` so the operator immediately sees how far the job got).
- 15-minute interval matches the CF Queue consumer wall-clock cap. Any chunk making real progress writes `last_progress_at = now()` (via U2's modification to `updateEtlJobProgress`), so this only catches truly stalled jobs.
- CF Cron Trigger every 5 minutes (configurable via env if needed). The cron handler is idempotent — the partial index from U1 keeps the query cheap even at thousands of jobs. Wrangler config shape: `"triggers": { "crons": ["*/5 * * * *"] }` — top-level `triggers` object wrapping a `crons` array, not a bare top-level `crons` key.
- Manual admin endpoint exists for on-demand sweep — useful during incident response.

**Patterns to follow:**
- Admin route structure at `packages/api/src/routes/admin/analytics/catalog.ts` for the new endpoint.
- CF Cron Triggers config in `wrangler.jsonc` (the repo has none today — this is the first; reference <https://developers.cloudflare.com/workers/configuration/cron-triggers/>).

**Test scenarios:**
- Happy path: Insert a job with `status='running'`, `last_progress_at = now() - 30min` → sweep flips it to `failed`.
- Edge case: Insert a job with `status='running'`, `last_progress_at = now() - 5min` → sweep leaves it alone (within budget).
- Edge case: Insert a job with `last_progress_at = NULL` (somehow — legacy row that escaped backfill) → COALESCE the column with `started_at` in the WHERE clause so it still gets evaluated.
- Edge case: 50,100-row job in progress — chunks write `last_progress_at = now()` every 100 rows → sweep never fires on it.
- Integration: Cron-event simulation calls the same code path as the admin endpoint; both return identical results for the same DB state.
- Error path: Sweep query fails (DB down) → caller observes the error; Sentry captures; cron does not silently mask.

**Verification:**
- After running the sweep against a DB with the seeded test cases, exactly the long-stalled rows are affected.
- `bun test:api` includes the new test and passes.
- Dev cron schedule fires (`wrangler dev --test-scheduled`) and exercises the handler.

---

### U6. P1 #1 fix: shared chunking helper + retry endpoint + repair-from-scratch endpoint

**Goal:** Both retry and repair use the same producer chunking logic. The repair endpoint creates a brand-new `etl_jobs` row linked to the broken historical one — directly enabling the operational recovery of the 7 wrongly-`failed` jobs from 2026-05-14.

**Requirements:** R5, R8

**Dependencies:** U1 (for `superseded_by_job_id`), U2 (for `chunks_total` write semantics)

**Files:**
- Create: `packages/api/src/services/etl/chunkCsvForR2.ts` (extracted shared helper: takes `objectKey`, returns an array of `{ chunkIndex, chunksTotal, byteStart, byteEnd }` with newline-aligned boundaries — newline alignment itself ships in U7)
- Modify: `packages/api/src/routes/catalog/index.ts` (replace inline chunking at `:253-271` with a call to `chunkCsvForR2`)
- Modify: `packages/api/src/routes/admin/analytics/catalog.ts` (rewrite `POST /admin/etl/:jobId/retry` at `:413-470` to use `chunkCsvForR2`; add new `POST /admin/etl/:jobId/repair-from-scratch`)
- Modify: `packages/api/src/services/etl/queue.ts` (extend `queueCatalogETL` to accept pre-computed chunks rather than constructing them — or accept either, with the chunk-construction path migrating to the shared helper)
- Modify: `packages/cli/src/commands/admin/etl.ts` (add `retry <jobId>` subcommand if not present, plus new `repair-from-scratch <jobId>` subcommand)
- Test: `packages/api/test/etl-retry-repair.test.ts` (new)

**Approach:**
- `chunkCsvForR2(objectKey, r2, options?)`: signature returns `Promise<ChunkSpec[]>`. Calls `r2.head(objectKey)`, splits into 20 MB windows. Newline-alignment lives in U7 but the shape lands here so U7 is a fill-in.
- Retry endpoint (`POST /admin/etl/:jobId/retry`): looks up `(source, filename, scraperRevision)` from the existing job, generates a fresh `jobId`, INSERTs a new `etl_jobs` row with `chunks_total = chunkCsvForR2(...).length`, sets `superseded_by_job_id = <original jobId>` on the new row only if the original is `failed`, sends batch.
- Repair-from-scratch (`POST /admin/etl/:jobId/repair-from-scratch`): same behavior as retry but always sets `superseded_by_job_id` and `superseded_at = now()` on the new row, and always re-reads the full file (even if the original was `completed`). Use case: an operator suspects a `completed` job is undercount; repair recreates from scratch.
- **R2 ETag verification (failure-closed)**: before creating the new job row, both endpoints call `r2.head(objectKey)` and compare the returned `etag` (and `lastModified`) against the original job's recorded values. If the original job has no `etag` stored (legacy rows), require an explicit `?force=true` query flag. If the `etag` differs (source was overwritten by a later scrape), return 409 Conflict with a clear message naming both etags — never silently re-ingest a different file under the same path. (This implies adding `source_etag text` and `source_last_modified timestamp` to `etl_jobs` — fold into U1's column list if not already, or capture as a follow-up here.)
- Both endpoints accept an optional `?dryRun=true` query that returns the planned chunk spec without enqueuing anything — operator preview.
- The 7 historical jobs from 2026-05-14 will be recovered by calling repair-from-scratch on each of them once Phase 1+2 ships. U15 runbook documents the operator procedure including the ETag verification step.

**Patterns to follow:**
- Admin route structure at `packages/api/src/routes/admin/analytics/catalog.ts:178-235` for response shape.
- Existing retry endpoint at `:413-470` for the basic flow (just don't replicate the broken single-chunk behavior).

**Test scenarios:**
- Happy path: Retry a failed job with a 50 MB source file → 3 chunks created via `chunkCsvForR2`, 3 messages sent, new `etl_jobs` row has `chunks_total = 3`, `superseded_by_job_id` matches original.
- Happy path: Repair-from-scratch a `completed` job with apparent undercount → new job created with `superseded_by_job_id` set; original row untouched.
- Edge case: Retry a single-chunk legacy job (file size < 20 MB) → 1 chunk, `chunks_total = 1`, behaves identically to the producer endpoint.
- Edge case: Retry on a job whose `filename` no longer exists in R2 → endpoint returns 404 with a clear message; no new `etl_jobs` row.
- Edge case: `?dryRun=true` returns the planned chunk spec; no DB writes, no queue sends.
- Integration: Repair-from-scratch on a 50,100-row file (the `evo` case) produces the expected ~3 chunks, all enqueued, and after the full pipeline completes the new job's `total_processed` matches the file's actual row count.
- Covers AE: the 7 jobs from 2026-05-14 can each be repaired by calling repair-from-scratch — verified manually post-deploy.

**Verification:**
- Both endpoints documented in the OpenAPI spec emitted by `@elysiajs/openapi`.
- CLI subcommands invoke the endpoints with proper auth.
- `bun test:api` passes the new integration test.

---

### U7. P1 #3 + P1 #4 + P1 #5 fix: row-boundary-aligned chunks + robust header injection

**Goal:** No row is silently dropped, invalidated, or split across chunks. Wide-CSV headers (>4 KB) fail loudly instead of silently misaligning columns.

**Requirements:** R4, R6

**Dependencies:** U6 (for `chunkCsvForR2`)

**Files:**
- Modify: `packages/api/src/services/etl/chunkCsvForR2.ts` (implement newline alignment — for each 20 MB window, read the next 64 KB tail, find the last `\n`, snap `byteEnd` to the byte before that newline)
- Modify: `packages/api/src/services/etl/processCatalogEtl.ts` (remove `skipPartialRow` at `:95-108`; rewrite header injection at `:50-58` with a bounded expand loop 4K→16K→64K; throw a typed error if no newline in 64 KB)
- Test: `packages/api/test/etl-chunk-boundaries.test.ts` (new)

**Approach:**
- Newline alignment in producer:
  - For each chunk window `[start, start + 20MB)`:
    - Read `[start + 20MB - 64KB, start + 20MB)`.
    - Find the index of the last `\n` in that slice.
    - If found: `byteEnd = (start + 20MB - 64KB) + lastNewlineIndex`. The next chunk's `byteStart = byteEnd + 1`.
    - If not found in 64 KB (extremely unlikely with normal CSV row sizes): throw `ChunkBoundaryError` immediately, surfacing to Sentry and aborting the job creation. Caller is told the file has a row larger than 64 KB.
  - Last chunk: `byteEnd = file.size - 1`.
- Header re-fetch in consumer (for `chunkIndex > 0`):
  ```text
  let headerSlice = await r2.get(key, { range: { offset: 0, length: 4096 }}).then(b => b.text());
  let nlIdx = headerSlice.indexOf('\n');
  if (nlIdx === -1) {
    headerSlice = await r2.get(key, { range: { offset: 0, length: 16384 }}).then(b => b.text());
    nlIdx = headerSlice.indexOf('\n');
  }
  if (nlIdx === -1) {
    headerSlice = await r2.get(key, { range: { offset: 0, length: 65536 }}).then(b => b.text());
    nlIdx = headerSlice.indexOf('\n');
  }
  if (nlIdx === -1) throw new EtlHeaderError(`No newline in first 64 KB of ${key} — malformed header`);
  const headerRow = headerSlice.slice(0, nlIdx);
  ```
- Since chunks are now newline-aligned, `skipPartialRow` is no longer needed — the consumer can stream the chunk body directly into the parser after prepending the header.
- BOM handling: if the first byte of the header slice is `0xEF 0xBB 0xBF`, strip it before extracting the header row. Same treatment for the first chunk.

**Patterns to follow:**
- R2 byte-range read pattern at `packages/api/src/services/etl/processCatalogEtl.ts:54, 71`.
- Typed-error pattern: extend whatever the repo uses for domain errors (typically `Error` subclasses in `packages/api/src/utils/errors.ts`).

**Test scenarios:**
- Happy path: 5 MB file, 1 chunk → no boundary logic exercised; row count matches actual.
- Happy path: 60 MB file, 3 chunks; rows of varying width; all `byteEnd` values land immediately before a `\n`; total row count across chunks = file row count.
- Edge case: Chunk boundary lands exactly on a newline character (`source[byteEnd] === '\n'`) → still aligned; next chunk starts on next row; no dropped row.
- Edge case: Header row of 4500 bytes (just over 4 KB) → re-fetch expands to 16 KB, succeeds; columns mapped correctly.
- Edge case: Header row of 50 KB (one absurdly wide CSV) → re-fetch expands to 64 KB, succeeds.
- Edge case: BOM at start of file → stripped from header extraction in both chunk-0 and re-fetch paths.
- Error path: File with no newline in first 64 KB → throws `EtlHeaderError`; job marked `failed` via DLQ (U3).
- Error path: Row larger than 64 KB encountered at a chunk boundary → producer throws `ChunkBoundaryError`; no job created.
- Integration: A real CSV from prod (anonymized fixture in `packages/api/test/fixtures/`) splits into multiple chunks; sum of consumer-reported `totalProcessed` across all chunks equals `wc -l fixture.csv - 1` (subtract header).
- Covers AE: A 50,100-row file (the `evo` shape) ingested via the new chunking logic shows `total_processed = 50100`, `total_valid + total_invalid = 50100`, no missing rows.

**Verification:**
- Manual run on a real prod fixture file with `wc -l` cross-check matches the job's `total_processed`.
- `bun test:api` passes the new fixture-driven test.
- Sentry catches the malformed-header case during the next dev exercise.

---

### U8. Sentry wiring via `@sentry/cloudflare`

**Goal:** Every uncaught exception in the API Worker — including queue-consumer paths — emits a Sentry event with structured tags. Operators can debug a stuck job without paging through raw Worker logs.

**Requirements:** R9

**Dependencies:** None (independent; can start in parallel with Phase 1 but lands in Phase 3)

**Files:**
- Modify: `packages/api/package.json` (add `@sentry/cloudflare` dependency; pin to a specific version)
- Modify: `packages/api/src/index.ts` (wrap the Worker default export with `Sentry.withSentry({...}, { fetch, queue })`; pass the Sentry options factory that reads `env.SENTRY_DSN`)
- Modify: `packages/api/src/utils/env-validation.ts` (no schema change — `SENTRY_DSN` is already declared at `:9, 94`; verify it's required vs optional and adjust accordingly so dev doesn't break without a DSN)
- Modify: `packages/api/wrangler.jsonc` (add `upload_source_maps: true` at the top level)
- Modify: `packages/api/src/services/etl/queue.ts` (fill in the `Sentry.captureException(...)` call site that U3 stubbed)
- Modify: `packages/api/src/services/etl/processCatalogEtl.ts` (Sentry breadcrumbs at chunk-start, batch-flush, and chunk-end; `Sentry.startSpan` around the chunk lifecycle)
- Create: `packages/api/src/utils/logger.ts` (the thin structured logger — accepts `LogContext`, emits JSON-prefixed `console.log` lines, also calls `Sentry.addBreadcrumb` when Sentry is initialized)
- Modify: All `packages/api/src/services/etl/*.ts` console calls migrated to `logger.{info,warn,error}` (mechanical change — sweeps across the ETL files)
- Test: `packages/api/test/sentry-instrumentation.test.ts` (new — mocks `@sentry/cloudflare` and asserts captureException/breadcrumb call shape)

**Approach:**
- `withSentry({ fetch, queue })` wraps the existing default export at `packages/api/src/index.ts`. The Sentry options factory reads `env.SENTRY_DSN`, `env.ENVIRONMENT`, sets `tracesSampleRate: 0.1`.
- Queue consumer instrumentation per <https://docs.sentry.io/platforms/javascript/guides/cloudflare/tracing/instrumentation/queues-module/>:
  - `Sentry.startSpan({ op: 'queue.process', name: 'etl-chunk', attributes: { 'messaging.message.id': msg.id, 'messaging.message.retry.count': msg.attempts, 'jobId': msg.body.id, 'chunkIndex': msg.body.data.chunkIndex } }, async () => { ... })`.
  - `Sentry.captureException(err, { tags: { jobId, chunkIndex, r2Key }, contexts: { queue: { messageId, attempts } } })` inside the catch.
- DLQ consumer (from U3) gets the same treatment.
- `logger.ts`: ~30 lines. Functions: `info(event, ctx)`, `warn(event, ctx)`, `error(event, ctx, err?)`. Emits a JSON line; if Sentry is initialized, also calls `Sentry.addBreadcrumb({ category: event, data: ctx, level })`.
- Source maps: `upload_source_maps: true` works with Wrangler 4.x and `compatibility_date: 2025-06-01`.

**Patterns to follow:**
- No existing Sentry initialization in `packages/api` — this is the first.
- Reference Sentry-in-CF guidance: <https://docs.sentry.io/platforms/javascript/guides/cloudflare/>.

**Test scenarios:**
- Happy path: Successful chunk → one `startSpan` invocation, breadcrumbs at chunk-start/flush/end, no `captureException`.
- Error path: Chunk throws → `captureException` called once with expected tags; span marks status `internal_error`.
- Edge case: `SENTRY_DSN` empty (dev without secret) → no Sentry calls fire; logger still emits lines; no crash.
- Edge case: Logger called before Sentry initialized (cold-start race) → graceful no-op on breadcrumb path; logger.info still emits the line.
- Integration: A real Sentry test project receives events from `bun api` dev-server when forced failures are triggered.

**Verification:**
- Dev `bun api` cold start logs the Sentry init line.
- A forced chunk failure produces a Sentry event visible in the project.
- All `packages/api/src/services/etl/*.ts` files have zero `console.*` references (`grep -rn 'console\.' packages/api/src/services/etl/` returns nothing).

---

### U9. P2 #2 + P2 #3 + P2 #4 fix: error propagation + embedding-failure observability + IIFE error handling

**Goal:** Three related but smaller correctness issues that all share the theme "errors should not vanish silently."

**Requirements:** R2, R10

**Dependencies:** U1 (for `total_embedding_failures`), U8 (so the new error sites can `Sentry.captureException`)

**Files:**
- Modify: `packages/api/src/services/etl/processLogsBatch.ts` (rethrow on DB failure at `:25-27`; remove the swallow)
- Modify: `packages/api/src/services/etl/processValidItemsBatch.ts` (in the embedding-fallback path at `:52-63`, atomically increment `etl_jobs.total_embedding_failures` before upserting; surface a Sentry warning event with `jobId` and the affected SKU count; do not throw)
- Modify: `packages/api/src/services/etl/processCatalogEtl.ts` (wrap the writer IIFE at `:89-117` in an explicit promise: `const writerPromise = (async () => { ... })().catch(err => parser.destroy(err)); ...; await writerPromise.catch(err => { throw err })` so unhandled rejections become outer-flow throws)
- Modify: `packages/api/src/routes/admin/analytics/catalog.ts` (extend the admin job-list response to include `totalEmbeddingFailures` so dashboards can surface degradation)
- Test: `packages/api/test/etl-error-propagation.test.ts` (new)

**Approach:**
- `processLogsBatch`: catch block currently logs and returns. Replace with `throw err`. The outer `processCatalogETL` catch already exists and the chunk will retry/DLQ correctly via U3.
- Embedding fallback: at `processValidItemsBatch.ts:52-63`, on `generateManyEmbeddings` throw:
  ```text
  await db.update(etlJobs).set({ totalEmbeddingFailures: sql`COALESCE(${etlJobs.totalEmbeddingFailures}, 0) + ${items.length}` }).where(eq(etlJobs.id, jobId));
  logger.warn('etl.embedding.fallback', { jobId, skuCount: items.length });
  Sentry.captureMessage('etl.embedding.fallback', { level: 'warning', tags: { jobId }, extra: { skuCount: items.length } });
  // continue with upsert; embedding stays NULL
  ```
- IIFE wrap pattern:
  ```text
  const writerPromise = (async () => { ... })()
    .catch(err => { parser.destroy(err); throw err; });
  // ... for await loop ...
  await writerPromise;
  ```
  Any rejection in the writer now propagates to the outer try/catch in `processCatalogETL` and triggers retry/DLQ via U3.
- Admin response extension: extend the existing `GET /admin/analytics/catalog/etl` route's select shape to include `totalEmbeddingFailures` and update the response Zod schema if one is declared.

**Patterns to follow:**
- Atomic update idiom at `packages/api/src/services/etl/updateEtlJobProgress.ts:16-23`.
- Admin route response shape at `packages/api/src/routes/admin/analytics/catalog.ts:178-235`.

**Test scenarios:**
- Happy path (embedding fallback): Embedding service throws → SKUs upserted with `embedding=NULL`; `total_embedding_failures` increments by exactly `items.length`; Sentry warning event fires once per batch (not per SKU).
- Happy path (logs rethrow): `processLogsBatch` DB INSERT fails → exception propagates to outer catch → chunk retried by CF Queue.
- Happy path (IIFE wrap): Writer throws inside the async IIFE → parser destroyed; outer `for await` loop terminates; outer catch fires; chunk retried.
- Edge case: Multiple consecutive embedding batches in one chunk all fall back → counter increments cumulatively; Sentry warnings fire once per batch, not once per chunk.
- Edge case: Mixed batch — some SKUs embed, then fallback kicks in for the rest → counter increments only for the failed batch's SKU count.
- Integration: Admin endpoint response includes `totalEmbeddingFailures` field for every job; the prod-shape dashboard query still parses cleanly.

**Verification:**
- New test passes with the rethrow / wrap / counter increments in place.
- `bun test:api` overall green.
- Dev admin endpoint `GET /admin/analytics/catalog/etl?limit=5` returns the new field.

---

### U10. Reconciliation: admin endpoint + automatic post-job verification (via dedicated queue) + CLI subcommand

**Goal:** Every ETL completion writes a verification row count; operators can also trigger reconciliation on any job on demand. Surfaces the user's "missing or falsely labeling" concern as a first-class observable signal. Auto-reconciliation runs on its own queue, not via `ctx.waitUntil`, so multi-GB files do not exceed the queue invocation's 15-min wall-clock.

**Requirements:** R7

**Dependencies:** U1 (for `verified_at`, `verified_row_count`, `verified_row_count_partial`), U2 (for the completion transition that enqueues the reconcile message), U8 (for Sentry warnings on delta)

**Files:**
- Create: `packages/api/src/services/etl/reconcileJob.ts` (pure function: given a `jobId` and optional `resumeFromByte`, stream the R2 source in 100 MB byte-range windows, count newlines, checkpoint progress, finalize verification on EOF, return delta)
- Create: `packages/api/src/services/etl/processReconcileBatch.ts` (queue consumer for `packrat-etl-reconcile-queue`; calls `reconcileJob`; handles retry/resume)
- Modify: `packages/api/src/services/etl/queue.ts` (extend producer to enqueue reconcile messages; type `ReconcileMessage { jobId: string; resumeFromByte?: number }`)
- Modify: `packages/api/src/services/etl/processCatalogEtl.ts` (on the final-chunk completion transition from U2, enqueue a `ReconcileMessage` to `packrat-etl-reconcile-queue` *inside the same transaction* as the status flip so a row can never transition to `completed` without an enqueued reconcile)
- Modify: `packages/api/src/index.ts` (extend the `queue()` switch with an arm for `packrat-etl-reconcile-queue` and `packrat-etl-reconcile-queue-dev`)
- Modify: `packages/api/wrangler.jsonc` (declare `packrat-etl-reconcile-queue` and `packrat-etl-reconcile-queue-dev` as producer + consumer with its own `dead_letter_queue: 'packrat-etl-dlq'` and `max_retries: 3`)
- Modify: `packages/api/src/routes/admin/analytics/catalog.ts` (add `POST /admin/etl/:jobId/reconcile` — calls `reconcileJob` synchronously; for small/medium files returns inline; for large files returns 202 Accepted and enqueues to the reconcile queue with the existing job id)
- Modify: `packages/cli/src/commands/admin/etl.ts` (add `reconcile <jobId>` subcommand)
- Modify: admin list endpoint response shape (include `verifiedAt`, `verifiedRowCount`, and `verifiedRowCountPartial` so the dashboard surfaces it)
- Test: `packages/api/test/etl-reconciliation.test.ts` (new)

**Approach:**
- `reconcileJob(jobId, resumeFromByte = 0)`:
  1. Read `(filename, total_processed, verified_at, verified_row_count_partial)` from `etl_jobs`. If `verified_at IS NOT NULL`, return early — idempotent no-op for redelivered messages.
  2. `r2.head(key)` → `fileSize`.
  3. From `resumeFromByte` (or `verified_row_count_partial`'s checkpoint byte position if set), read 100 MB byte-range windows. For each window:
     - Count `\n` bytes in the window.
     - Add to running `lineCount`.
     - On the last window, subtract 1 for the header row.
     - Every 5 windows (500 MB processed) or when elapsed time > 10 min: `UPDATE etl_jobs SET verified_row_count_partial = $lineCount` (checkpoint), then throw a typed `ReconcileResumeError` carrying the current byte offset so the queue retry re-enqueues with `resumeFromByte` advanced. Wall-clock budget reset.
  4. On EOF: `UPDATE etl_jobs SET verified_at = now(), verified_row_count = $lineCount, verified_row_count_partial = NULL WHERE id = $1 AND verified_at IS NULL` (idempotency gate).
  5. Compute `delta = lineCount - total_processed`. If `abs(delta) > max(10, ceil(0.01 * lineCount))`: `Sentry.captureMessage('etl.reconciliation.delta', { level: 'warning', tags: { jobId }, extra: { delta, expected: lineCount, actual: total_processed } })`.
  6. Return `{ jobId, expectedRowCount: lineCount, actualRowCount: total_processed, delta, withinThreshold }`.
- `processReconcileBatch` (queue consumer):
  - For each message: try `reconcileJob(msg.jobId, msg.resumeFromByte)` → on success `ack()`. On `ReconcileResumeError`: enqueue a new message with the advanced offset and `ack()` the current one. On any other error: `retry({ delaySeconds: 60 })`.
- Auto-trigger: in U2's completion transaction, after the status flip to `completed`, enqueue `{ jobId, resumeFromByte: 0 }` to `packrat-etl-reconcile-queue`. Because both writes are in the same transaction, a row can never be `completed` without an enqueued reconcile.
- Manual endpoint (`POST /admin/etl/:jobId/reconcile`):
  - For files where `fileSize < 200 MB`: call `reconcileJob` synchronously and return the result inline.
  - For files ≥ 200 MB: enqueue to `packrat-etl-reconcile-queue` and return 202 with a "poll the job for `verified_at`" message.
  - Optional `?force=true` query: clear `verified_at` first and re-enqueue (operator override for a re-verify).
- CLI subcommand: `packrat-admin etl reconcile <jobId>` → wraps the endpoint, polls until `verifiedAt` is set or timeout.
- The 7 historical jobs from 2026-05-14 can each be reconciled retroactively via this endpoint *before* deciding to repair (U6). Confirms the suspicion that they processed partial data before being swept.

**Patterns to follow:**
- Queue consumer pattern from U3 (per-message ack/retry, DLQ wired).
- Streaming-count pattern: `for await (const chunk of body)` and accumulate `chunk.filter(byte => byte === 0x0A).length`.

**Test scenarios:**
- Happy path: Job with `total_processed = 100`, R2 file has 101 lines (100 rows + header) → delta = 0; `verified_at` set; no Sentry warning.
- Happy path: Job with `total_processed = 1000`, R2 file has 1006 lines (1005 rows + header) → delta = 5; within threshold; no warning.
- Edge case: Job with `total_processed = 50000`, R2 file has 50100 lines + header → delta = 100; threshold = `max(10, 500)` = 500; within threshold; no warning. (The 50,100 case stays informational.)
- Edge case (the real case): Job with `total_processed = 400`, R2 file has 50101 lines (50100 rows + header) — what the `campmor`-shape failures looked like → delta = 49700; way over threshold; Sentry warning fires.
- Edge case (resume): A 1.5 GB file forces three resume-error checkpoints; each resume picks up at the right byte offset; final `verified_row_count` matches the true row count.
- Edge case (idempotency): A redelivered reconcile message with `resumeFromByte = 0` against a job that already has `verified_at` set — `reconcileJob` returns early without re-reading the file.
- Error path: R2 object missing → `reconcileJob` throws a typed error; queue consumer retries with backoff; after exhausting `max_retries: 3`, the DLQ captures it.
- Edge case: Job with `total_processed = NULL` (legacy stuck-job-sweep casualty) → reconcileJob computes delta as `expected - 0 = expected`; the warning carries useful context for diagnosing the historical job.
- Integration: Auto-verify fires exactly once per job, enqueued atomically with the completion transition; it does not fire for intermediate chunk completions; it does not fire twice on a redelivered final chunk (idempotency comes from the `etl_job_chunks` gate in U2).

**Verification:**
- New test passes.
- Calling the endpoint on a real dev-seeded job returns the documented shape (inline for small files, 202 + queued for large).
- The chunk-completion transaction either commits both the status flip and the reconcile enqueue, or neither (verify with a forced enqueue failure mid-transaction).

---

### U11. Quality-of-life: scheduler.wait, BATCH_SIZE rename, mergeBySku log aggregation

**Goal:** Three tiny correctness/cleanliness wins that share a maintenance flavor and ship together.

**Requirements:** R9 (log volume), and audit P2 #5, P2 #6, P3 #1

**Dependencies:** U8 (for the logger surface used by the aggregated merge summary)

**Files:**
- Modify: `packages/api/src/services/etl/processCatalogEtl.ts:120` (replace `setTimeout(resolve, 1)` with `await scheduler.wait(0)`)
- Create: `packages/api/src/services/etl/constants.ts` (new — exports `ITEM_FLUSH_BATCH_SIZE = 100` and `CF_QUEUE_BATCH_SIZE = 100`)
- Modify: `packages/api/src/services/etl/processCatalogEtl.ts:13` and `packages/api/src/services/etl/queue.ts:17` (import from the new constants module instead of declaring inline)
- Modify: `packages/api/src/services/etl/mergeItemsBySku.ts:34-48` (replace per-SKU `console.log` with a per-batch summary `logger.info('etl.merge.summary', { jobId, mergedSkuCount, totalChangedFields })`)
- Test: `packages/api/test/etl-yield-and-constants.test.ts` (new — minimal; mostly behavior-preservation)

**Approach:**
- `await scheduler.wait(0)` is the documented Workers Scheduler API. `scheduler.yield()` does not exist (corrected from audit P2 #5).
- The constants module is dead-simple — two exports — but the rename surfaces intent at the call site and ends the ambiguity the audit flagged at P2 #6.
- The mergeBySku aggregation accumulates change counts across one batch (already a natural unit) and logs once at the end. No per-SKU lines.

**Patterns to follow:**
- Module organization mirrors `packages/api/src/services/etl/types.ts` for a constants file.

**Test scenarios:**
- Behavior preservation: A 10,000-row chunk completes at least as fast as before with `scheduler.wait(0)` (regression check, not a strict assertion).
- Happy path (merge log): A batch with 50 SKU merges → exactly one log line emitted, summarizing the batch.
- Edge case: A batch with 0 merges → no log line.

**Verification:**
- `grep -rn "setTimeout\(.*1.*\)" packages/api/src/services/etl/` returns nothing.
- `grep -rn "BATCH_SIZE\s*=" packages/api/src/services/etl/` returns only the new constants.
- A real ETL run on dev with 1k duplicate SKUs produces 1 merge summary line, not 1000.

---

### U12. Validator hardening: URL scheme + length caps + SKU charset

**Goal:** Eliminate the audit P3 #2 attack surface — `javascript:` URLs and oversize fields cannot enter the catalog.

**Requirements:** R11

**Dependencies:** None (independent; can land any time after Phase 1)

**Files:**
- Modify: `packages/api/src/services/etl/CatalogItemValidator.ts` (rewrite `isValidUrl` at `:60-67`; add length caps and SKU regex)
- Test: `packages/api/test/etl-validator.test.ts` (new or extend existing)

**Approach:**
- `isValidUrl`: parse with `new URL()`; reject any scheme other than `http:` and `https:`. Reject URLs longer than 2048 chars.
- Length caps (rejects, not truncates): `name ≤ 500`, `description ≤ 50000`, `brand ≤ 200`, `category ≤ 200`.
- SKU regex: `/^[A-Za-z0-9_.\-\/]+$/`; max length 200.
- Each rejection produces a structured invalid-item log entry with the specific reason — surfaces in the existing `/admin/etl/:jobId/failures` endpoint.

**Patterns to follow:**
- Existing validator structure at `packages/api/src/services/etl/CatalogItemValidator.ts`.
- Invalid-log shape at `packages/api/src/services/etl/processLogsBatch.ts`.

**Test scenarios:**
- Happy path: Valid `https://example.com/product/123` URL accepted.
- Error path: `javascript:alert(1)` URL rejected with reason `INVALID_URL_SCHEME`.
- Error path: `mailto:foo@bar` rejected with `INVALID_URL_SCHEME`.
- Error path: URL of 3000 chars rejected with `URL_TOO_LONG`.
- Edge case: Name of exactly 500 chars accepted; 501 chars rejected.
- Edge case: SKU `ABC-123_/test.sku` accepted; SKU `<script>` rejected with `INVALID_SKU_CHARS`.
- Integration: Run the existing `etl.test.ts` fixture with a row containing a `javascript:` URL → row routed to invalid logs, no DB insert into `catalog_items`.

**Verification:**
- New test passes.
- A real prod-shape CSV with an injected `javascript:` URL run through `bun test:api` shows the row rejected.

---

### U13. Retention policy: `invalid_item_logs` cron sweep

**Goal:** Bounded growth of the `invalid_item_logs` table. Bad uploads cannot fill Neon storage indefinitely.

**Requirements:** R12

**Dependencies:** U5 (for the existing `scheduled()` handler; the retention sweep adds a second cron arm)

**Files:**
- Create: `packages/api/src/services/etl/invalidLogRetention.ts` (the sweep function)
- Modify: `packages/api/src/index.ts` (extend the `scheduled()` handler to dispatch on cron name; add the retention sweep arm)
- Modify: `packages/api/wrangler.jsonc` (add a daily cron trigger, e.g., `0 9 * * *` UTC)
- Test: `packages/api/test/etl-log-retention.test.ts` (new)

**Approach:**
- Sweep: `DELETE FROM invalid_item_logs WHERE created_at < now() - interval '90 days'`. Returns the deleted count; emits a Sentry breadcrumb.
- Cron config in `wrangler.jsonc`: `"triggers": { "crons": ["*/5 * * * *", "0 9 * * *"] }` (sweep + retention). The top-level `triggers` wrapper is required by the Wrangler schema — a bare top-level `crons` key is silently ignored. The `scheduled` handler in `packages/api/src/index.ts` dispatches on the `event.cron` string.
- 90-day window is a default; configurable via `env.INVALID_LOG_RETENTION_DAYS` if needed.

**Patterns to follow:**
- The stuck-job sweep cron from U5 establishes the `scheduled()` handler pattern.

**Test scenarios:**
- Happy path: Insert logs at `now() - 100d` and `now() - 30d`; sweep deletes only the 100d one.
- Edge case: Empty table → sweep deletes 0 rows; no error.
- Edge case: `INVALID_LOG_RETENTION_DAYS=30` env override → 30d-old logs swept.

**Verification:**
- New test passes.
- `wrangler dev --test-scheduled` exercises both cron arms.

---

### U14. Test gap backfill: cross-cutting tests the global mock currently hides

**Goal:** Add the specific tests that the per-unit tests above couldn't cover because of `packages/api/test/setup.ts:544-551`'s global queue mock — plus a few cross-cutting integration scenarios.

**Requirements:** R14

**Dependencies:** U2, U3, U6, U7 (all of which introduce behavior that should be covered end-to-end)

**Files:**
- Create: `packages/api/test/etl-queue-direct.test.ts` (per-file unmock of `queueCatalogETL` and `processQueueBatch`; exercise the real consumer)
- Create: `packages/api/test/etl-multi-chunk-integration.test.ts` (full producer→queue→consumer→DB flow for a 3-chunk job)
- Create: `packages/api/test/etl-csv-edge-cases.test.ts` (BOM at start, quoted header with embedded commas, header with 30+ columns straddling the 4KB initial slice, row-spanning-chunk fixture)
- Modify: `packages/api/test/setup.ts` (if needed, document the `vi.doUnmock` escape hatch in a comment so future tests don't fight the global mock blindly)

**Approach:**
- Each new test file declares `vi.doUnmock('@packrat/api/services/etl/queue')` in `beforeAll` so the real implementation is exercised.
- Fixtures live in `packages/api/test/fixtures/etl/`:
  - `small-1chunk.csv` — 100 rows, ~10 KB
  - `medium-3chunk.csv` — ~50 MB synthetic, designed to split into 3 byte-range chunks with row-boundary alignment work
  - `wide-header.csv` — header row of 6 KB (forces the 4K→16K expansion path)
  - `bom-prefixed.csv` — starts with `0xEF 0xBB 0xBF`
  - `quoted-header.csv` — header has `"Item,Name","Description"` quoting
- Tests assert behaviors that map directly to audit findings:
  - Multi-chunk completion (P0 #1): full producer→consumer for a 3-chunk file ends with one `completed` transition.
  - Queue retry (P0 #2): forced R2 5xx on first attempt → retry → success on second.
  - Header > 4KB (P1 #3): consumer succeeds; columns mapped correctly.
  - Row-spanning (P1 #4 / P1 #5): no rows dropped, no rows duplicated, no rows invalidated.
  - BOM and quoted headers: parsed correctly.
- Concurrent updates (audit also flagged this): a test that fires two simultaneous `updateEtlJobProgress` calls for the same `jobId` from different mocked workers; asserts atomic counter increment via the existing `COALESCE` idiom.

**Patterns to follow:**
- Existing `packages/api/test/etl.test.ts` for mocking + Postgres setup.
- Per-test mock control via `vi.mocked(...).mockImplementationOnce(...)`.

**Test scenarios:**
- (Each described above as a fixture-driven scenario.)

**Verification:**
- `bun test:api` passes.
- `grep -rn "vi.doUnmock" packages/api/test/etl-*.test.ts` shows the un-mock is applied where needed.
- Coverage delta is positive on `packages/api/src/services/etl/queue.ts` and `packages/api/src/services/etl/processCatalogEtl.ts`.

---

### U15. Runbook at `docs/runbooks/etl-pipeline.md`

**Goal:** A new on-caller can trigger / inspect / retry / drain / reconcile / recover without reading source.

**Requirements:** R13

**Dependencies:** U3, U5, U6, U10 (all of which create the operator-facing endpoints the runbook documents)

**Files:**
- Create: `docs/runbooks/etl-pipeline.md`

**Approach:**
- Sections in the runbook:
  1. **Architecture** — one diagram showing producer → queue → consumer → DLQ, plus the cron jobs (sweep + retention).
  2. **How to trigger an ETL** — `curl POST /catalog/etl` with payload schema; CLI command equivalent.
  3. **How to inspect queue depth** — `wrangler queues list` and `wrangler queues info packrat-etl-queue`; same for `packrat-etl-dlq`.
  4. **How to retry a failed job** — `curl POST /admin/etl/:jobId/retry`; CLI `packrat-admin etl retry <jobId>`.
  5. **How to repair a corrupted job** (the 7-job case) — `POST /admin/etl/:jobId/repair-from-scratch`; CLI `packrat-admin etl repair-from-scratch <jobId>`. Includes the explicit one-time procedure for the seven 2026-05-14 jobs (list the jobIds).
  6. **How to reconcile** — manual endpoint + automatic behavior; how to interpret the delta.
  7. **How to drain the queue** — `wrangler queues consumer remove`.
  8. **How to interpret `success_rate` and `verified_row_count`** — what 100%-failed means, what missing-but-present-in-source means.
  9. **DLQ forensics** — querying `etl_dlq_events`; replay procedure (re-enqueue via `repair-from-scratch`).
  10. **Accepted limitations** — soft-delete / discontinued-item reconciliation is not in scope; catalog grows monotonically; document the trade-off.
  11. **References** — link to the audit, this plan, the Cloudflare Queues docs, the Sentry project.

**Patterns to follow:**
- No existing runbook in `docs/runbooks/` (verified absent). This is the first; establishes the convention.

**Test scenarios:**
- *Test expectation: none — documentation only, no behavioral change.*

**Verification:**
- The runbook is comprehensive enough that a new on-caller can complete each documented procedure without reading source.
- Reviewer walks through every command in dev and confirms expected output.

---

## System-Wide Impact

- **Interaction graph:** Producer endpoint → `chunkCsvForR2` (U6/U7) → ETL queue → consumer (idempotency gate via `etl_job_chunks` then atomic completion UPDATE → enqueue reconcile message inside the same transaction) → DLQ on exhaust → DLQ consumer → `etl_dlq_events`. Reconcile queue (`packrat-etl-reconcile-queue`) → reconcile consumer (resumable byte-range streaming, checkpointed via `verified_row_count_partial`). Two new cron jobs (sweep + retention). Sweep also inserts sentinel `etl_dlq_events` so the forensic table is single-source-of-truth for every `failed` transition. Sentry now intercepts every entry point via `withSentry({ fetch, queue })`.
- **Error propagation:** Chunk-level exceptions now propagate from inner code → `processCatalogETL` outer catch → `processQueueBatch` per-message catch → `message.retry()` → exhaustion → DLQ → `etl_dlq_events` + Sentry. The `etl_jobs.status='failed'` transition happens only at the DLQ consumer or via the progress-based sweep. Nothing else writes `failed`.
- **State lifecycle risks:** The chunk-completion path is correct under at-least-once delivery because every increment is gated by `INSERT INTO etl_job_chunks … ON CONFLICT DO NOTHING RETURNING 1` — a redelivered chunk produces no row and skips the increment. The combined transaction (chunk-table INSERT + counter UPDATE + reconcile-message enqueue) ensures atomicity: a row can never transition to `completed` without an enqueued reconcile, and a chunk increment can never be applied without the corresponding chunk-table row. The CHECK constraint `chunks_completed <= chunks_total` is the loud-failure safety net if any code path ever bypasses the gate. Status flip-flop (sweep flips to `failed` while a chunk completes) is prevented by the `WHERE status = 'running'` clause on every status-mutating UPDATE. The U10 reconcile checkpoint via `verified_row_count_partial` enables resumable verification of files that exceed a single queue invocation.
- **API surface parity:** Three new admin endpoints (`/admin/etl/sweep-stuck`, `/admin/etl/:jobId/repair-from-scratch`, `/admin/etl/:jobId/reconcile`), one removed (`/admin/etl/reset-stuck`), one rewritten (`/admin/etl/:jobId/retry`). All three new endpoints get CLI subcommands in `packages/cli/src/commands/admin/etl.ts`. The producer endpoint at `POST /catalog/etl` is unchanged in shape (only the chunking internals change).
- **Integration coverage:** U14's `etl-multi-chunk-integration.test.ts` exercises the full pipeline end-to-end against the test Postgres. The global queue mock in `setup.ts:544-551` is explicitly un-mocked per-test where the real consumer matters.
- **Unchanged invariants:** The producer `POST /catalog/etl` request body shape; the `catalog_items` upsert behavior (still SKU-keyed); the OpenAPI client generated by `@elysiajs/openapi` for non-ETL routes; the admin auth surface (`adminAuthGuard` continues to gate every new admin route); the scraper-revision pinning. No mobile or web app code is touched.

---

## Risks & Dependencies

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **At-least-once chunk redelivery double-increments `chunks_completed`** before the per-chunk idempotency table exists | High (without mitigation) | High | U1 adds `etl_job_chunks(job_id, chunk_index)` PK table; U2 gates the increment on `INSERT … ON CONFLICT DO NOTHING RETURNING 1`. CHECK constraint `chunks_completed <= chunks_total` is the loud safety net |
| **Chunk-completion UPDATE clobbers a row the sweep already failed** (status flip-flop) | Med | High | All status-mutating UPDATEs gate on `WHERE status = 'running'`. The chunk consumer also runs the completion UPDATE inside a transaction with the idempotency INSERT |
| **U10 auto-reconcile via `ctx.waitUntil` exceeds 15-min wall-clock for multi-GB files** | High at >1 GB | High | Reconcile runs on its own `packrat-etl-reconcile-queue` with byte-range streaming + checkpointed resume via `verified_row_count_partial`. `waitUntil` is no longer used |
| **DLQ event INSERT succeeds, status UPDATE fails — two-phase ordering bug** | Low | Med | Both writes inside one `db.transaction()` in U3. Post-deploy verification query in the runbook (`SELECT job_id FROM etl_dlq_events WHERE job_id IN (SELECT id FROM etl_jobs WHERE status != 'failed')`) alerts on inconsistency |
| **`catalog_item_etl_jobs` accumulates duplicate provenance rows on chunk redelivery** | Med | Low | U1 adds `UNIQUE (catalog_item_id, etl_job_id)`; upserts use `ON CONFLICT DO NOTHING` |
| **`error_stack` in `etl_dlq_events` accidentally captures CSV row data** (PII risk if scrapers ever ingest user-generated text) | Low today | Med | Documented contract at the call site: error messages MUST NOT include raw row data. U14 test asserts this property |
| **Migration 0048 backfill blocks in-flight ETL writers during deploy** | Low (~200 rows) | Low | Single-migration approach is fine at current scale; UPDATE is sub-100ms on Neon. Comment in migration: "revisit if row count >100k" |
| **`repair-from-scratch` re-ingests a different file than the original** because R2 source was overwritten | Low | High | U6 endpoint compares stored `source_etag` against fresh `r2.head(key).etag`; returns 409 on mismatch unless `?force=true` |
| Drizzle Kit emits SQL without literal `DEFAULT 0 NOT NULL` (only JS-side default) breaking inserts from old workers mid-rolling-deploy | Med | High | U1 implementer hand-inspects the generated `.sql` before applying; assert via `information_schema.columns` in the schema smoke test |
| `@sentry/cloudflare` adds bundle size that pushes the API Worker over a CF size limit | Low | Med | Sentry SDK is ~30 KB gzipped per their docs; current Worker bundle is well under the 10 MB limit; verify with `wrangler deploy --dry-run` after U8 |
| The 7 historical jobs from 2026-05-14 cannot be repaired because their R2 source has been deleted by a separate retention policy | Low | Low | Verify R2 source presence as part of the U15 runbook procedure before invoking `repair-from-scratch`; if missing, document as accepted loss |
| `@sentry/cloudflare` + `nodejs_compat` interaction introduces a cold-start regression | Low | Med | Measure cold-start delta against a control deploy; if regression > 50 ms, evaluate toucan-js fallback |
| DLQ consumer fails (e.g., DB down when DLQ event arrives) | Low | Med | DLQ consumer is itself a queue consumer with `max_retries: 3` and its own DLQ semantics. Sentry capture happens before the DB write, so the event is preserved even if persistence fails. The U5 sweep is the bottom-floor safety net for any row that DLQ couldn't transition |
| Down-migration loses Phase-2+ data after this plan ships | Cert if attempted | High | Migration is **forward-only after U2 ships** (documented in U1's test scenarios and in the migration header comment). Rollback strategy is a forward-fix migration, not a structural revert |
| Wide-CSV fixture in U14 introduces a long-running test that destabilizes CI | Low | Low | Synthesize the fixture once at test-run startup with a deterministic seed instead of checking in a 50 MB file; cap fixture size at 5 MB in test mode via env |

---

## Documentation / Operational Notes

- The new runbook at `docs/runbooks/etl-pipeline.md` (U15) is the operator entry point; link from the README and the CLAUDE.md ETL section in a follow-up doc PR.
- Sentry project must be provisioned (or confirmed existing) before U8 lands. `env.SENTRY_DSN` is already validated in `packages/api/src/utils/env-validation.ts:9, 94` — verify the prod and dev env have it set via `wrangler secret list`.
- Rollout sequencing across phases is incremental: each phase's PR is independently deployable. After Phase 1 ships, observe one week of prod data to confirm no regression before merging Phase 2. After Phase 2 ships, exercise `repair-from-scratch` against the 7 historical jobs as the explicit operational validation.
- Source maps require `upload_source_maps: true` in `wrangler.jsonc` (U8). Pair with Sentry's CLI in CI for full symbolication; otherwise stack traces in Sentry will show minified line numbers.
- The CF Cron Trigger added in U5 is the first in this Worker. Verify it appears in `wrangler triggers` after deploy and fires on schedule (`wrangler tail --format=pretty` during the 5-minute window).
- The 7 historical-job recovery procedure (U15 §5) is a one-time operational task; record the run in the runbook's `## Historical Recoveries` appendix.

---

## Phased Delivery

### Phase 1 — Foundation + P0 Blockers (U1, U2, U3, U4)

Lands the schema migration plus the two production blockers and removes the broken wall-clock sweep. After this phase, multi-chunk jobs cannot prematurely complete, queue failures no longer silently swallow, and the wrongly-triggering sweep is gone. Independently deployable; no operational dependency on later phases. Ship as 1–2 PRs (migration + code, or both in one).

### Phase 2 — Chunking Correctness + Recovery (U5, U6, U7)

Replaces the sweep with a progress-based one; introduces the shared chunking helper with newline alignment; lands the retry + repair-from-scratch endpoints. After this phase, the 7 historical jobs from 2026-05-14 can be operationally recovered (run via the U15 runbook once Phase 4 ships, or earlier with a quick text note). Independently deployable. 2–3 PRs.

### Phase 3 — Observability + Reconciliation (U8, U9, U10, U11)

Wires Sentry, fixes the silent-error paths, adds reconciliation. After this phase, every job has a verified row count, every error reaches Sentry, and the smaller correctness issues (embedding fallback, IIFE error, scheduler.wait) are resolved. 2 PRs (Sentry + the rest).

### Phase 4 — Hardening + Documentation (U12, U13, U14, U15)

Validator hardening, log retention, the test gap backfill, and the runbook. After this phase, the test suite covers the previously-hidden surfaces and the on-call procedure is documented. 1–2 PRs.

---

## Documentation Plan

- `docs/runbooks/etl-pipeline.md` — created in U15.
- `CLAUDE.md` ETL section — minor update in a Phase 4 PR to link the runbook.
- Update the existing `docs/audits/2026-05-16-etl-audit.md` with a footer linking to this plan (so future readers know remediation is in progress / done).
- `/ce-compound` candidates after each phase:
  - Phase 1: "Cloudflare Queue DLQ + explicit ack/retry pattern in a CF Worker"
  - Phase 2: "Byte-range R2 chunking with newline alignment"
  - Phase 3: "Sentry on Cloudflare Workers via `@sentry/cloudflare` (queue + fetch)"
  - Phase 4: "ETL operational runbook structure"

---

## Operational / Rollout Notes

- Each phase's PR is gated on the previous phase having shipped to prod and observed for at least 24h. No monitoring regression → promote to next phase.
- The 7-job recovery (operational) happens after Phase 2 lands; document the jobIds and the run in the runbook's recoveries appendix.
- New env vars: `INVALID_LOG_RETENTION_DAYS` (optional, default 90). Add to `.env.example` in Phase 4.
- Wrangler secrets to verify: `SENTRY_DSN`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `PACKRAT_SCRAPY_BUCKET_R2_BUCKET_NAME`. None new, but confirm presence before Phase 3 deploy.
- Rollback: each PR is independently revertable. The migration in U1 has a generated down-migration; verify it cleanly drops the new columns + table without affecting existing data.

---

## Sources & References

- **Origin document:** `docs/audits/2026-05-16-etl-audit.md` (the ETL pipeline audit)
- Related code:
  - `packages/api/src/services/etl/`
  - `packages/api/src/routes/catalog/index.ts`
  - `packages/api/src/routes/admin/analytics/catalog.ts`
  - `packages/api/wrangler.jsonc`
  - `packages/db/src/schema.ts`
  - `packages/api/test/etl.test.ts`
  - `packages/cli/src/commands/admin/etl.ts`
- Live prod evidence: `GET https://packrat-api.orange-frost-d665.workers.dev/api/admin/analytics/catalog/etl?limit=25` (2026-05-19; surfaced 7 wrongly-`failed` jobs at `completedAt = 2026-05-14T16:24:04.470Z`; 192 runs / 74 failed = 38% failure rate; `totalItemsIngested: 304,431`)
- External docs:
  - <https://developers.cloudflare.com/queues/configuration/javascript-apis/>
  - <https://developers.cloudflare.com/queues/configuration/dead-letter-queues/>
  - <https://developers.cloudflare.com/queues/platform/limits/>
  - <https://developers.cloudflare.com/workers/runtime-apis/scheduler/>
  - <https://developers.cloudflare.com/workers/configuration/cron-triggers/>
  - <https://developers.cloudflare.com/r2/api/s3/api/>
  - <https://docs.sentry.io/platforms/javascript/guides/cloudflare/>
  - <https://docs.sentry.io/platforms/javascript/guides/cloudflare/tracing/instrumentation/queues-module/>
  - <https://github.com/drizzle-team/drizzle-orm/issues/3249>
