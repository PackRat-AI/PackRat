/**
 * U1 — Workflows spike. THROWAWAY.
 *
 * Validates that Cloudflare Workflows hosts the kind of code the production
 * ETL pipeline needs: R2 byte-range reads, csv-parse, durable sleeps, and
 * step-result memoization. Drizzle/Neon validation is deferred to the real
 * workflow in U3 (which runs on the production worker with NEON_DATABASE_URL
 * already configured) — the constraint here is keeping the spike's secret
 * surface minimal so it can deploy as a standalone worker without piping
 * production credentials.
 *
 * Trigger via:
 *   curl -X POST 'https://packrat-etl-spike.<subdomain>.workers.dev/trigger' \
 *     -H 'content-type: application/json' \
 *     -d '{"objectKey":"v2/cotopaxi/cotopaxi_2026-05-14T16-54-05.csv","source":"cotopaxi"}'
 *
 *   or
 *
 *   bunx wrangler workflows trigger spike-etl-workflow \
 *     '{"objectKey":"v2/cotopaxi/cotopaxi_2026-05-14T16-54-05.csv","source":"cotopaxi"}' \
 *     --config=packages/api/wrangler.spike.jsonc
 *
 * Inspect:
 *   bunx wrangler workflows instances list spike-etl-workflow \
 *     --config=packages/api/wrangler.spike.jsonc
 *   bunx wrangler workflows instances describe spike-etl-workflow <instance-id> \
 *     --config=packages/api/wrangler.spike.jsonc
 *
 * Delete this file (and the spike entry + wrangler.spike.jsonc) after GO/NO-GO.
 */

import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { parse } from 'csv-parse';

export type SpikeEtlWorkflowParams = {
  objectKey: string;
  source: string;
};

type SpikeEnv = {
  PACKRAT_SCRAPY_BUCKET: R2Bucket;
};

type SpikeResult = {
  headOk: boolean;
  objectSize: number;
  firstByteCount: number;
  parsedRowCount: number;
  sleepStartTs: number;
  sleepEndTs: number;
  memoizationTimestamp: number;
};

export class SpikeEtlWorkflow extends WorkflowEntrypoint<SpikeEnv, SpikeEtlWorkflowParams> {
  async run(
    event: Readonly<WorkflowEvent<SpikeEtlWorkflowParams>>,
    step: WorkflowStep,
  ): Promise<SpikeResult> {
    const { objectKey } = event.payload;

    // Step 1: R2 head via the native Workers binding — proves R2 access inside step.do.
    const head = await step.do('1-r2-head', async () => {
      const obj = await this.env.PACKRAT_SCRAPY_BUCKET.head(objectKey);
      if (!obj) throw new Error(`R2 object not found: ${objectKey}`);
      return {
        size: obj.size,
        etag: obj.etag,
        uploaded: obj.uploaded?.toISOString() ?? null,
      };
    });

    // Step 2: byte-range read — proves range reads work; cap at 1 MiB to fit step output budget.
    const firstByteCount = await step.do('2-r2-range-read', async () => {
      const obj = await this.env.PACKRAT_SCRAPY_BUCKET.get(objectKey, {
        range: { offset: 0, length: 1024 * 1024 },
      });
      if (!obj) throw new Error(`R2 range read returned null for ${objectKey}`);
      const text = await obj.text();
      return text.length;
    });

    // Step 3: csv-parse inside step.do — proves the parser works in this context.
    // Uses the same Node-stream pattern as packages/api/src/services/etl/processCatalogEtl.ts
    // (write to parser directly; no Readable.from).
    const parsedRowCount = await step.do('3-csv-parse', async () => {
      const obj = await this.env.PACKRAT_SCRAPY_BUCKET.get(objectKey, {
        range: { offset: 0, length: 256 * 1024 },
      });
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

    // Step 4: durable sleep — proves step.sleep survives Worker invocations.
    const sleepStartTs = await step.do('4a-sleep-start', async () => Date.now());
    await step.sleep('4b-sleep-5s', '5 seconds');
    const sleepEndTs = await step.do('4c-sleep-end', async () => Date.now());

    // Step 5: memoization marker — second invocation of the same step name in an instance
    // re-run (manual restart from this step) should return the persisted value.
    const memoizationTimestamp = await step.do('5-memoize-marker', async () => Date.now());

    return {
      headOk: head.size > 0,
      objectSize: head.size,
      firstByteCount,
      parsedRowCount,
      sleepStartTs,
      sleepEndTs,
      memoizationTimestamp,
    };
  }
}
