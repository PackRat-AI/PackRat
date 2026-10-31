import { createDb } from '@packrat/api/db';
import { authPlugin } from '@packrat/api/middleware/auth';
import { listCachedFeatureFlags } from '@packrat/api/services/featureFlagsService';
import { runAfterResponse } from '@packrat/api/services/push/notifyFeed';
import { reportAuthorNames } from '@packrat/api/services/reportAuthors';
import { visibleToViewer } from '@packrat/api/services/reportVisibility';
import { notifyTripsOfReport } from '@packrat/api/services/trailConditionAlerts';
import { getEnv } from '@packrat/api/utils/env-validation';
import { captureApiException } from '@packrat/api/utils/sentry';
import { FeatureFlag } from '@packrat/config';
import type { NewTrailConditionReport, TrailConditionReport } from '@packrat/db/schema';
import { trailConditionReportFlags, trailConditionReports } from '@packrat/db/schema';
import {
  CreateTrailConditionReportRequestSchema,
  FlagTrailConditionReportRequestSchema,
  UpdateTrailConditionReportRequestSchema,
} from '@packrat/schemas/trailConditions';
import { and, desc, eq, gte, ilike, type SQL } from 'drizzle-orm';
import { Elysia, status } from 'elysia';
import { z } from 'zod';
import { trailDbOrNull } from './trailDb';

// ── LIKE-clause escape patterns ───────────────────────────────────────
const LIKE_ESCAPE_BACKSLASH = /\\/g;
const LIKE_ESCAPE_PERCENT = /%/g;
const LIKE_ESCAPE_UNDERSCORE = /_/g;

const earliest = (dates: [Date, Date]) => {
  const [a, b] = dates;
  return a.getTime() <= b.getTime() ? a : b;
};

export function toReportResponse(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    localCreatedAt:
      row.localCreatedAt instanceof Date
        ? row.localCreatedAt.toISOString()
        : String(row.localCreatedAt),
    localUpdatedAt:
      row.localUpdatedAt instanceof Date
        ? row.localUpdatedAt.toISOString()
        : String(row.localUpdatedAt),
  };
}

/** Tells owners of trips this report concerns, when notifications are switched on. */
async function notifyTripOwnersOfReport(report: TrailConditionReport): Promise<void> {
  try {
    const env = getEnv();
    const flags = await listCachedFeatureFlags(env.AUTH_KV);
    if (flags[FeatureFlag.EnableTrailConditionNotifications] !== true) return;
    await notifyTripsOfReport({
      env,
      db: createDb(),
      trailDb: trailDbOrNull(),
      report,
      now: new Date(),
    });
  } catch (error) {
    captureApiException({
      error,
      operation: 'trailConditions.notifyTripOwners',
      tags: { feature: 'trailConditions' },
      extra: { reportId: report.id },
    });
  }
}

