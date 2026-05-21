# Catalog ETL Pipeline — Runbook

Operational guide for the Cloudflare Workflows-based catalog ingest pipeline.
Audience: on-call engineers triaging ETL issues; scraper operators triggering
new runs; anyone debugging why the catalog isn't updating.

## Architecture at a glance

```
Scraper → R2 object (packrat-scrapy-bucket)
                    │
                    ▼
POST /api/catalog/etl  ── api-key auth
                    │
                    ▼
chunkCsvForR2  → newline-aligned ChunkSpec[]
                    │
                    ▼
INSERT etl_jobs (status='running', workflow_instance_id)
                    │
                    ▼
env.ETL_WORKFLOW.create(...)  ──► CatalogEtlWorkflow instance
                                            │
                              ┌─────────────┴─────────────┐
                              ▼                           ▼
                     step.do("chunk-N", ...) × N    (durable, memoized,
                              │                       per-step retry 3x
                              ▼                       exp backoff)
                     step.do("aggregate")
                              │
                              ▼
                     step.do("finalize")  → UPDATE etl_jobs
                                            SET status='completed'
```

Two backstops:
- **CF Cron Trigger** `0 9 * * *` runs the `scheduled` handler, which calls
  `sweepInvalidItemLogs` to DELETE `invalid_item_logs` rows older than 90
  days in 10k-row batches.
- The Workflows dashboard is the **forensic record** for any errored
  instance — no DLQ table is needed; the dashboard surfaces full step
  history with stack traces.

## What's the engine?

The producer endpoint accepts `?engine=workflow|queue`. Workflow is the
default. The queue path is kept during the coexistence window — operators
can opt back in via `?engine=queue` if the workflow path misbehaves in
production. Plan: delete the queue path one week after the workflow path
has been in steady-state production use.

## Triggering an ETL

```bash
# Via curl (admin API key in $PACKRAT_API_KEY)
curl -X POST 'https://packrat-api.orange-frost-d665.workers.dev/api/catalog/etl?engine=workflow' \
  -H "x-api-key: $PACKRAT_API_KEY" \
  -H 'content-type: application/json' \
  -d '{
        "filename": "cotopaxi_2026-05-14T16-54-05.csv",
        "chunks": ["v2/cotopaxi/cotopaxi_2026-05-14T16-54-05.csv"],
        "source": "cotopaxi",
        "scraperRevision": "abc123"
      }'
```

Response:
```json
{
  "message": "Catalog ETL workflow triggered",
  "jobId": "<uuid>",
  "engine": "workflow",
  "workflowInstanceId": "cotopaxi-cotopaxi_2026-05-14T16-54-05"
}
```

The deterministic `workflowInstanceId` (`${source}-${filenameWithoutExtension}`) means
duplicate triggers for the same file are rejected by the Workflows runtime
— safe to retry the curl on network failures.

Note: CF Workflows instance IDs only allow `[a-zA-Z0-9_-]` — the `.csv` extension is
stripped when building the ID.

## Inspecting a workflow instance

```bash
# List recent instances
bunx wrangler workflows instances list packrat-catalog-etl

# Describe one (replace <id> with workflowInstanceId or the UUID)
bunx wrangler workflows instances describe packrat-catalog-etl <id>
```

`describe` shows:
- Top-level status: `queued`, `running`, `paused`, `errored`, or `complete`
- Each `chunk-N` step's start/end timestamps + output value (rowsProcessed,
  rowsValid, rowsInvalid per chunk)
- `aggregate` step result (the canonical totals written to `etl_jobs`)
- `finalize` step result (status flip to `completed`)
- For errored instances: full retry history with stack traces per attempt

## Retrying a failed job

```bash
curl -X POST 'https://packrat-api.orange-frost-d665.workers.dev/api/admin/analytics/catalog/etl/<jobId>/retry' \
  -H "Authorization: Bearer $ADMIN_JWT"
```

The retry endpoint:
1. Looks up the original `etl_jobs` row (requires `status='failed'`)
2. Re-chunks the source via `chunkCsvForR2` (newline-aligned)
3. INSERTs a new `etl_jobs` row with a fresh `jobId` and a new
   `workflowInstanceId` suffixed `-retry-<newJobId>` so duplicate retries
   don't collide
4. Calls `env.ETL_WORKFLOW.create(...)` with the chunks

Response:
```json
{
  "success": true,
  "newJobId": "<uuid>",
  "objectKey": "v2/cotopaxi/cotopaxi_2026-05-14T16-54-05.csv",
  "workflowInstanceId": "retry-<newJobId>"
}
```

Original job's `etl_jobs` row is left untouched (still `failed`); the new
row reflects the retry. The new row's `superseded_by_job_id` is set to the
original `jobId` (with `superseded_at = now()`) so the supersession chain
is explicit — no manual correlation by `(source, filename)` and timestamp
is required. Use `GET /admin/analytics/catalog/etl/:jobId` to see the full
chain for any job.

## Reconciling a job's row count

