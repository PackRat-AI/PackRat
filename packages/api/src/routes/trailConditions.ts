import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { getCookie } from 'hono/cookie';
import { trailConditions, trailConditionVerifications } from '../drizzle/trailConditions';
import { users } from '../db/schema';

const trailConditionsRoute = new Hono();

// Middleware: Get current user
const getUser = async (c: any) => {
  const sessionToken = getCookie(c, 'session');
  if (!sessionToken) return null;
  
  const dbSql = neon(process.env.DATABASE_URL!);
  const db = drizzle(dbSql);
  
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.sessionToken, sessionToken))
    .limit(1);
    
  return user || null;
};

// POST /api/trail-conditions
// Submit a new trail condition report
trailConditionsRoute.post('/', async (c) => {
  const user = await getUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const {
    trailId,
    trailName,
    latitude,
    longitude,
    locationName,
    surfaceCondition,
    difficulty,
    hasFallenTrees,
    hasWildlife,
    hasErosion,
    hasClosures,
    hasWaterCrossings,
    waterCrossingCount,
    waterDepth,
    waterDifficulty,
    photoUrls,
    notes,
  } = body;

  if (!trailName) {
    return c.json({ error: 'Trail name is required' }, 400);
  }

  try {
    const dbSql = neon(process.env.DATABASE_URL!);
    const db = drizzle(dbSql);

    const id = crypto.randomUUID();
    
    // Calculate trust score based on user history
    const [userReportCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(trailConditions)
      .where(eq(trailConditions.userId, user.id));
    
    const trustScore = Math.min(1 + (userReportCount?.count || 0) * 0.1, 5);

    await db.insert(trailConditions).values({
      id,
      userId: user.id,
      trailId: trailId || null,
      trailName,
      latitude: latitude || null,
      longitude: longitude || null,
      locationName: locationName || null,
      surfaceCondition: surfaceCondition || null,
      difficulty: difficulty || null,
      hasFallenTrees: hasFallenTrees || false,
      hasWildlife: hasWildlife || false,
      hasErosion: hasErosion || false,
      hasClosures: hasClosures || false,
      hasWaterCrossings: hasWaterCrossings || false,
      waterCrossingCount: waterCrossingCount || null,
      waterDepth: waterDepth || null,
      waterDifficulty: waterDifficulty || null,
      photoUrls: photoUrls || [],
      notes: notes || null,
      trustScore,
      isOffline: false,
    });

    const [result] = await db
      .select()
      .from(trailConditions)
      .where(eq(trailConditions.id, id))
      .limit(1);

    return c.json({ condition: result }, 201);
  } catch (error) {
    console.error('Trail condition creation error:', error);
    return c.json({ error: 'Failed to create trail condition report' }, 500);
  }
});

// GET /api/trail-conditions
// Get recent trail conditions (optionally filtered by trail)
trailConditionsRoute.get('/', async (c) => {
  const user = await getUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const trailId = c.req.query('trailId');
  const trailName = c.req.query('trailName');
  const days = parseInt(c.req.query('days') || '30');

  try {
    const dbSql = neon(process.env.DATABASE_URL!);
    const db = drizzle(dbSql);

    let query = db
      .select()
      .from(trailConditions)
      .where(gte(trailConditions.reportedAt, sql<Date>`NOW() - INTERVAL '${days} days'`))
      .orderBy(desc(trailConditions.reportedAt))
      .limit(50);

    if (trailId) {
      query = db
        .select()
        .from(trailConditions)
        .where(and(
          eq(trailConditions.trailId, trailId),
          gte(trailConditions.reportedAt, sql<Date>`NOW() - INTERVAL '${days} days'`)
        ))
        .orderBy(desc(trailConditions.reportedAt))
        .limit(50);
    } else if (trailName) {
      query = db
        .select()
        .from(trailConditions)
        .where(and(
          sql`${trailConditions.trailName} ILIKE ${`%${trailName}%`}`,
          gte(trailConditions.reportedAt, sql<Date>`NOW() - INTERVAL '${days} days'`)
        ))
        .orderBy(desc(trailConditions.reportedAt))
        .limit(50);
    }

    const conditions = await query;
    return c.json({ conditions });
  } catch (error) {
    console.error('Trail conditions fetch error:', error);
    return c.json({ error: 'Failed to fetch trail conditions' }, 500);
  }
});

// GET /api/trail-conditions/:id
// Get single trail condition
trailConditionsRoute.get('/:id', async (c) => {
  const user = await getUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');
  const dbSql = neon(process.env.DATABASE_URL!);
  const db = drizzle(dbSql);

  const [condition] = await db
    .select()
    .from(trailConditions)
    .where(eq(trailConditions.id, id))
    .limit(1);

  if (!condition) {
    return c.json({ error: 'Not found' }, 404);
  }

  // Get verifications
  const verifications = await db
    .select()
    .from(trailConditionVerifications)
    .where(eq(trailConditionVerifications.conditionId, id));

  return c.json({ condition, verifications });
});

// POST /api/trail-conditions/:id/verify
// Verify a trail condition report
trailConditionsRoute.post('/:id/verify', async (c) => {
  const user = await getUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');
  const { isAccurate, notes } = await c.req.json();

  const dbSql = neon(process.env.DATABASE_URL!);
  const db = drizzle(dbSql);

  // Check if condition exists
  const [condition] = await db
    .select()
    .from(trailConditions)
    .where(eq(trailConditions.id, id))
    .limit(1);

  if (!condition) {
    return c.json({ error: 'Not found' }, 404);
  }

  // Check if user already verified
  const [existing] = await db
    .select()
    .from(trailConditionVerifications)
    .where(and(
      eq(trailConditionVerifications.conditionId, id),
      eq(trailConditionVerifications.userId, user.id)
    ))
    .limit(1);

  if (existing) {
    return c.json({ error: 'Already verified' }, 409);
  }

  // Add verification
  await db.insert(trailConditionVerifications).values({
    id: crypto.randomUUID(),
    conditionId: id,
    userId: user.id,
    isAccurate,
    notes: notes || null,
  });

  // Update condition verified count
  await db
    .update(trailConditions)
    .set({ 
      verifiedCount: sql`${trailConditions.verifiedCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(trailConditions.id, id));

  return c.json({ success: true });
});

// DELETE /api/trail-conditions/:id
// Delete a trail condition report (only by owner)
trailConditionsRoute.delete('/:id', async (c) => {
  const user = await getUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');
  const dbSql = neon(process.env.DATABASE_URL!);
  const db = drizzle(dbSql);

  await db
    .delete(trailConditions)
    .where(and(
      eq(trailConditions.id, id),
      eq(trailConditions.userId, user.id)
    ));

  return c.json({ success: true });
});

export default trailConditionsRoute;
