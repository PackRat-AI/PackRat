import { createDbClient } from '@packrat/api/db';
import { etlJobs } from '@packrat/api/db/schema';
import type { Env } from '@packrat/api/types/env';
import { eq, sql } from 'drizzle-orm';

export async function updateEtlJobProgress(
  env: Env,
  jobId: string,
  update: { valid?: number; invalid?: number; total: number },
): Promise<void> {
  const db = createDbClient(env);

  const valid = update?.valid ?? 0;
  const invalid = update?.invalid ?? 0;

  // Use atomic SQL operations to prevent race conditions
  await db
    .update(etlJobs)
    .set({
      totalProcessed: sql`COALESCE(${etlJobs.totalProcessed}, 0) + ${valid + invalid}`,
      totalValid: sql`COALESCE(${etlJobs.totalValid}, 0) + ${valid}`,
      totalInvalid: sql`COALESCE(${etlJobs.totalInvalid}, 0) + ${invalid}`,
      status: sql`CASE 
        WHEN COALESCE(${etlJobs.totalProcessed}, 0) + ${valid + invalid} >= ${update.total} 
        THEN 'completed' 
        ELSE ${etlJobs.status} 
      END`,
      completedAt: sql`CASE 
        WHEN COALESCE(${etlJobs.totalProcessed}, 0) + ${valid + invalid} >= ${update.total} 
        THEN CURRENT_TIMESTAMP 
        ELSE ${etlJobs.completedAt} 
      END`,
    })
    .where(eq(etlJobs.id, jobId));
}
