import { Hono } from 'hono';
import { GearRecommendationService } from '../services/gearRecommendationService';
import {
  gearRecommendationRequestSchema,
  validateBody,
  z,
} from '@packrat/api/schemas/validation';

const similarTripSchema = z.object({
  tripId: z.string().uuid('Invalid trip ID format'),
  limit: z.number().int().positive().max(20).default(5),
});

const analyzePackSchema = z.object({
  currentItems: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      weight: z.number(),
      category: z.string(),
    }),
  ),
  tripContext: z.object({
    destination: z.string(),
    duration: z.number(),
    season: z.enum(['spring', 'summer', 'fall', 'winter', 'any']),
    activities: z.array(z.string()).optional(),
  }),
});

const gearRouter = new Hono<{ Bindings: Env }>()

  /**
   * POST /gear/recommendations
   * Get personalized gear recommendations based on trip context
   */
  .post('/recommendations', async (c) => {
    const validation = validateBody(await c.req.json(), gearRecommendationRequestSchema);

    if (!validation.success) {
      return c.json(validation.error, 400);
    }

    try {
      const service = new GearRecommendationService(c);
      const recommendations = await service.getRecommendations(
        validation.data.preferences || {},
        validation.data.tripContext,
        validation.data.limit,
      );

      return c.json({ recommendations });
    } catch (error) {
      console.error('Gear recommendations error:', error);
      return c.json({ error: 'Failed to generate gear recommendations' }, 500);
    }
  })

  /**
   * POST /gear/similar-trip
   * Get gear recommendations based on similar trips
   */
  .post('/similar-trip', async (c) => {
    const validation = validateBody(await c.req.json(), similarTripSchema);

    if (!validation.success) {
      return c.json(validation.error, 400);
    }

    try {
      const service = new GearRecommendationService(c);
      const recommendations = await service.getSimilarTripGear(
        validation.data.tripId,
        validation.data.limit,
      );

      return c.json({ recommendations });
    } catch (error) {
      console.error('Similar trip gear error:', error);
      return c.json({ error: 'Failed to get similar trip gear' }, 500);
    }
  })

  /**
   * POST /gear/analyze-pack
   * Analyze user's current pack and suggest improvements
   */
  .post('/analyze-pack', async (c) => {
    const validation = validateBody(await c.req.json(), analyzePackSchema);

    if (!validation.success) {
      return c.json(validation.error, 400);
    }

    try {
      const service = new GearRecommendationService(c);
      const analysis = await service.analyzePack(
        validation.data.currentItems,
        validation.data.tripContext,
      );

      return c.json(analysis);
    } catch (error) {
      console.error('Pack analysis error:', error);
      return c.json({ error: 'Failed to analyze pack' }, 500);
    }
  });

export { gearRouter };
