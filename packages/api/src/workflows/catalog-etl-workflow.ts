// Catalog ETL — runs as a Cloudflare Workflow.
//
// Replaces the Queues-based pipeline at packages/api/src/services/etl/queue.ts
// + processCatalogEtl.ts. Workflows' durable step execution gives:
//   - Per-step memoization (a successful step is never re-executed on retry)
//   - Per-step retry policy (transient R2/DB/embedding failures retry with
//     exponential backoff; persistent failures route the instance to errored)
//   - Durable state between steps (no etl_job_chunks idempotency table needed)
//   - Instance status as the source of truth for stuck-job detection (no
//     wall-clock sweep cron needed)
//
// Counters on etl_jobs are written from the chunk steps (via existing
// processValidItemsBatch / processLogsBatch which call updateEtlJobProgress).
// On a step retry the underlying SKU upsert is idempotent (UNIQUE on
// catalog_item_etl_jobs); embedding API calls and invalid_item_log inserts
// can duplicate on retry — accepted trade-off for the simpler control flow.
// The final aggregate step writes the authoritative totals from the
// memoized step results.

import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { createDbClient } from '@packrat/api/db';
import { CatalogItemValidator } from '@packrat/api/services/etl/CatalogItemValidator';
import { BATCH_SIZE } from '@packrat/api/services/etl/processCatalogEtl';
import { processLogsBatch } from '@packrat/api/services/etl/processLogsBatch';
import { processValidItemsBatch } from '@packrat/api/services/etl/processValidItemsBatch';
import { R2BucketService } from '@packrat/api/services/r2-bucket';
import { mapCsvRowToItem } from '@packrat/api/utils/csv-utils';
import type { Env } from '@packrat/api/utils/env-validation';
import { setWorkerEnv } from '@packrat/api/utils/env-validation';
import { etlJobs, type NewCatalogItem, type NewInvalidItemLog } from '@packrat/db';
import { parse } from 'csv-parse';
import { eq } from 'drizzle-orm';
import type { ChunkSpec } from './shared/chunkCsvForR2';

export type CatalogEtlWorkflowParams = {
  jobId: string;
  source: string;
  scraperRevision: string;
  chunks: ChunkSpec[];
};

export type ChunkResult = {
  chunkIndex: number;
  rowsProcessed: number;
  rowsValid: number;
  rowsInvalid: number;
};

const HEADER_PEEK_SIZES = [4 * 1024, 16 * 1024, 64 * 1024];

export class EtlHeaderError extends Error {
  constructor(objectKey: string) {
    super(`No newline found in the first 64 KiB of ${objectKey} — malformed CSV header.`);
    this.name = 'EtlHeaderError';
  }
}

