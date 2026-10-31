import { createDb } from '@packrat/api/db';
import { reportedContent, users } from '@packrat/db/schema';
import type { AdminAiReport, AdminAiReportAction } from '@packrat/schemas/admin';
import { and, asc, eq, sql } from 'drizzle-orm';

// Reported AI chat answers for the admin console. Mobile users file these from
// the chat screen; an admin either dismisses the report or marks it resolved.

type ServiceResult<T> = { ok: true; value: T } | { ok: false; status: 404; error: string };

// Accounts created by email sign-up carry only a display name; fall back to it.
const reporterFirstName = sql<
  string | null
>`coalesce(nullif(${users.firstName}, ''), ${users.name})`;

const STATUS_FOR_ACTION: Readonly<Record<AdminAiReportAction, string>> = Object.freeze({
  dismiss: 'dismissed',
  resolve: 'resolved',
} as const);

export async function listPendingAiReports(): Promise<AdminAiReport[]> {
  const db = createDb();
  const rows = await db
    .tag('aiReports.admin.listPending')
    .select({
      id: reportedContent.id,
      userQuery: reportedContent.userQuery,
      aiResponse: reportedContent.aiResponse,
      reason: reportedContent.reason,
      userComment: reportedContent.userComment,
      createdAt: reportedContent.createdAt,
      reporterId: users.id,
      reporterFirstName,
      reporterLastName: users.lastName,
      reporterAvatarUrl: users.avatarUrl,
    })
    .from(reportedContent)
    .innerJoin(users, eq(reportedContent.userId, users.id))
    .where(eq(reportedContent.status, 'pending'))
    .orderBy(asc(reportedContent.createdAt));

  return rows.map((row) => ({
    id: row.id,
    userQuery: row.userQuery,
    aiResponse: row.aiResponse,
    reason: row.reason,
    userComment: row.userComment,
    reporter: {
      id: row.reporterId,
      firstName: row.reporterFirstName,
      lastName: row.reporterLastName,
      avatarUrl: row.reporterAvatarUrl,
    },
    reportedAt: row.createdAt.toISOString(),
  }));
}

export async function resolveAiReport({
  id,
  action,
}: {
  id: number;
  action: AdminAiReportAction;
}): Promise<ServiceResult<{ success: true }>> {
  const db = createDb();
  const [updated] = await db
    .tag('aiReports.admin.resolve')
    .update(reportedContent)
    .set({ status: STATUS_FOR_ACTION[action], reviewed: true, reviewedAt: new Date() })
    .where(and(eq(reportedContent.id, id), eq(reportedContent.status, 'pending')))
    .returning();
  if (!updated) return { ok: false, status: 404, error: 'Report not found' };
  return { ok: true, value: { success: true } };
}
