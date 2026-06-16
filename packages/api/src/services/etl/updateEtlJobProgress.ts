import { createDbClient } from '@packrat/api/db';
import type { Env } from '@packrat/api/utils/env-validation';
import { etlJobs } from '@packrat/db';
import { eq, sql } from 'drizzle-orm';

export async function updateEtlJobProgress({
  env,
  params,
}: {
  env: Env;
  params: { jobId: string; valid?: number; invalid?: number; processed?: number };
}): Promise<void> {
  const db = createDbClient(env);

  const valid = params?.valid ?? 0;
  const invalid = params?.invalid ?? 0;
  const processed = params?.processed ?? 0;

  await db
    .tag('etl.updateJobProgress')
    .update(etlJobs)
    .set({
      totalValid: sql`COALESCE(${etlJobs.totalValid}, 0) + ${valid}`,
      totalInvalid: sql`COALESCE(${etlJobs.totalInvalid}, 0) + ${invalid}`,
      totalProcessed: sql`COALESCE(${etlJobs.totalProcessed}, 0) + ${processed}`,
    })
    .where(eq(etlJobs.id, params.jobId));
}