After an ingest completes, you can compare the R2 source's logical row
count against `etl_jobs.total_processed`:

```bash
curl -X POST 'https://packrat-api.orange-frost-d665.workers.dev/api/admin/analytics/catalog/etl/<jobId>/reconcile' \
  -H "Authorization: Bearer $ADMIN_JWT"
```

The endpoint reads the entire R2 source, parses it with `csv-parse` (which
correctly handles quoted multi-line fields, unlike raw `\n` counting), and
writes the result to `etl_jobs.verified_row_count` + `etl_jobs.verified_at`.

Response:
```json
{
  "success": true,
  "jobId": "<uuid>",
  "expectedRowCount": 50100,
  "actualRowCount": 50100,
  "delta": 0
}
```

A non-zero `delta` indicates data drift — either the source was modified
since ingest, or the workflow dropped rows. Investigate before re-ingesting.

For very large source files (>200 MB) this endpoint may exceed the fetch
budget. Async-via-workflow is a documented follow-up.

## The 7-job historical recovery procedure

Seven jobs from 2026-05-14 were falsely marked `failed` by the old
wall-clock-based stuck-job sweep. After this PR ships and is deployed:

```sql
-- List the affected jobs
SELECT id, source, filename, total_processed, started_at, completed_at
FROM etl_jobs
WHERE status = 'failed'
  AND completed_at = '2026-05-14T16:24:04.470Z';
```

For each `jobId` returned:

```bash
curl -X POST "https://packrat-api.orange-frost-d665.workers.dev/api/admin/analytics/catalog/etl/${jobId}/retry" \
  -H "Authorization: Bearer $ADMIN_JWT"
```

Workflow instances will appear in the dashboard with names like
`evo-evo_2026-04-27T03-25-18.csv-retry-<newJobId>`. Watch each to
completion. Original `etl_jobs` rows stay `failed` for the audit trail;
new rows reflect the successful re-ingest.

If a source file has been overwritten since 2026-05-14, the retry will
re-ingest the **current** content under the old `(source, filename)` —
not the original. This is acceptable for the 7-job recovery (we want the
latest catalog state) but operators should verify R2 contents before
retrying if they're worried about historical accuracy. ETag-based
fail-closed verification is a follow-up PR.

## DLQ / forensic record

There is no DLQ table. The CF Workflows dashboard is the forensic record:

```bash
# Errored instances
bunx wrangler workflows instances list packrat-catalog-etl \
  --status=errored
```

For each errored instance, `describe` shows the failed step, the
exception message, and the retry attempt history. Workflows instance
retention is per the CF account settings (default unlimited on paid
plan).

For DB-side history: the `etl_jobs` table retains all rows indefinitely.
A failed `etl_jobs` row is the durable record that operators see in the
admin UI; the linked workflow instance is the executable log behind it.

## Invalid item logs retention

`invalid_item_logs` is swept daily at 09:00 UTC by the `scheduled`
handler in `packages/api/src/index.ts`. Default retention is 90 days.
The sweep loops in 10k-row batches and caps at 100 iterations (1M rows
per run). If the cap is hit, the next run picks up the remainder.

To override defaults, edit `packages/api/src/services/retention/invalidLogRetention.ts`
constants (no env-var override yet).

To manually trigger a retention sweep (dev only):

```bash
bunx wrangler dev --test-scheduled
# In another terminal:
curl 'http://localhost:8787/__scheduled?cron=0+9+*+*+*'
```

## Draining / disabling the queue path

After the workflow path bakes in production and the queue path is
scheduled for removal:

```bash
# Check that no consumers are reading from the old queue
bunx wrangler queues info packrat-etl-queue

# Remove the consumer binding — NOTE: this does NOT drain messages already
# sitting in the queue. Wait for the queue depth to reach 0 (visible in the
# Cloudflare dashboard) before removing the consumer, or messages will be
# lost. Only then is it safe to remove:
bunx wrangler queues consumer remove packrat-etl-queue packrat-api
```

Then the queue path removal PR (follow-up to this work) deletes:
- `packages/api/src/services/etl/queue.ts`
- `packages/api/src/services/etl/processCatalogEtl.ts`
- The `?engine=queue` branch in `packages/api/src/routes/catalog/index.ts`
- The `packrat-etl-queue` producer + consumer entries in `wrangler.jsonc`
- The legacy `processQueueBatch` arm in the `queue()` handler at
  `packages/api/src/index.ts`
- The `POST /admin/etl/reset-stuck` endpoint (the wall-clock sweep that
  caused the 7-job false-failure incident; no longer needed with
  Workflows owning instance lifecycle)

## Interpreting admin dashboard fields

`admin.packratai.com`'s catalog ETL page reads from `etl_jobs`. Field
meanings under the Workflows architecture:

