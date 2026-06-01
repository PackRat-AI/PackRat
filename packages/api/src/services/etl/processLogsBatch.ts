import { createDbClient } from '@packrat/api/db';
import type { Env } from '@packrat/api/utils/env-validation';
import { logger } from '@packrat/api/utils/logger';
import { record } from '@packrat/api/utils/sentry';
import { invalidItemLogs, type NewInvalidItemLog } from '@packrat/db';
import { updateEtlJobProgress } from './updateEtlJobProgress';

export async function processLogsBatch({
  jobId,
  logs,
  env,
}: {
  jobId: string;
  logs: NewInvalidItemLog[];
  env: Env;
}): Promise<void> {
  const db = createDbClient(env);

  // invalid_item_logs is the forensic record of what failed validation;
  // a lost DB write here leaves an operator chasing a data-quality complaint
  // with no trail (audit P2 #2). `record` opens a span and captures+rethrows,
  // so the failure is never swallowed. The structured logger.error keeps the
  // wrangler/console trail distinct from the Sentry capture.
  await record({
    operation: 'etl.processLogsBatch',
    extra: { jobId, count: logs.length },
    fn: async () => {
      try {
        await db.insert(invalidItemLogs).values(logs);
        await updateEtlJobProgress({
          env,
          params: {
            jobId,
            invalid: logs.length,
            processed: logs.length,
          },
        });

        logger.info({ event: 'etl.invalid_logs.persisted', ctx: { jobId, count: logs.length } });
      } catch (error) {
        logger.error({
          event: 'etl.invalid_logs.persist_failed',
          ctx: { jobId, count: logs.length, err: error },
        });
        throw error;
      }
    },
  });
}
