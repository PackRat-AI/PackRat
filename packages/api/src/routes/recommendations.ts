import { Hono } from 'hono';
import { TripRecommendationService } from '../services/tripRecommendationService';
import { validateBody, z } from '@packrat/api/schemas/validation';

const tripRecommendationSchema = z.object({
  destination: z.string().min(1, 'Destination is required'),
  duration: z.number().int().positive().max(30).default(3),
  difficulty: z.enum(['easy', 'moderate', 'hard', 'expert']).default('moderate'),
  season: z.enum(['spring', 'summer', 'fall', 'winter', 'any']).default('any'),
  activities: z.array(z.string()).default([]),
});

const gearRecommendationsForTripSchema = z.object({
  tripId: z.string().uuid('Invalid trip ID format'),
});

const recommendationsRouter = new Hono<{ Bindings: Env }>()

  /**
   * POST /trips/recommendations
   * Get AI-powered trip recommendations
   */
  .post('/recommendations', async (c) => {
    const validation = validateBody(await c.req.json(), tripRecommendationSchema);

    if (!validation.success) {
      return c.json(validation.error, 400);
    }

    try {
      const service = new TripRecommendationService(c);
      const recommendations = await service.getRecommendations(validation.data);

      return c.json(recommendations);
    } catch (error) {
      console.error('Trip recommendations error:', error);
      return c.json({ error: 'Failed to generate recommendations' }, 500);
    }
  })

  /**
   * POST /trips/:tripId/gear-recommendations
   * Get AI-powered gear recommendations for a specific trip
   */
  .post('/:tripId/gear-recommendations', async (c) => {
    const validation = validateBody(
      { tripId: c.req.param('tripId') },
      gearRecommendationsForTripSchema,
    );

    if (!validation.success) {
      return c.json(validation.error, 400);
    }

    try {
      const tripId = validation.data.tripId;
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