| Field | Meaning |
|---|---|
| `status` | Mirrors the workflow's terminal state. `completed` = `finalize` step succeeded. `failed` = workflow errored (all retries exhausted). `running` = workflow still active. |
| `total_processed`, `total_valid`, `total_invalid` | Written by the workflow's `aggregate` step. These are authoritative for the workflow run — any drift from per-row counts during processing is overridden by the aggregate write. |
| `workflow_instance_id` | NULL for legacy queue-path rows; set for workflow-path rows. Use this to find the instance in the CF dashboard. |
| `total_embedding_failures` | Number of SKUs upserted without embeddings because `generateManyEmbeddings` threw. Non-zero indicates degradation. The catalog items themselves are present; embeddings backfill happens via the existing `/admin/embeddings` workflow. |
| `verified_at`, `verified_row_count` | NULL until an operator runs the reconcile endpoint. When set, `verified_row_count` is the R2 source's logical CSV row count; compare to `total_processed` to detect drift. |
| `success_rate` (computed) | Existing field — `total_valid / total_processed`. Note that a job with `status='failed'` can still show 100% if all processed rows were valid before the failure; the field is per-row, not per-job. |

## Accepted limitations

- **No soft-delete / discontinued-item reconciliation.** When a catalog
  item disappears from the source CSV, its row in `catalog_items` keeps
  the last `availability` value. The catalog grows monotonically.
  Reconciliation strategy not in scope; documented in audit P3 #3.
- **`success_rate` on a `failed` job can read 100%.** Dashboard quirk —
  the field is per-row, not per-job. A job that processed 400 rows
  successfully then errored on chunk 5 shows `success_rate: 100`
  because the 400 were all valid. The fix is documenting this above and
  in the admin UI tooltip (admin app PR).
- **Reconcile endpoint is synchronous.** Very large source files
  (>200 MB) may exceed the fetch budget. Async-via-workflow path is a
  documented follow-up.
- **ETag fail-closed on repair-from-scratch (not plain retry).** The
  `repair-from-scratch` endpoint compares the stored `source_etag` against
  `r2.head().etag` and returns 409 on mismatch; pass `?force=true` to
  override. The plain `retry` endpoint does not enforce ETag checks — if the
  R2 source has been overwritten, retry re-ingests the new content. Use
  repair-from-scratch when historical accuracy matters.
- **Embedding failures still cost API calls on retry.** Workflows
  memoizes step results, so a successful chunk step doesn't re-fire its
  embedding call on a downstream failure. But a chunk that fails AT the
  embedding call (and is then retried) calls the embedding API again.
  Bounded by the per-step retry limit (3); cost is bounded.

## Historical recoveries appendix

Document each one-off recovery here for the audit trail.

### 2026-05-14 false-failures (planned, post-merge)

7 jobs from 2026-05-14T16:24:04.470Z were marked failed by the old
wall-clock sweep mid-flight. Job IDs and recovery procedure documented
above. To be executed after this PR deploys to production.

## Sentry observability

`@sentry/cloudflare` wraps the worker default export via `withSentry()` and
the `CatalogEtlWorkflow` class via `instrumentWorkflowWithSentry()` —
configured in `packages/api/src/index.ts`. Initialization uses
`env.SENTRY_DSN`, `env.ENVIRONMENT`, and `env.CF_VERSION_METADATA.id`
(release tag) with a 10% trace sample rate.

The structured logger (`packages/api/src/utils/logger.ts`) forwards:
- `logger.info(event, ctx)` → `Sentry.addBreadcrumb(level=info)`
- `logger.warn(event, ctx)` → `Sentry.addBreadcrumb(level=warning)`
- `logger.error(event, { err })` → `Sentry.captureException(err)` with `event` + ctx fields as tags
- `logger.error(event)` without err → `Sentry.captureMessage(event, level=error)`

ctx fields become Sentry tags (strings/numbers/booleans) or extras (objects).

Source maps:
- `upload_source_maps: true` in `wrangler.jsonc` uploads sourcemaps to
  Cloudflare on every `wrangler deploy` — unminified stack traces in
  `wrangler tail` and the Workers dashboard
- For Sentry-side symbolication (unminified frames in the Sentry UI),
  run `bunx @sentry/cli sourcemaps upload --release=$(git rev-parse HEAD) packages/api/dist`
  after deploy. Not wired into CI because there's no automated deploy
  pipeline today; run manually post-deploy until that changes.

## References

- [Audit (2026-05-16)](../audits/2026-05-16-etl-audit.md) — the source-of-truth list of pre-migration issues
- [Active plan](../plans/2026-05-20-001-fix-etl-pipeline-workflows-migration-plan.md) — the Workflows migration plan
- [Superseded plan](../plans/2026-05-19-001-fix-etl-pipeline-audit-remediation-plan.md) — the original Queues + outbox attempt (why we pivoted)
- [Cloudflare Workflows docs](https://developers.cloudflare.com/workflows/)
- [Cloudflare Workflows JS API](https://developers.cloudflare.com/workflows/build/workers-api/)
- [Sentry on Cloudflare Workers](https://docs.sentry.io/platforms/javascript/guides/cloudflare/)
