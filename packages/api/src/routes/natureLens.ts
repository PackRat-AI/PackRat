import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, desc, and } from 'drizzle-orm';
import { getCookie } from 'hono/cookie';
import { natureIdentifications } from '../drizzle/natureLens';
import { users } from '../db/schema';
import { identifyImage } from '../services/natureLensService';
import { getEnv } from '../utils/env-validation';

const natureLens = new Hono();

// Middleware: Get current user
const getUser = async (c: any) => {
  const sessionToken = getCookie(c, 'session');
  if (!sessionToken) return null;
  
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);
  
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.sessionToken, sessionToken))
    .limit(1);
    
  return user || null;
};

// POST /api/nature-lens/identify
// Identify plant or wildlife from image
natureLens.post('/identify', async (c) => {
  const user = await getUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const formData = await c.req.parseBody();
  const imageUrl = formData.imageUrl as string;
  const imageBase64 = formData.imageBase64 as string;
  const latitude = formData.latitude ? parseFloat(formData.latitude as string) : null;
  const longitude = formData.longitude ? parseFloat(formData.longitude as string) : null;
  const locationName = formData.locationName as string;

  if (!imageUrl && !imageBase64) {
    return c.json({ error: 'Image required' }, 400);
  }

  try {
    const { OPENAI_API_KEY } = getEnv(c);
    
    // Call AI to identify the image
    const identification = await identifyImage(imageUrl || imageBase64!, {
      includeDescription: true,
      includeHabitat: true,
      includeEdibleInfo: true,
      includeDangerInfo: true,
    }, OPENAI_API_KEY);

    const sql = neon(process.env.DATABASE_URL!);
    const db = drizzle(sql);

    const id = crypto.randomUUID();
    await db.insert(natureIdentifications).values({
      id,
      userId: user.id,
      imageUrl: imageUrl || null,
      speciesName: identification.speciesName,
      speciesCommonName: identification.commonName,
      confidence: identification.confidence,
      category: identification.category,
      description: identification.description,
      habitat: identification.habitat,
      isEdible: identification.isEdible,
      isDangerous: identification.isDangerous,
      latitude,
      longitude,
      locationName: locationName || null,
      isOffline: false,
    });

    const [result] = await db
      .select()
      .from(natureIdentifications)
      .where(eq(natureIdentifications.id, id))
      .limit(1);

    return c.json({ identification: result });
  } catch (error) {
    console.error('NatureLens identification error:', error);
    return c.json({ error: 'Identification failed' }, 500);
  }
});

// GET /api/nature-lens/identifications
// Get user's identification history
natureLens.get('/identifications', async (c) => {
  const user = await getUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  const identifications = await db
    .select()
    .from(natureIdentifications)
    .where(eq(natureIdentifications.userId, user.id))
    .orderBy(desc(natureIdentifications.createdAt))
    .limit(50);

  return c.json({ identifications });
});

// GET /api/nature-lens/:id
// Get single identification
natureLens.get('/:id', async (c) => {
  const user = await getUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  const [identification] = await db
    .select()
    .from(natureIdentifications)
    .where(and(
      eq(natureIdentifications.id, id),
      eq(natureIdentifications.userId, user.id)
    ))
    .limit(1);

  if (!identification) {
    return c.json({ error: 'Not found' }, 404);
  }

  return c.json({ identification });
});

// DELETE /api/nature-lens/:id
// Delete an identification
natureLens.delete('/:id', async (c) => {
  const user = await getUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  await db
    .delete(natureIdentifications)
    .where(and(
      eq(natureIdentifications.id, id),
      eq(natureIdentifications.userId, user.id)
    ));

  return c.json({ success: true });
});

export default natureLens;