async function* streamToText(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

async function fetchHeaderRow(r2: R2BucketService, objectKey: string): Promise<string> {
  for (const length of HEADER_PEEK_SIZES) {
    const obj = await r2.get(objectKey, { range: { offset: 0, length } });
    if (!obj) throw new Error(`R2 header read returned null for ${objectKey}`);
    const text = await obj.text();
    const newlineIndex = text.indexOf('\n');
    if (newlineIndex !== -1) {
      return text.slice(0, newlineIndex);
    }
  }
  throw new EtlHeaderError(objectKey);
}

export async function processChunk({
  jobId,
  chunk,
  env,
}: {
  jobId: string;
  chunk: ChunkSpec;
  env: Env;
}): Promise<ChunkResult> {
  const r2 = new R2BucketService({ env, bucketType: 'catalog' });

  const isNonFirstChunk = chunk.chunkIndex > 0;
  const injectedHeader = isNonFirstChunk ? await fetchHeaderRow(r2, chunk.objectKey) : '';

  const length = chunk.byteEnd - chunk.byteStart + 1;
  const obj = await r2.get(chunk.objectKey, {
    range: { offset: chunk.byteStart, length },
  });
  if (!obj) throw new Error(`R2 chunk read returned null for ${chunk.objectKey}`);

  const validItemsBatch: Partial<NewCatalogItem>[] = [];
  const invalidItemsBatch: NewInvalidItemLog[] = [];
  const validator = new CatalogItemValidator();

  const parser = parse({
    relax_column_count: true,
    skip_empty_lines: true,
  });

  const writerPromise = (async () => {
    if (injectedHeader) {
      parser.write(`${injectedHeader}\n`);
    }
    for await (const text of streamToText(obj.body)) {
      const ok = parser.write(text);
      if (!ok) {
        await new Promise<void>((resolve) => parser.once('drain', resolve));
      }
    }
    parser.end();
  })().catch((err) => {
    parser.destroy(err instanceof Error ? err : new Error(String(err)));
    throw err;
  });

  let rowIndex = 0;
  let rowsValid = 0;
  let rowsInvalid = 0;
  let fieldMap: Record<string, number> = {};
  let isHeaderProcessed = false;

  for await (const record of parser) {
    if (rowIndex % 100 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const row = record as string[];

    if (!isHeaderProcessed) {
      fieldMap = {};
      for (const [idx, header] of row.entries()) {
        fieldMap[header.trim()] = idx;
      }
      isHeaderProcessed = true;
      continue;
    }

    const item = mapCsvRowToItem({ values: row, fieldMap });
    if (item) {
      const validated = validator.validateItem(item);
      if (validated.isValid) {
        validItemsBatch.push(validated.item);
      } else {
        invalidItemsBatch.push({
          jobId,
          errors: validated.errors,
          rawData: validated.item,
          rowIndex,
        });
      }
    }

    rowIndex++;

    if (validItemsBatch.length >= BATCH_SIZE) {
      await processValidItemsBatch({ jobId, items: [...validItemsBatch], env });
      rowsValid += validItemsBatch.length;
      validItemsBatch.length = 0;
    }
    if (invalidItemsBatch.length >= BATCH_SIZE) {
      await processLogsBatch({ jobId, logs: [...invalidItemsBatch], env });
      rowsInvalid += invalidItemsBatch.length;
      invalidItemsBatch.length = 0;
    }
  }

  await writerPromise;

  if (validItemsBatch.length > 0) {
    await processValidItemsBatch({ jobId, items: validItemsBatch, env });
    rowsValid += validItemsBatch.length;
  }
  if (invalidItemsBatch.length > 0) {
    await processLogsBatch({ jobId, logs: invalidItemsBatch, env });
    rowsInvalid += invalidItemsBatch.length;
  }

  return {
    chunkIndex: chunk.chunkIndex,
    rowsProcessed: rowIndex,
    rowsValid,
    rowsInvalid,
  };
}

async function reconcileSourceRowCount({
  objectKey,
  env,
}: {
  objectKey: string;
  env: Env;
}): Promise<number> {
  const r2 = new R2BucketService({ env, bucketType: 'catalog' });
  const obj = await r2.get(objectKey);
  if (!obj) throw new Error(`R2 reconcile read returned null for ${objectKey}`);

  const parser = parse({ relax_column_count: true, skip_empty_lines: true });
  let totalRows = 0;
  let isHeaderProcessed = false;

  const writerPromise = (async () => {
    for await (const text of streamToText(obj.body)) {
      const ok = parser.write(text);
      if (!ok) {
        await new Promise<void>((resolve) => parser.once('drain', resolve));
      }
    }
    parser.end();
  })().catch((err) => {
    parser.destroy(err instanceof Error ? err : new Error(String(err)));
    throw err;
  });

  for await (const _record of parser) {
    if (!isHeaderProcessed) {
      isHeaderProcessed = true;
      continue;
    }
    totalRows++;
  }

  await writerPromise;
  return totalRows;
}

export class CatalogEtlWorkflow extends WorkflowEntrypoint<Env, CatalogEtlWorkflowParams> {
  async run(
    event: Readonly<WorkflowEvent<CatalogEtlWorkflowParams>>,
    step: WorkflowStep,
  ): Promise<{ jobId: string; rowsProcessed: number; rowsValid: number; rowsInvalid: number }> {
    setWorkerEnv(this.env as unknown as Record<string, unknown>); // safe-cast: same shape as fetch handler
    const { jobId, chunks } = event.payload;

    // One step per chunk. Each step is memoized by name within the instance,
    // so a chunk that succeeds is never re-run on a downstream step failure.
    // Retries are bounded to 3 with exponential backoff for transient R2/DB
    // failures; a chunk that exhausts retries marks the entire instance errored.
    const chunkResults: ChunkResult[] = [];
    for (const chunk of chunks) {
      const result = await step.do(
        `chunk-${chunk.chunkIndex}`,
        {
          retries: { limit: 3, delay: '30 seconds', backoff: 'exponential' },
          timeout: '5 minutes',
        },
        async () => processChunk({ jobId, chunk, env: this.env }),
      );
      chunkResults.push(result);
    }

    const totals = chunkResults.reduce(
      (acc, r) => ({
        rowsProcessed: acc.rowsProcessed + r.rowsProcessed,
        rowsValid: acc.rowsValid + r.rowsValid,
        rowsInvalid: acc.rowsInvalid + r.rowsInvalid,
      }),
      { rowsProcessed: 0, rowsValid: 0, rowsInvalid: 0 },
    );

    // Aggregate step writes the canonical totals — any over-counts from chunk
    // retries (the inner processValidItemsBatch increments are non-idempotent
    // on retry) get overridden here. This is the authoritative count.
    await step.do('aggregate', async () => {
      const db = createDbClient(this.env);
      await db
        .update(etlJobs)
        .set({
          totalProcessed: totals.rowsProcessed,
          totalValid: totals.rowsValid,
          totalInvalid: totals.rowsInvalid,
        })
        .where(eq(etlJobs.id, jobId));
    });

    // Reconciliation — count R2 source rows with csv-parse (NOT raw \n
    // counting; quoted multi-line fields would skew that) and compare to the
    // aggregated total. Mismatches beyond the threshold surface as a warning
    // (sentry wiring lands in U6); for now the value is persisted so admin
    // queries can display it.
    const firstChunk = chunks[0];
    if (!firstChunk) {
      throw new Error(`Workflow ${jobId} received empty chunks array`);
    }
    const reconcileCount = await step.do(
      'reconcile',
      { retries: { limit: 2, delay: '30 seconds', backoff: 'exponential' } },
      async () => reconcileSourceRowCount({ objectKey: firstChunk.objectKey, env: this.env }),
    );

    await step.do('reconcile-write', async () => {
      const db = createDbClient(this.env);
      await db
        .update(etlJobs)
        .set({
          verifiedAt: new Date(),
          verifiedRowCount: reconcileCount,
        })
        .where(eq(etlJobs.id, jobId));
    });

    await step.do('finalize', async () => {
      const db = createDbClient(this.env);
      await db
        .update(etlJobs)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(etlJobs.id, jobId));
    });

    return {
      jobId,
      rowsProcessed: totals.rowsProcessed,
      rowsValid: totals.rowsValid,
      rowsInvalid: totals.rowsInvalid,
    };
  }
}
