import { createDb } from '@packrat/api/db';
import { resolveImageUrl, type ServiceResult } from '@packrat/api/services/feedService';
import { trailConditionReportFlags, trailConditionReports, users } from '@packrat/db/schema';
import type { AdminTrailFlag } from '@packrat/schemas/trailConditions';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

const firstName = sql<string | null>`coalesce(nullif(${users.firstName}, ''), ${users.name})`;

/** Pending flags on live trail reports, one row per report, most-flagged first. */
export async function listPendingTrailFlags(): Promise<AdminTrailFlag[]> {
  const db = createDb();
  const flags = await db
    .tag('trailConditions.admin.listPendingFlags')
    .select({
      reportId: trailConditionReportFlags.reportId,
      reason: trailConditionReportFlags.reason,
      createdAt: trailConditionReportFlags.createdAt,
      reporterId: users.id,
      reporterFirstName: firstName,
      reporterLastName: users.lastName,
    })
    .from(trailConditionReportFlags)
    .innerJoin(users, eq(trailConditionReportFlags.reporterId, users.id))
    .where(eq(trailConditionReportFlags.status, 'pending'))
    .orderBy(asc(trailConditionReportFlags.createdAt));
  if (flags.length === 0) return [];

  const reportIds = [...new Set(flags.map((f) => f.reportId))];
  const reports = await db
    .tag('trailConditions.admin.getFlaggedReports')
    .select({
      id: trailConditionReports.id,
      trailId: trailConditionReports.trailId,
      trailName: trailConditionReports.trailName,
      overallCondition: trailConditionReports.overallCondition,
      hazards: trailConditionReports.hazards,
      notes: trailConditionReports.notes,
      photos: trailConditionReports.photos,
      localCreatedAt: trailConditionReports.localCreatedAt,
      userId: trailConditionReports.userId,
      firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
    })
    .from(trailConditionReports)
    .innerJoin(users, eq(trailConditionReports.userId, users.id))
    .where(
      and(inArray(trailConditionReports.id, reportIds), eq(trailConditionReports.deleted, false)),
    );
  const reportById = new Map(reports.map((r) => [r.id, r]));

  const groups = new Map<string, AdminTrailFlag>();
  for (const f of flags) {
    const reporter = {
      id: f.reporterId,
      firstName: f.reporterFirstName,
      lastName: f.reporterLastName,
    };
    const at = f.createdAt.toISOString();
    const existing = groups.get(f.reportId);
    if (existing) {
      existing.flagCount += 1;
      if (!existing.reasons.includes(f.reason)) existing.reasons.push(f.reason);
      if (!existing.reporters.some((p) => p.id === reporter.id)) existing.reporters.push(reporter);
      existing.lastFlaggedAt = at;
      continue;
    }
    // Deleted by its author since it was flagged: nothing left to moderate.
    const r = reportById.get(f.reportId);
    if (!r) continue;
    groups.set(f.reportId, {
      reportId: r.id,
      trailId: r.trailId,
      trailName: r.trailName,
      overallCondition: r.overallCondition,
      hazards: r.hazards,
      notes: r.notes,
      photos: r.photos.map(resolveImageUrl),
      author: {
        id: r.userId,
        firstName: r.firstName,
        lastName: r.lastName,
        avatarUrl: r.avatarUrl,
      },
      writtenAt: r.localCreatedAt.toISOString(),
      flagCount: 1,
      reasons: [f.reason],
      reporters: [reporter],
      firstFlaggedAt: at,
      lastFlaggedAt: at,
    });
  }

  return [...groups.values()].sort(
    (a, b) => b.flagCount - a.flagCount || a.firstFlaggedAt.localeCompare(b.firstFlaggedAt),
  );
}

/** Dismiss leaves the report up; remove deletes it for everyone. Closes every pending flag on it. */
export async function resolveTrailFlags({
  reportId,
  action,
}: {
  reportId: string;
  action: 'dismiss' | 'remove';
}): Promise<ServiceResult<{ success: true }>> {
  const db = createDb();
  const now = new Date();

  if (action === 'remove') {
    const [removed] = await db
      .tag('trailConditions.admin.removeReport')
      .update(trailConditionReports)
      .set({ deleted: true, updatedAt: now })
      .where(eq(trailConditionReports.id, reportId))
      .returning();
    if (!removed) return { ok: false, status: 404, error: 'Report not found' };
  }

  await db
    .tag('trailConditions.admin.resolveFlags')
    .update(trailConditionReportFlags)
    .set({ status: action === 'remove' ? 'removed' : 'dismissed', reviewedAt: now })
    .where(
      and(
        eq(trailConditionReportFlags.reportId, reportId),
        eq(trailConditionReportFlags.status, 'pending'),
      ),
    );
  return { ok: true, value: { success: true } };
}
