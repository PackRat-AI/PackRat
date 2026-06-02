import { createDbClient } from '@packrat/api/db';
import type { Env } from '@packrat/api/utils/env-validation';
import { logger } from '@packrat/api/utils/logger';
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
    // Rethrow — invalid_item_logs is the forensic record of what failed
    // validation. Silently swallowing a DB write loss here means an
    // operator chasing a data-quality complaint has no trail. Closes
    // audit P2 #2.
    logger.error({
      event: 'etl.invalid_logs.persist_failed',
      ctx: { jobId, count: logs.length, err: error },
    });
    throw error;
  }
}
