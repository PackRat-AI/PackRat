import { createDbClient } from '@packrat/api/db';
import { etlJobs } from '@packrat/api/db/schema';
import type { Env } from '@packrat/api/types/env';
import { eq, sql } from 'drizzle-orm';

export async function updateEtlJobProgress(
  env: Env,
  params: { jobId: string; valid?: number; invalid?: number },
): Promise<void> {
  const db = createDbClient(env);

  const valid = params?.valid ?? 0;
  const invalid = params?.invalid ?? 0;

  await db
    .update(etlJobs)
    .set({
      totalValid: sql`COALESCE(${etlJobs.totalValid}, 0) + ${valid}`,
      totalInvalid: sql`COALESCE(${etlJobs.totalInvalid}, 0) + ${invalid}`,
    })
    .where(eq(etlJobs.id, params.jobId));
}
