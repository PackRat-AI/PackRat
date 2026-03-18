import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { trailConditions } from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import { TrailConditionSchema } from '@packrat/api/schemas/trailConditions';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { and, eq, ne, sql } from 'drizzle-orm';

const trailConditionRoutes = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>();

// ------------------------------
// Get Trail Condition by ID Route
// ------------------------------
const getTrailConditionRoute = createRoute({
  method: 'get',
  path: '/{reportId}',
  tags: ['Trail Conditions'],
  summary: 'Get trail condition report by ID',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ reportId: z.string().openapi({ example: 'tc_123456' }) }),
  },
  responses: {
    200: {
      description: 'Trail condition report retrieved successfully',
      content: { 'application/json': { schema: TrailConditionSchema } },
    },
    404: {
      description: 'Report not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

trailConditionRoutes.openapi(getTrailConditionRoute, async (c) => {
  const db = createDb(c);
  const reportId = c.req.param('reportId');

  const report = await db.query.trailConditions.findFirst({
    where: eq(trailConditions.id, reportId),
  });

  if (!report) return c.json({ error: 'Trail condition report not found' }, 404);
  return c.json(report, 200);
});

// ------------------------------
// Delete Trail Condition Route
// ------------------------------
const deleteTrailConditionRoute = createRoute({
  method: 'delete',
  path: '/{reportId}',
  tags: ['Trail Conditions'],
  summary: 'Delete a trail condition report',
  description: 'Delete a trail condition report owned by the authenticated user',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ reportId: z.string().openapi({ example: 'tc_123456' }) }),
  },
  responses: {
    200: {
      description: 'Trail condition report deleted successfully',
      content: { 'application/json': { schema: z.object({ success: z.boolean() }) } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Report not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

trailConditionRoutes.openapi(deleteTrailConditionRoute, async (c) => {
  const auth = c.get('user');
  const db = createDb(c);
  const reportId = c.req.param('reportId');

  try {
    const report = await db.query.trailConditions.findFirst({
      where: and(eq(trailConditions.id, reportId), eq(trailConditions.userId, auth.userId)),
    });

    if (!report) return c.json({ error: 'Report not found or unauthorized' }, 403);

    await db
      .delete(trailConditions)
      .where(and(eq(trailConditions.id, reportId), eq(trailConditions.userId, auth.userId)));

    return c.json({ success: true }, 200);
  } catch (error) {
    console.error('Error deleting trail condition:', error);
    return c.json({ error: 'Failed to delete trail condition report' }, 500);
  }
});

// ------------------------------
// Verify Trail Condition Route
// ------------------------------
const verifyTrailConditionRoute = createRoute({
  method: 'post',
  path: '/{reportId}/verify',
  tags: ['Trail Conditions'],
  summary: 'Verify a trail condition report',
  description: 'Mark a trail condition report as verified, increasing its trust score',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ reportId: z.string().openapi({ example: 'tc_123456' }) }),
  },
  responses: {
    200: {
      description: 'Trail condition report verified successfully',
      content: { 'application/json': { schema: TrailConditionSchema } },
    },
    403: {
      description: 'Cannot verify your own report',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Report not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

trailConditionRoutes.openapi(verifyTrailConditionRoute, async (c) => {
  const auth = c.get('user');
  const db = createDb(c);
  const reportId = c.req.param('reportId');

  try {
    const [updatedReport] = await db
      .update(trailConditions)
      .set({
        verifiedCount: sql`${trailConditions.verifiedCount} + 1`,
        trustScore: sql`LEAST(${trailConditions.trustScore} + 0.05, 0.99)`,
        updatedAt: new Date(),
      })
      .where(and(eq(trailConditions.id, reportId), ne(trailConditions.userId, auth.userId)))
      .returning();

    if (updatedReport) return c.json(updatedReport, 200);

    // Update returned no row — determine whether the report is missing or authored by the requester
    const report = await db.query.trailConditions.findFirst({
      where: eq(trailConditions.id, reportId),
      columns: { userId: true },
    });
    if (!report) return c.json({ error: 'Trail condition report not found' }, 404);
    return c.json({ error: 'Cannot verify your own report' }, 403);
  } catch (error) {
    console.error('Error verifying trail condition:', error);
    return c.json({ error: 'Failed to verify trail condition report' }, 500);
  }
});

// ------------------------------
// Mark Helpful Route
// ------------------------------
const markHelpfulRoute = createRoute({
  method: 'post',
  path: '/{reportId}/helpful',
  tags: ['Trail Conditions'],
  summary: 'Mark a trail condition report as helpful',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ reportId: z.string().openapi({ example: 'tc_123456' }) }),
  },
  responses: {
    200: {
      description: 'Report marked as helpful',
      content: { 'application/json': { schema: TrailConditionSchema } },
    },
    403: {
      description: 'Cannot mark your own report as helpful',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Report not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

trailConditionRoutes.openapi(markHelpfulRoute, async (c) => {
  const auth = c.get('user');
  const db = createDb(c);
  const reportId = c.req.param('reportId');

  try {
    const [updatedReport] = await db
      .update(trailConditions)
      .set({
        helpfulCount: sql`${trailConditions.helpfulCount} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(trailConditions.id, reportId), ne(trailConditions.userId, auth.userId)))
      .returning();

    if (updatedReport) return c.json(updatedReport, 200);

    // Update returned no row — determine whether the report is missing or authored by the requester
    const report = await db.query.trailConditions.findFirst({
      where: eq(trailConditions.id, reportId),
      columns: { userId: true },
    });
    if (!report) return c.json({ error: 'Trail condition report not found' }, 404);
    return c.json({ error: 'Cannot mark your own report as helpful' }, 403);
  } catch (error) {
    console.error('Error marking trail condition as helpful:', error);
    return c.json({ error: 'Failed to mark trail condition as helpful' }, 500);
  }
});

export { trailConditionRoutes };
