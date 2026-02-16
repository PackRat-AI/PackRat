import { Hono } from 'hono';
import { GearRecommendationService } from '../services/gearRecommendationService';
import { z } from 'zod';

const gearPreferencesSchema = z.object({
  activities: z.array(z.string()).optional(),
  budget: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .optional(),
  weightPreference: z.enum(['lightweight', 'standard', 'ultralight']).optional(),
  experience: z.enum(['beginner', 'intermediate', 'expert']).optional(),
});

const tripContextSchema = z.object({
  destination: z.string().min(1, 'Destination is required'),
  duration: z.number().min(1).max(30),
  season: z.enum(['spring', 'summer', 'fall', 'winter', 'any']),
  activities: z.array(z.string()).optional(),
});

const gearRecommendationRequestSchema = z.object({
  preferences: gearPreferencesSchema.optional(),
  tripContext: tripContextSchema,
  limit: z.number().min(1).max(20).optional(),
});

const gearRouter = new Hono<{ Bindings: Env }>()

  /**
   * POST /gear/recommendations
   * Get personalized gear recommendations based on trip context
   */
  .post('/recommendations', async (c) => {
    try {
      const body = await c.req.json();
      const validated = gearRecommendationRequestSchema.parse(body);

      const service = new GearRecommendationService(c);
      const recommendations = await service.getRecommendations(
        validated.preferences || {},
        validated.tripContext,
        validated.limit,
      );

      return c.json({ recommendations });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          { error: 'Validation error', details: error.errors },
          400,
        );
      }
      console.error('Gear recommendations error:', error);
      return c.json({ error: 'Failed to generate gear recommendations' }, 500);
    }
  })

  /**
   * POST /gear/similar-trip
   * Get gear recommendations based on similar trips
   */
  .post('/similar-trip', async (c) => {
    try {
      const { tripId, limit } = await c.req.json().catch(() => ({ tripId: '', limit: 5 }));

      if (!tripId) {
        return c.json({ error: 'tripId is required' }, 400);
      }

      const service = new GearRecommendationService(c);
      const recommendations = await service.getSimilarTripGear(tripId, limit);

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
    try {
      const { currentItems, tripContext } = await c.req.json();

      if (!currentItems || !tripContext) {
        return c.json(
          { error: 'currentItems and tripContext are required' },
          400,
        );
      }

      const service = new GearRecommendationService(c);
      const analysis = await service.analyzePack(currentItems, tripContext);

      return c.json(analysis);
    } catch (error) {
      console.error('Pack analysis error:', error);
      return c.json({ error: 'Failed to analyze pack' }, 500);
    }
  });

export { gearRouter };
