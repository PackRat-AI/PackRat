import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { trailConditions } from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import {
  CreateTrailConditionRequestSchema,
  TrailConditionListResponseSchema,
  TrailConditionSchema,
} from '@packrat/api/schemas/trailConditions';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { desc, eq } from 'drizzle-orm';

const trailConditionListRoutes = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>();

// ------------------------------
// List Trail Conditions Route
// ------------------------------
const listTrailConditionsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Trail Conditions'],
  summary: 'List trail conditions',
  description: 'Get all trail condition reports ordered by most recent',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Trail conditions retrieved successfully',
      content: { 'application/json': { schema: TrailConditionListResponseSchema } },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

trailConditionListRoutes.openapi(listTrailConditionsRoute, async (c) => {
  try {
    const db = createDb(c);
    const items = await db.select().from(trailConditions).orderBy(desc(trailConditions.createdAt));

    return c.json({ items, total: items.length }, 200);
  } catch (error) {
    console.error('Error fetching trail conditions:', error);
    return c.json({ error: 'Failed to fetch trail conditions' }, 500);
  }
});

// ------------------------------
// Create Trail Condition Route
// ------------------------------
const createTrailConditionRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Trail Conditions'],
  summary: 'Create a trail condition report',
  description: 'Submit a new trail condition report with optional photos and GPS location',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: CreateTrailConditionRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Trail condition report created successfully',
      content: { 'application/json': { schema: TrailConditionSchema } },
    },
    400: {
      description: 'Bad request',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

trailConditionListRoutes.openapi(createTrailConditionRoute, async (c) => {
  const auth = c.get('user');
  const db = createDb(c);
  const data = await c.req.json();

  if (!data.id) return c.json({ error: 'Trail condition ID is required' }, 400);

  try {
    // Compute initial trust score based on reporter history
    const existingReports = await db
      .select()
      .from(trailConditions)
      .where(eq(trailConditions.userId, auth.userId));

    // Trust score starts at 0.5 for new reporters, increasing with more reports
    const baseScore = Math.min(0.5 + existingReports.length * 0.05, 0.9);

    const [newReport] = await db
      .insert(trailConditions)
      .values({
        id: data.id,
        userId: auth.userId,
        trailName: data.trailName,
        location: data.location ?? null,
        condition: data.condition,
        details: data.details,
        photos: data.photos ?? [],
        trustScore: baseScore,
        verifiedCount: 0,
        helpfulCount: 0,
      })
      .returning();

    if (!newReport) return c.json({ error: 'Failed to create trail condition report' }, 400);

    return c.json(newReport, 200);
  } catch (error) {
    console.error('Error creating trail condition:', error);
    return c.json({ error: 'Failed to create trail condition report' }, 500);
  }
});

export { trailConditionListRoutes };
