import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDb } from '../db';
import { natureIdentifications } from '../drizzle/natureLens';
import { identifyImage } from '../services/natureLensService';
import type { Env } from '../types/env';
import type { Variables } from '../types/variables';

const natureLens = new Hono<{ Bindings: Env; Variables: Variables }>();

// POST /api/nature-lens/identify
// Identify plant or wildlife from image
natureLens.post('/identify', async (c) => {
  const { userId } = c.get('user');

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
    const { OPENAI_API_KEY } = c.env;
    const db = createDb(c);

    // Call AI to identify the image
    const identification = await identifyImage(imageUrl || imageBase64, {
      includeDescription: true,
      includeHabitat: true,
      includeEdibleInfo: true,
      includeDangerInfo: true,
      apiKey: OPENAI_API_KEY,
    });

    const id = crypto.randomUUID();
    await db.insert(natureIdentifications).values({
      id,
      userId,
      imageUrl: imageUrl || null,
      speciesName: identification.speciesName,
      speciesCommonName: identification.commonName,
      confidence: identification.confidence,
      category: identification.category,
      description: identification.description,
      habitat: identification.habitat,
      isEdible: identification.isEdible ? 1 : 0,
      isDangerous: identification.isDangerous ? 1 : 0,
      latitude,
      longitude,
      locationName: locationName || null,
      isOffline: 0,
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
  const { userId } = c.get('user');
  const db = createDb(c);

  const identifications = await db
    .select()
    .from(natureIdentifications)
    .where(eq(natureIdentifications.userId, userId))
    .orderBy(desc(natureIdentifications.createdAt))
    .limit(50);

  return c.json({ identifications });
});

// GET /api/nature-lens/:id
// Get single identification
natureLens.get('/:id', async (c) => {
  const { userId } = c.get('user');
  const id = c.req.param('id');
  const db = createDb(c);

  const [identification] = await db
    .select()
    .from(natureIdentifications)
    .where(and(eq(natureIdentifications.id, id), eq(natureIdentifications.userId, userId)))
    .limit(1);

  if (!identification) {
    return c.json({ error: 'Not found' }, 404);
  }

  return c.json({ identification });
});

// DELETE /api/nature-lens/:id
// Delete an identification
natureLens.delete('/:id', async (c) => {
  const { userId } = c.get('user');
  const id = c.req.param('id');
  const db = createDb(c);

  await db
    .delete(natureIdentifications)
    .where(and(eq(natureIdentifications.id, id), eq(natureIdentifications.userId, userId)));

  return c.json({ success: true });
});

export default natureLens;
