/**
 * U1 — Workflows spike. THROWAWAY.
 *
 * Goal: prove the binding + step.do + R2 byte-range + csv-parse + Drizzle Neon HTTP
 * all work cleanly inside a Workflows instance, and that step results are
 * durably persisted (memoization on retry).
 *
 * Trigger via:
 *   wrangler workflows trigger spike-etl-workflow \
 *     '{"objectKey":"v2/cotopaxi/cotopaxi_2026-05-14T16-54-05.csv","source":"cotopaxi"}' \
 *     --env=dev
 *
 * Then inspect via:
 *   wrangler workflows instances list spike-etl-workflow --env=dev
 *   wrangler workflows instances describe spike-etl-workflow <instance-id> --env=dev
 *
 * Expected: instance reaches `complete`, all 5 steps recorded with results,
 * step.sleep durably pauses for 5 seconds, csv-parse returns a positive row count.
 *
 * Delete this file (and remove the workflows binding from wrangler.jsonc) after U1 GO/NO-GO.
 */

import { createDbClient } from '@packrat/api/db';
import { R2BucketService } from '@packrat/api/services/r2-bucket';
import type { Env } from '@packrat/api/utils/env-validation';
import { setWorkerEnv } from '@packrat/api/utils/env-validation';
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { parse } from 'csv-parse';
import { sql } from 'drizzle-orm';

export type SpikeEtlWorkflowParams = {
  objectKey: string;
  source: string;
};

type SpikeResult = {
  headOk: boolean;
  firstByteCount: number;
  parsedRowCount: number;
  etlJobCount: number;
  sleepStartTs: number;
  sleepEndTs: number;
  memoizationTimestamp: number;
};

export class SpikeEtlWorkflow extends WorkflowEntrypoint<Env, SpikeEtlWorkflowParams> {
  async run(
    event: Readonly<WorkflowEvent<SpikeEtlWorkflowParams>>,
    step: WorkflowStep,
  ): Promise<SpikeResult> {
    setWorkerEnv(this.env as unknown as Record<string, unknown>); // safe-cast: same shape as fetch handler

    const { objectKey } = event.payload;

    // Step 1: R2 head — proves the R2 S3-API binding works inside step.do.
    const head = await step.do('1-r2-head', async () => {
      const r2 = new R2BucketService({ env: this.env, bucketType: 'catalog' });
      const headResult = await r2.head(objectKey);
      if (!headResult) throw new Error(`R2 object not found: ${objectKey}`);
      return {
        size: headResult.size,
        etag: headResult.etag,
        lastModified: headResult.lastModified?.toISOString() ?? null,
      };
    });

    // Step 2: R2 byte-range read — proves range reads work; cap at 1 MiB to fit step output budget.
    const firstByteCount = await step.do('2-r2-range-read', async () => {
      const r2 = new R2BucketService({ env: this.env, bucketType: 'catalog' });
      const obj = await r2.get(objectKey, { range: { offset: 0, length: 1024 * 1024 } });
      if (!obj) throw new Error(`R2 range read returned null for ${objectKey}`);
      const text = await obj.text();
      return text.length;
    });

    // Step 3: csv-parse inside step.do — proves the parser works in this context.
    // Uses the same Node-stream pattern as packages/api/src/services/etl/processCatalogEtl.ts
    // (write to parser directly; no Readable.from).
    const parsedRowCount = await step.do('3-csv-parse', async () => {
      const r2 = new R2BucketService({ env: this.env, bucketType: 'catalog' });
      const obj = await r2.get(objectKey, { range: { offset: 0, length: 256 * 1024 } });
      if (!obj) throw new Error('R2 range read for parse step returned null');
      const text = await obj.text();
      const parser = parse({ columns: true, relax_quotes: true, relax_column_count: true });
      parser.write(text);
      parser.end();
      let count = 0;
      for await (const _record of parser) {
        count++;
        if (count >= 100) break;
      }
      return count;
    });

    // Step 4: Drizzle Neon HTTP query inside step.do — proves the driver works.
    const etlJobCount = await step.do('4-drizzle-select', async () => {
      const db = createDbClient(this.env);
      const result = await db.execute(sql`SELECT count(*)::int AS n FROM etl_jobs`);
      const rows = result as unknown as Array<{ n: number }>;
      return rows[0]?.n ?? -1;
    });

    // Step 5: durable sleep — proves step.sleep works.
    const sleepStartTs = await step.do('5a-sleep-start', async () => Date.now());
    await step.sleep('5b-sleep-5s', '5 seconds');
    const sleepEndTs = await step.do('5c-sleep-end', async () => Date.now());

    // Step 6: memoization — second invocation of the same step name in a re-run
    // returns the persisted value. Within one run this just records Date.now();
    // re-running the instance (or manually restarting from this step) should show
    // the same value persists in the instance's step history.
    const memoizationTimestamp = await step.do('6-memoize-marker', async () => Date.now());

    return {
      headOk: head.size > 0,
      firstByteCount,
      parsedRowCount,
      etlJobCount,
      sleepStartTs,
      sleepEndTs,
      memoizationTimestamp,
    };
  }
}
