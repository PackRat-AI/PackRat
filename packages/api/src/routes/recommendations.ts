import { Hono } from 'hono';
import { TripRecommendationService } from '../services/tripRecommendationService';
import { z } from 'zod';

const tripRecommendationSchema = z.object({
  destination: z.string().min(1, 'Destination is required'),
  duration: z.number().min(1).max(30).optional(),
  difficulty: z.enum(['easy', 'moderate', 'hard', 'expert']).optional(),
  season: z.enum(['spring', 'summer', 'fall', 'winter', 'any']).optional(),
  activities: z.array(z.string()).optional(),
});

const recommendationsRouter = new Hono<{ Bindings: Env }>()

  /**
   * POST /trips/recommendations
   * Get AI-powered trip recommendations
   */
  .post('/recommendations', async (c) => {
    try {
      const body = await c.req.json();
      const validated = tripRecommendationSchema.parse(body);

      const service = new TripRecommendationService(c);
      const recommendations = await service.getRecommendations(validated);

      return c.json(recommendations);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          { error: 'Validation error', details: error.errors },
          400,
        );
      }
      console.error('Trip recommendations error:', error);
      return c.json({ error: 'Failed to generate recommendations' }, 500);
    }
  })

  /**
   * POST /trips/:tripId/gear-recommendations
   * Get AI-powered gear recommendations for a specific trip
   */
  .post('/:tripId/gear-recommendations', async (c) => {
    try {
      const tripId = c.req.param('tripId');
      // In production, fetch trip from database
      const trip = { id: tripId, destination: 'Unknown', activities: [] };

      const service = new TripRecommendationService(c);
      const gear = await service.getGearRecommendations(trip as any);

      return c.json({ tripId, recommendedGear: gear });
    } catch (error) {
      console.error('Gear recommendations error:', error);
      return c.json({ error: 'Failed to generate gear recommendations' }, 500);
    }
  });

export { recommendationsRouter };
