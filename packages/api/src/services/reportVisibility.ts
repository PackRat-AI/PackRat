import { trailConditionReportFlags, trailConditionReports, userBlocks } from '@packrat/db/schema';
import { and, eq, notInArray, type SQL } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

/** Only builds subqueries, so any Postgres database will do. */
type Db = Pick<PgDatabase<PgQueryResultHKT>, 'select'>;

/**
 * Reports the viewer may see: not ones they flagged, and not by anyone on
 * either side of a block with them. Blocks are shared with the social feed,
 * so blocking a hiker anywhere hides them everywhere.
 */
export function visibleToViewer({ db, viewerId }: { db: Db; viewerId: string }): SQL {
  const flaggedByMe = db
    .select({ id: trailConditionReportFlags.reportId })
    .from(trailConditionReportFlags)
    .where(eq(trailConditionReportFlags.reporterId, viewerId));
  const blockedByMe = db
    .select({ id: userBlocks.blockedId })
    .from(userBlocks)
    .where(eq(userBlocks.blockerId, viewerId));
  const blockingMe = db
    .select({ id: userBlocks.blockerId })
    .from(userBlocks)
    .where(eq(userBlocks.blockedId, viewerId));
  // biome-ignore lint/style/noNonNullAssertion: and() of defined conditions is never undefined
  return and(
    notInArray(trailConditionReports.id, flaggedByMe),
    notInArray(trailConditionReports.userId, blockedByMe),
    notInArray(trailConditionReports.userId, blockingMe),
  )!;
}
