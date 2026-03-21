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
      status: sql`CASE 
        WHEN COALESCE(${etlJobs.totalProcessed}, 0) = COALESCE(${etlJobs.totalValid}, 0) + ${valid} + COALESCE(${etlJobs.totalInvalid}, 0) + ${invalid} 
        THEN 'completed' 
        ELSE ${etlJobs.status} 
      END`,
      completedAt: sql`CASE 
        WHEN COALESCE(${etlJobs.totalProcessed}, 0) = COALESCE(${etlJobs.totalValid}, 0) + ${valid} + COALESCE(${etlJobs.totalInvalid}, 0) + ${invalid}
        THEN CURRENT_TIMESTAMP 
        ELSE ${etlJobs.completedAt} 
      END`,
    })
    .where(eq(etlJobs.id, params.jobId));
}
