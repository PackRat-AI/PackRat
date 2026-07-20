// Bounded-batch DELETE of expired invalid_item_logs.
//
// Each ETL run can produce thousands of invalid_item_logs rows. Left alone
// the table grows without bound. This sweep is the periodic cleanup.

import { createDbClient } from '@packrat/api/db';
import type { Env } from '@packrat/api/utils/env-validation';
import { record } from '@packrat/api/utils/sentry';
import { invalidItemLogs } from '@packrat/db';
import { inArray, lt, sql } from 'drizzle-orm';

const DEFAULT_RETENTION_DAYS = 90;
const DEFAULT_BATCH_SIZE = 10_000;
const DEFAULT_MAX_ITERATIONS = 100;

export type RetentionResult = {
  /** Total rows deleted across all iterations. */
  deleted: number;
  /** How many DELETE batches ran. */
  iterations: number;
  /** True if the run hit `maxIterations` before exhausting expired rows; caller should alert. */
  capped: boolean;
  /** Effective retention window applied. */
  retentionDays: number;
};

export type RetentionOptions = {
  retentionDays?: number;
  batchSize?: number;
  maxIterations?: number;
};

/**
 * Delete invalid_item_logs older than the retention window in bounded batches.
 *
 * Default retention is 90 days. The default 100-iteration cap x 10k batch
 * size = up to 1M rows per run. If the table has more expired rows than
 * that on first execution, the function returns `capped: true` and the
 * remainder is swept on subsequent runs.
 */
export async function sweepInvalidItemLogs({
  env,
  options = {},
}: {
  env: Env;
  options?: RetentionOptions;
}): Promise<RetentionResult> {
  const retentionDays =
    options.retentionDays !== undefined && options.retentionDays > 0
      ? options.retentionDays
      : DEFAULT_RETENTION_DAYS;
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;

  return record({
    operation: 'retention.sweepInvalidItemLogs',
    extra: { retentionDays, batchSize, maxIterations },
    fn: async () => {
      const db = createDbClient(env);

      let deleted = 0;
      let iterations = 0;
      let rowCount = 0;
      const cutoff = sql`now() - (${retentionDays}::int * interval '1 day')`;

      for (let i = 0; i < maxIterations; i++) {
        iterations++;

        const selectExpired = db
          .tag('retention.selectExpiredLogs')
          .select({ id: invalidItemLogs.id })
          .from(invalidItemLogs)
          .where(lt(invalidItemLogs.createdAt, cutoff))
          .limit(batchSize);

        const removed = await db
          .tag('retention.deleteInvalidLogs')
          .delete(invalidItemLogs)
          .where(inArray(invalidItemLogs.id, selectExpired))
          .returning();

        rowCount = removed.length;
        deleted += rowCount;
        if (rowCount === 0) break;
      }

      return {
        deleted,
        iterations,
        capped: rowCount > 0,
        retentionDays,
      };
    },
  });
}
