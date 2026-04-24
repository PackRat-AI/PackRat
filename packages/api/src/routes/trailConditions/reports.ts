import { createRoute, defineOpenAPIRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import type { NewTrailConditionReport } from '@packrat/api/db/schema';
import { trailConditionReports } from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import type { Env } from '@packrat/api/types/env';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import type { Variables } from '@packrat/api/types/variables';
import { and, desc, eq, gte, ilike, type SQL } from 'drizzle-orm';

// ------------------------------
// Zod schemas
// ------------------------------

const TrailConditionReportSchema = z.object({
  id: z.string(),
  trailName: z.string(),
  trailRegion: z.string().nullable().optional(),
  surface: z.enum(['paved', 'gravel', 'dirt', 'rocky', 'snow', 'mud']),
  overallCondition: z.enum(['excellent', 'good', 'fair', 'poor']),
  hazards: z.array(z.string()).default([]),
  waterCrossings: z.number().int().default(0),
  waterCrossingDifficulty: z.enum(['easy', 'moderate', 'difficult']).nullable().optional(),
  notes: z.string().nullable().optional(),
  photos: z.array(z.string()).default([]),
  userId: z.number(),
  tripId: z.string().nullable().optional(),
  deleted: z.boolean(),
  localCreatedAt: z.string().datetime(),
  localUpdatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

type TrailConditionReportResponse = z.infer<typeof TrailConditionReportSchema>;

/** Cast a DB row (with Date fields and broad string types) to the API response shape. */
function toReportResponse(row: Record<string, unknown>): TrailConditionReportResponse {
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
    // DB row spread satisfies the shape; cast is needed because spread of
    // Record<string, unknown> loses field-level type information.
  } as TrailConditionReportResponse;
}

const CreateReportRequestSchema = z.object({
  id: z.string().openapi({ example: 'tcr_123456', description: 'Client-generated report ID' }),
  trailName: z.string().min(1).openapi({ example: 'Appalachian Trail - Springer Mountain' }),
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

// ------------------------------
// List Reports Route
// ------------------------------
export const listReportsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Trail Conditions'],
  summary: 'List trail condition reports',
  description: 'List recent trail condition reports, optionally filtered by trail name',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      trailName: z.string().optional().openapi({ description: 'Filter by trail name' }),
      limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    }),
  },
  responses: {
    200: {
      description: 'Reports retrieved successfully',
      content: { 'application/json': { schema: z.array(TrailConditionReportSchema) } },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

export const listReportsHandler: RouteHandler<typeof listReportsRoute> = async (c) => {
  const db = createDb(c);
  const { trailName, limit } = c.req.valid('query');

  try {
    const conditions = [eq(trailConditionReports.deleted, false)];
    if (trailName) {
      // Use case-insensitive substring match so client-supplied trail names
      // (which often come from trip.location.name, possibly with extra region
      // suffixes or whitespace differences) surface relevant community reports.
      // Escape LIKE metacharacters to prevent pattern injection by users.
      const normalized = trailName.trim();
      if (normalized.length > 0) {
        const escaped = normalized.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
        conditions.push(ilike(trailConditionReports.trailName, `%${escaped}%`));
      }
    }

    const reports = await db
      .select()
      .from(trailConditionReports)
      .where(and(...conditions))
      .orderBy(desc(trailConditionReports.createdAt))
      .limit(limit ?? 50);

    return c.json(reports.map(toReportResponse), 200);
  } catch (error) {
    console.error('Error listing trail condition reports:', error);
    return c.json({ error: 'Failed to list trail condition reports' }, 500);
  }
};

// ------------------------------
// Create Report Route
// ------------------------------
export const createReportRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Trail Conditions'],
  summary: 'Submit a trail condition report',
  description: 'Submit a new trail condition report',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: CreateReportRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Report submitted successfully',
      content: { 'application/json': { schema: TrailConditionReportSchema } },
    },
    400: {
      description: 'Bad request',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    409: {
      description: 'Report ID already in use by another user',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

export const createReportHandler: RouteHandler<typeof createReportRoute> = async (c) => {
  const auth = c.get('user');
  const db = createDb(c);
  const data = c.req.valid('json');

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
        userId: auth.userId,
        tripId: data.tripId ?? null,
        deleted: false,
        localCreatedAt: new Date(data.localCreatedAt),
        localUpdatedAt: new Date(data.localUpdatedAt),
      })
      .returning();

    if (!newReport) return c.json({ error: 'Failed to submit report' }, 400);

    return c.json(toReportResponse(newReport), 200);
  } catch (error) {
    // Postgres unique violation (23505): the offline client is retrying a report
    // it already committed. Return the existing row so the client can settle.
    const pgCode = (error as { code?: string })?.code;
    if (pgCode === '23505') {
      const existing = await db.query.trailConditionReports.findFirst({
        where: and(
          eq(trailConditionReports.id, data.id),
          eq(trailConditionReports.userId, auth.userId),
        ),
      });
      if (existing) return c.json(toReportResponse(existing), 200);
      // Same id but different user — treat as a real conflict
      return c.json({ error: 'Report ID already in use by another user' }, 409);
    }
    console.error('Error creating trail condition report:', error);
    return c.json({ error: 'Failed to submit trail condition report' }, 500);
  }
};

// ------------------------------
// List My Reports Route  (static path — registered before /{reportId})
// ------------------------------
export const listMyReportsRoute = createRoute({
  method: 'get',
  path: '/mine',
  tags: ['Trail Conditions'],
  summary: 'List my trail condition reports',
  description: 'List trail condition reports submitted by the authenticated user',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      updatedAt: z
        .string()
        .datetime()
        .optional()
        .openapi({ description: 'Only return reports updated after this timestamp' }),
    }),
  },
  responses: {
    200: {
      description: 'Reports retrieved successfully',
      content: { 'application/json': { schema: z.array(TrailConditionReportSchema) } },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

export const listMyReportsHandler: RouteHandler<typeof listMyReportsRoute> = async (c) => {
  const auth = c.get('user');
  const db = createDb(c);
  const { updatedAt } = c.req.valid('query');

  try {
    const conditions: SQL[] = [
      eq(trailConditionReports.userId, auth.userId),
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

    return c.json(reports.map(toReportResponse), 200);
  } catch (error) {
    console.error('Error listing user trail condition reports:', error);
    return c.json({ error: 'Failed to list trail condition reports' }, 500);
  }
};

// ------------------------------
// Update Report Route
// ------------------------------
export const updateReportRoute = createRoute({
  method: 'put',
  path: '/{reportId}',
  tags: ['Trail Conditions'],
  summary: 'Update a trail condition report',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ reportId: z.string().openapi({ example: 'tcr_123456' }) }),
    body: {
      content: {
        'application/json': {
          schema: CreateReportRequestSchema.omit({ id: true, localCreatedAt: true }).partial(),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Report updated successfully',
      content: { 'application/json': { schema: TrailConditionReportSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

export const updateReportHandler: RouteHandler<typeof updateReportRoute> = async (c) => {
  const auth = c.get('user');
  const db = createDb(c);
  const reportId = c.req.param('reportId');
  const data = c.req.valid('json');

  try {
    const updateData: Partial<NewTrailConditionReport> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if ('trailName' in data) updateData.trailName = data.trailName;
    if ('trailRegion' in data) updateData.trailRegion = data.trailRegion ?? null;
    if ('surface' in data) updateData.surface = data.surface;
    if ('overallCondition' in data) updateData.overallCondition = data.overallCondition;
    if ('hazards' in data) updateData.hazards = data.hazards ?? [];
    if ('waterCrossings' in data) updateData.waterCrossings = data.waterCrossings ?? 0;
    if ('waterCrossingDifficulty' in data)
      updateData.waterCrossingDifficulty = data.waterCrossingDifficulty ?? null;
    if ('notes' in data) updateData.notes = data.notes ?? null;
    if ('photos' in data) updateData.photos = data.photos ?? [];
    if ('localUpdatedAt' in data)
      updateData.localUpdatedAt = data.localUpdatedAt ? new Date(data.localUpdatedAt) : new Date();

    const [updated] = await db
      .update(trailConditionReports)
      .set(updateData)
      .where(
        and(eq(trailConditionReports.id, reportId), eq(trailConditionReports.userId, auth.userId)),
      )
      .returning();

    if (!updated) return c.json({ error: 'Report not found or unauthorized' }, 403);

    return c.json(toReportResponse(updated), 200);
  } catch (error) {
    console.error('Error updating trail condition report:', error);
    return c.json({ error: 'Failed to update trail condition report' }, 500);
  }
};

// ------------------------------
// Delete Report Route
// ------------------------------
export const deleteReportRoute = createRoute({
  method: 'delete',
  path: '/{reportId}',
  tags: ['Trail Conditions'],
  summary: 'Delete a trail condition report',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ reportId: z.string().openapi({ example: 'tcr_123456' }) }),
  },
  responses: {
    200: {
      description: 'Report deleted successfully',
      content: { 'application/json': { schema: z.object({ success: z.boolean() }) } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

export const deleteReportHandler: RouteHandler<typeof deleteReportRoute> = async (c) => {
  const auth = c.get('user');
  const db = createDb(c);
  const reportId = c.req.param('reportId');

  try {
    const [deleted] = await db
      .update(trailConditionReports)
      .set({ deleted: true, updatedAt: new Date() })
      .where(
        and(eq(trailConditionReports.id, reportId), eq(trailConditionReports.userId, auth.userId)),
      )
      .returning();

    if (!deleted) return c.json({ error: 'Report not found or unauthorized' }, 403);

    return c.json({ success: true }, 200);
  } catch (error) {
    console.error('Error deleting trail condition report:', error);
    return c.json({ error: 'Failed to delete trail condition report' }, 500);
  }
};

const trailConditionOpenApiRoutes = [
  defineOpenAPIRoute({ route: listReportsRoute, handler: listReportsHandler }),
  defineOpenAPIRoute({ route: createReportRoute, handler: createReportHandler }),
  defineOpenAPIRoute({ route: listMyReportsRoute, handler: listMyReportsHandler }),
  defineOpenAPIRoute({ route: updateReportRoute, handler: updateReportHandler }),
  defineOpenAPIRoute({ route: deleteReportRoute, handler: deleteReportHandler }),
] as const;

const trailConditionRoutes = new OpenAPIHono<{
  Bindings: Env;
  Variables: Variables;
}>().openapiRoutes(trailConditionOpenApiRoutes);

export { trailConditionOpenApiRoutes, trailConditionRoutes };
