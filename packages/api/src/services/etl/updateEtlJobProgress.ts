import { createDbClient } from '@packrat/api/db';
import { etlJobs } from '@packrat/api/db/schema';
import type { Env } from '@packrat/api/utils/env-validation';
import { eq, sql } from 'drizzle-orm';

export async function updateEtlJobProgress(
  env: Env,
  params: { jobId: string; valid?: number; invalid?: number },
): Promise<void> {
  const db = createDbClient(env);

  const valid = params?.valid ?? 0;
  const invalid = params?.invalid ?? 0;

  // Use atomic SQL operations to prevent race conditions
  await db
    .update(etlJobs)
    .set({
      totalValid: sql`COALESCE(${etlJobs.totalValid}, 0) + ${valid}`,
      totalInvalid: sql`COALESCE(${etlJobs.totalInvalid}, 0) + ${invalid}`,
      status: sql`CASE 
        WHEN COALESCE(${etlJobs.totalCount}, 0) = COALESCE(${etlJobs.totalValid}, 0) + COALESCE(${etlJobs.totalInvalid}, 0) 
        THEN 'completed' 
        ELSE ${etlJobs.status} 
      END`,
      completedAt: sql`CASE 
        WHEN COALESCE(${etlJobs.totalCount}, 0) = COALESCE(${etlJobs.totalValid}, 0) + COALESCE(${etlJobs.totalInvalid}, 0) 
        THEN CURRENT_TIMESTAMP 
        ELSE ${etlJobs.completedAt} 
      END`,
    })
    .where(eq(etlJobs.id, params.jobId));
}
