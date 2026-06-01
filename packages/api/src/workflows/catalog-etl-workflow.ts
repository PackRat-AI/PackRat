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
import { isJsonlFile, mapJsonRowToItem } from '@packrat/api/utils/json-utils';
import { record } from '@packrat/api/utils/sentry';
import { etlJobs, type NewCatalogItem, type NewInvalidItemLog } from '@packrat/db';
import { toRecord } from '@packrat/guards';
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

async function fetchHeaderRow({
  r2,
  objectKey,
}: {
  r2: R2BucketService;
  objectKey: string;
}): Promise<string> {
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
  const useJsonl = isJsonlFile(chunk.objectKey);

  const length = chunk.byteEnd - chunk.byteStart + 1;
  const obj = await r2.get(chunk.objectKey, {
    range: { offset: chunk.byteStart, length },
  });
  if (!obj) throw new Error(`R2 chunk read returned null for ${chunk.objectKey}`);

  const validItemsBatch: Partial<NewCatalogItem>[] = [];
  const invalidItemsBatch: NewInvalidItemLog[] = [];
  const validator = new CatalogItemValidator();

  let rowIndex = 0;
  let rowsValid = 0;
  let rowsInvalid = 0;

  if (useJsonl) {
    // --- JSONL streaming path ---
    // The chunker snaps boundaries to newlines, so every chunk starts at a
    // clean line boundary — no partial first-line skip needed for any chunk.
    let buffer = '';
    let firstLineSkipped = true;

    for await (const text of streamToText(obj.body)) {
      buffer += text;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (!firstLineSkipped) {
          firstLineSkipped = true;
          continue; // discard partial row at chunk boundary
        }

        if (rowIndex % 100 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }

        let parsedObj: Record<string, unknown>;
        try {
          parsedObj = toRecord(JSON.parse(trimmed));
        } catch (parseErr) {
          invalidItemsBatch.push({
            jobId,
            errors: [{ field: 'json_parse', reason: String(parseErr) }],
            rawData: { parseError: String(parseErr) },
            rowIndex,
          });
          rowIndex++;
          if (invalidItemsBatch.length >= BATCH_SIZE) {
            await processLogsBatch({ jobId, logs: [...invalidItemsBatch], env });
            rowsInvalid += invalidItemsBatch.length;
            invalidItemsBatch.length = 0;
          }
          continue;
        }

        const item = mapJsonRowToItem(parsedObj);
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
    }

    // Flush remaining buffer line (last line without trailing newline)
    const lastLine = buffer.trim();
    if (lastLine && firstLineSkipped) {
      try {
        const parsedObj = toRecord(JSON.parse(lastLine));
        const item = mapJsonRowToItem(parsedObj);
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
      } catch (parseErr) {
        invalidItemsBatch.push({
          jobId,
          errors: [{ field: 'json_parse', reason: String(parseErr) }],
          rawData: { parseError: String(parseErr) },
          rowIndex,
        });
        rowIndex++;
      }
    }
  } else {
    // --- CSV path ---
    const injectedHeader = isNonFirstChunk
      ? await fetchHeaderRow({ r2, objectKey: chunk.objectKey })
      : '';

    let fieldMap: Record<string, number> = {};
    let isHeaderProcessed = false;

    const parser = parse({
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: true,
      skip_records_with_error: true,
      on_skip: (err) => {
        const parserLine = (err as { lines?: number } | undefined)?.lines ?? rowIndex;
        const message = err?.message ?? 'unknown parse error';
        invalidItemsBatch.push({
          jobId,
          errors: [{ field: 'csv_parse', reason: message }],
          rawData: { parseError: message },
          rowIndex: parserLine,
        });
        // Count the skipped row toward rowsProcessed (reported as rowIndex);
        // otherwise rows dropped by the parser silently undercount the total.
        rowIndex++;
      },
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

    for await (const rawRow of parser) {
      if (rowIndex % 100 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      const row = rawRow as string[];

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
  }

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
    try {
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
      if (chunks.length === 0) {
        throw new Error(`Workflow ${jobId} received empty chunks array`);
      }
      await step.do('aggregate', async () =>
        record({
          operation: 'catalogEtl.aggregate',
          extra: { jobId },
          fn: async () => {
            const db = createDbClient(this.env);
            await db
              .update(etlJobs)
              .set({
                totalProcessed: totals.rowsProcessed,
                totalValid: totals.rowsValid,
                totalInvalid: totals.rowsInvalid,
              })
              .where(eq(etlJobs.id, jobId));
          },
        }),
      );

      await step.do('finalize', async () =>
        record({
          operation: 'catalogEtl.finalize',
          extra: { jobId },
          fn: async () => {
            const db = createDbClient(this.env);
            await db
              .update(etlJobs)
              .set({ status: 'completed', completedAt: new Date() })
              .where(eq(etlJobs.id, jobId));
          },
        }),
      );

      return {
        jobId,
        rowsProcessed: totals.rowsProcessed,
        rowsValid: totals.rowsValid,
        rowsInvalid: totals.rowsInvalid,
      };
    } catch (err) {
      // Best-effort: mark the DB row failed so operators aren't looking at a
      // perpetually-running job. The workflow runtime also marks the instance
      // errored, but that's only visible in the CF dashboard.
      try {
        const db = createDbClient(this.env);
        await db
          .update(etlJobs)
          .set({ status: 'failed', completedAt: new Date() })
          .where(eq(etlJobs.id, jobId));
      } catch {
        // ignore — status update is best-effort; don't mask the original error
      }
      // No manual capture: this class is exported via instrumentWorkflowWithSentry
      // (index.ts), which captures the rethrown error with workflow context.
      throw err;
    }
  }
}