export const trailConditionRoutes = new Elysia()
  .model({
    'trailConditions.CreateTrailConditionReportRequest': CreateTrailConditionReportRequestSchema,
    'trailConditions.FlagTrailConditionReportRequest': FlagTrailConditionReportRequestSchema,
    'trailConditions.UpdateTrailConditionReportRequest': UpdateTrailConditionReportRequestSchema,
  })
  .use(authPlugin)
  .get(
    '/',
    async ({ query, user }) => {
      const db = createDb();
      const { trailId, trailName, limit } = query;

      try {
        const conditions = [
          eq(trailConditionReports.deleted, false),
          visibleToViewer({ db, viewerId: user.userId }),
        ];
        if (trailId) conditions.push(eq(trailConditionReports.trailId, trailId));
        if (trailName) {
          const normalized = trailName.trim();
          if (normalized.length > 0) {
            const escaped = normalized
              .replace(LIKE_ESCAPE_BACKSLASH, '\\\\')
              .replace(LIKE_ESCAPE_PERCENT, '\\%')
              .replace(LIKE_ESCAPE_UNDERSCORE, '\\_');
            conditions.push(ilike(trailConditionReports.trailName, `%${escaped}%`));
          }
        }

        const reports = await db
          .tag('trailConditions.listReports')
          .select()
          .from(trailConditionReports)
          .where(and(...conditions))
          .orderBy(desc(trailConditionReports.localCreatedAt))
          .limit(limit ?? 50);

        // The feed signs each report, like the trip section and trail page.
        const authorName = await reportAuthorNames({ db, userIds: reports.map((r) => r.userId) });
        return reports.map((r) => ({
          ...toReportResponse(r),
          authorName: authorName.get(r.userId) ?? null,
        }));
      } catch (error) {
        captureApiException({
          error: error,
          operation: 'trailConditions.list',
          tags: { feature: 'trailConditions' },
          extra: {
            trailId,
            trailName,
            limit,
            httpStatus: 500,
            errorCode: 'TRAIL_CONDITIONS_LIST_ERROR',
          },
        });
        return status(500, { error: 'Failed to list trail condition reports' });
      }
    },
    {
      query: z.object({
        trailId: z.string().uuid().optional(),
        trailName: z.string().optional(),
        // Handler defaults to 50 via `?? 50`; keep schema truly optional.
        limit: z.coerce.number().int().min(1).max(100).optional(),
      }),
      isAuthenticated: true,
      detail: {
        tags: ['Trail Conditions'],
        summary: 'List trail condition reports',
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .post(
    '/',
    async ({ body, user }) => {
      const db = createDb();
      const data = body;

      try {
        const [newReport] = await db
          .tag('trailConditions.createReport')
          .insert(trailConditionReports)
          .values({
            id: data.id,
            trailId: data.trailId ?? null,
            trailName: data.trailName,
            trailRegion: data.trailRegion ?? null,
            latitude: data.latitude ?? null,
            longitude: data.longitude ?? null,
            surface: data.surface,
            overallCondition: data.overallCondition,
            hazards: data.hazards ?? [],
            waterCrossings: data.waterCrossings ?? 0,
            waterCrossingDifficulty: data.waterCrossingDifficulty ?? null,
            notes: data.notes ?? null,
            photos: data.photos ?? [],
            userId: user.userId,
            tripId: data.tripId ?? null,
            deleted: false,
            // When it was written, which is what readers judge it by: a report
            // sent late from no signal keeps its age. Clamped so a phone with
            // its clock ahead can't post a report from the future.
            localCreatedAt: earliest([new Date(data.localCreatedAt), new Date()]),
            localUpdatedAt: new Date(data.localUpdatedAt),
          })
          .returning();

        if (!newReport) return status(400, { error: 'Failed to submit report' });

        await runAfterResponse(() => notifyTripOwnersOfReport(newReport));
        return toReportResponse(newReport);
      } catch (error) {
        const pgCode = (error as { code?: string })?.code;
        if (pgCode === '23505') {
          const existing = await db
            .tag('trailConditions.findExistingReport')
            .query.trailConditionReports.findFirst({
              where: and(
                eq(trailConditionReports.id, data.id),
                eq(trailConditionReports.userId, user.userId),
              ),
            });
          if (existing) return toReportResponse(existing);
          return status(409, { error: 'Report ID already in use by another user' });
        }
        captureApiException({
          error: error,
          operation: 'trailConditions.create',
          tags: { feature: 'trailConditions' },
          extra: {
            reportId: data.id,
            userId: user.userId,
            httpStatus: 500,
            errorCode: 'TRAIL_CONDITIONS_CREATE_ERROR',
          },
        });
        return status(500, { error: 'Failed to submit trail condition report' });
      }
    },
    {
      body: 'trailConditions.CreateTrailConditionReportRequest',
      isAuthenticated: true,
      detail: {
        tags: ['Trail Conditions'],
        summary: 'Submit a trail condition report',
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .get(
    '/mine',
    async ({ query, user }) => {
      const db = createDb();
      const { updatedAt } = query;

      try {
        const conditions: SQL[] = [
          eq(trailConditionReports.userId, user.userId),
          eq(trailConditionReports.deleted, false),
        ];
        if (updatedAt) {
          conditions.push(gte(trailConditionReports.updatedAt, new Date(updatedAt)));
        }

        const reports = await db
          .tag('trailConditions.listMineReports')
          .select()
          .from(trailConditionReports)
          .where(and(...conditions))
          .orderBy(desc(trailConditionReports.localCreatedAt));

        return reports.map(toReportResponse);
      } catch (error) {
        captureApiException({
          error: error,
          operation: 'trailConditions.listMine',
          tags: { feature: 'trailConditions' },
          extra: {
            userId: user.userId,
            updatedAt,
            httpStatus: 500,
            errorCode: 'TRAIL_CONDITIONS_LIST_MINE_ERROR',
          },
        });
        return status(500, { error: 'Failed to list trail condition reports' });
      }
    },
    {
      query: z.object({ updatedAt: z.string().datetime().optional() }),
      isAuthenticated: true,
      detail: {
        tags: ['Trail Conditions'],
        summary: 'List my trail condition reports',
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .put(
    '/:reportId',
    async ({ params, body, user }) => {
      const db = createDb();
      const reportId = params.reportId;
      const data = body;

      try {
        const updateData: Partial<NewTrailConditionReport> & { updatedAt: Date } = {
          updatedAt: new Date(),
        };
        if ('trailName' in data && data.trailName !== undefined)
          updateData.trailName = data.trailName;
        if ('trailRegion' in data) updateData.trailRegion = data.trailRegion ?? null;
        if ('surface' in data && data.surface !== undefined) updateData.surface = data.surface;
        if ('overallCondition' in data && data.overallCondition !== undefined)
          updateData.overallCondition = data.overallCondition;
        if ('hazards' in data) updateData.hazards = data.hazards ?? [];
        if ('waterCrossings' in data) updateData.waterCrossings = data.waterCrossings ?? 0;
        if ('waterCrossingDifficulty' in data)
          updateData.waterCrossingDifficulty = data.waterCrossingDifficulty ?? null;
        if ('notes' in data) updateData.notes = data.notes ?? null;
        if ('photos' in data) updateData.photos = data.photos ?? [];
        if ('localUpdatedAt' in data && data.localUpdatedAt)
          updateData.localUpdatedAt = new Date(data.localUpdatedAt);

        const [updated] = await db
          .tag('trailConditions.updateReport')
          .update(trailConditionReports)
          .set(updateData)
          .where(
            and(
              eq(trailConditionReports.id, reportId),
              eq(trailConditionReports.userId, user.userId),
            ),
          )
          .returning();

        if (!updated) return status(403, { error: 'Report not found or unauthorized' });

        return toReportResponse(updated);
      } catch (error) {
        captureApiException({
          error: error,
          operation: 'trailConditions.update',
          tags: { feature: 'trailConditions' },
          extra: {
            reportId,
            userId: user.userId,
            httpStatus: 500,
            errorCode: 'TRAIL_CONDITIONS_UPDATE_ERROR',
          },
        });
        return status(500, { error: 'Failed to update trail condition report' });
      }
    },
    {
      params: z.object({ reportId: z.string() }),
      body: 'trailConditions.UpdateTrailConditionReportRequest',
      isAuthenticated: true,
      detail: {
        tags: ['Trail Conditions'],
        summary: 'Update a trail condition report',
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .post(
    '/:reportId/flag',
    async ({ params, body, user }) => {
      const db = createDb();
      const [report] = await db
        .tag('trailConditions.findFlagTarget')
        .select({ userId: trailConditionReports.userId })
        .from(trailConditionReports)
        .where(
          and(
            eq(trailConditionReports.id, params.reportId),
            eq(trailConditionReports.deleted, false),
          ),
        )
        .limit(1);
      if (!report) return status(404, { error: 'Report not found' });
      if (report.userId === user.userId) {
        return status(400, { error: 'You cannot flag your own report' });
      }
      // Flagging twice is a no-op: the first reason stands.
      await db
        .tag('trailConditions.flagReport')
        .insert(trailConditionReportFlags)
        .values({ reporterId: user.userId, reportId: params.reportId, reason: body.reason })
        .onConflictDoNothing();
      return { success: true };
    },
    {
      params: z.object({ reportId: z.string() }),
      body: 'trailConditions.FlagTrailConditionReportRequest',
      isAuthenticated: true,
      detail: {
        tags: ['Trail Conditions'],
        summary: "Flag someone else's report for review; hides it for you",
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .delete(
    '/:reportId',
    async ({ params, user }) => {
      const db = createDb();
      const reportId = params.reportId;

      try {
        const [deleted] = await db
          .tag('trailConditions.deleteReport')
          .update(trailConditionReports)
          .set({ deleted: true, updatedAt: new Date() })
          .where(
            and(
              eq(trailConditionReports.id, reportId),
              eq(trailConditionReports.userId, user.userId),
            ),
          )
          .returning();

        if (!deleted) return status(403, { error: 'Report not found or unauthorized' });

        return { success: true };
      } catch (error) {
        captureApiException({
          error: error,
          operation: 'trailConditions.delete',
          tags: { feature: 'trailConditions' },
          extra: {
            reportId,
            userId: user.userId,
            httpStatus: 500,
            errorCode: 'TRAIL_CONDITIONS_DELETE_ERROR',
          },
        });
        return status(500, { error: 'Failed to delete trail condition report' });
      }
    },
    {
      params: z.object({ reportId: z.string() }),
      isAuthenticated: true,
      detail: {
        tags: ['Trail Conditions'],
        summary: 'Delete a trail condition report',
        security: [{ bearerAuth: [] }],
      },
    },
  );
