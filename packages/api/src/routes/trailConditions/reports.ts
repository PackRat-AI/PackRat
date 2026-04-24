import { createDb } from '@packrat/api/db';
import type { NewTrailConditionReport } from '@packrat/api/db/schema';
import { trailConditionReports } from '@packrat/api/db/schema';
import { authPlugin } from '@packrat/api/middleware/auth';
import { and, desc, eq, gte, ilike, type SQL } from 'drizzle-orm';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

const CreateReportRequestSchema = z.object({
  id: z.string().describe('Client-generated report ID'),
  trailName: z.string().min(1),
  trailRegion: z.string().optional().nullable(),
  surface: z.enum(['paved', 'gravel', 'dirt', 'rocky', 'snow', 'mud']),
  overallCondition: z.enum(['excellent', 'good', 'fair', 'poor']),
  hazards: z.array(z.string()).optional().default([]),
  waterCrossings: z.number().int().min(0).max(20).optional().default(0),
  waterCrossingDifficulty: z.enum(['easy', 'moderate', 'difficult']).optional().nullable(),
  notes: z.string().optional().nullable(),
  photos: z.array(z.string()).optional().default([]),
  tripId: z.string().optional().nullable(),
  localCreatedAt: z.string().datetime(),
  localUpdatedAt: z.string().datetime(),
});

const UpdateReportRequestSchema = CreateReportRequestSchema.omit({
  id: true,
  localCreatedAt: true,
}).partial();

function toReportResponse(row: Record<string, unknown>): Record<string, unknown> {
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

export const trailConditionRoutes = new Elysia()
  .use(authPlugin)
  .get(
    '/',
    async ({ query }) => {
      const db = createDb();
      const { trailName, limit } = query;

      try {
        const conditions = [eq(trailConditionReports.deleted, false)];
        if (trailName) {
          const normalized = trailName.trim();
          if (normalized.length > 0) {
            const escaped = normalized
              .replace(/\\/g, '\\\\')
              .replace(/%/g, '\\%')
              .replace(/_/g, '\\_');
            conditions.push(ilike(trailConditionReports.trailName, `%${escaped}%`));
          }
        }

        const reports = await db
          .select()
          .from(trailConditionReports)
          .where(and(...conditions))
          .orderBy(desc(trailConditionReports.createdAt))
          .limit(limit ?? 50);

        return reports.map(toReportResponse);
      } catch (error) {
        console.error('Error listing trail condition reports:', error);
        return status(500, { error: 'Failed to list trail condition reports' });
      }
    },
    {
      query: z.object({
        trailName: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).optional().default(50),
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
          .insert(trailConditionReports)
          .values({
            id: data.id,
            trailName: data.trailName,
            trailRegion: data.trailRegion ?? null,
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
            localCreatedAt: new Date(data.localCreatedAt),
            localUpdatedAt: new Date(data.localUpdatedAt),
          })
          .returning();

        if (!newReport) return status(400, { error: 'Failed to submit report' });

        return toReportResponse(newReport);
      } catch (error) {
        const pgCode = (error as { code?: string })?.code;
        if (pgCode === '23505') {
          const existing = await db.query.trailConditionReports.findFirst({
            where: and(
              eq(trailConditionReports.id, data.id),
              eq(trailConditionReports.userId, user.userId),
            ),
          });
          if (existing) return toReportResponse(existing);
          return status(409, { error: 'Report ID already in use by another user' });
        }
        console.error('Error creating trail condition report:', error);
        return status(500, { error: 'Failed to submit trail condition report' });
      }
    },
    {
      body: CreateReportRequestSchema,
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
          .select()
          .from(trailConditionReports)
          .where(and(...conditions))
          .orderBy(desc(trailConditionReports.createdAt));

        return reports.map(toReportResponse);
      } catch (error) {
        console.error('Error listing user trail condition reports:', error);
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
        console.error('Error updating trail condition report:', error);
        return status(500, { error: 'Failed to update trail condition report' });
      }
    },
    {
      params: z.object({ reportId: z.string() }),
      body: UpdateReportRequestSchema,
      isAuthenticated: true,
      detail: {
        tags: ['Trail Conditions'],
        summary: 'Update a trail condition report',
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
        console.error('Error deleting trail condition report:', error);
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
