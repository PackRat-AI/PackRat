import type { Env } from '@packrat/api/types/env';
import { invalidItemLogs, type NewInvalidItemLog } from '@packrat/db';
import { createDbClient } from '../../db';
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
    await updateEtlJobProgress(env, {
      jobId,
      invalid: logs.length,
    });

    console.log(`📝 Processed and wrote ${logs.length} invalid items for job ${jobId}`);
  } catch (error) {
    console.error(`Failed to process log message:`, error);
  }
}
