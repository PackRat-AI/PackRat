import { Hono } from 'hono';
import { OfflineAIService } from '../services/offlineAIService';
import { z } from 'zod';

const tripContextSchema = z.object({
  destination: z.string().min(1, 'Destination is required'),
  duration: z.number().min(1).max(30),
  difficulty: z.enum(['easy', 'moderate', 'hard', 'expert']),
  season: z.enum(['spring', 'summer', 'fall', 'winter', 'any']),
  activities: z.array(z.string()).optional(),
});

const offlineAIRouter = new Hono<{ Bindings: Env }>()

  /**
   * POST /ai/offline/trip-recommendations
   * Get trip recommendations with offline-first support
   */
  .post('/trip-recommendations', async (c) => {
    try {
      const body = await c.req.json();
      const validated = tripContextSchema.parse(body);

      const service = new OfflineAIService(c);
      const recommendations = await service.getTripRecommendations(validated);

      return c.json({
        recommendations,
        meta: {
          offlineEnabled: true,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          { error: 'Validation error', details: error.errors },
          400,
        );
      }
      console.error('Offline AI trip recommendations error:', error);
      return c.json({ error: 'Failed to generate recommendations' }, 500);
    }
  })

  /**
   * POST /ai/offline/gear-recommendations
   * Get gear recommendations with offline support
   */
  .post('/gear-recommendations', async (c) => {
    try {
      const body = await c.req.json();
      const validated = tripContextSchema.parse(body);

      const service = new OfflineAIService(c);
      const recommendations = await service.getGearRecommendations(validated);

      return c.json({
        recommendations,
        meta: {
          offlineEnabled: true,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          { error: 'Validation error', details: error.errors },
          400,
        );
      }
      console.error('Offline AI gear recommendations error:', error);
      return c.json({ error: 'Failed to generate gear recommendations' }, 500);
    }
  })

  /**
   * GET /ai/offline/status
   * Check offline mode status and cache health
   */
  .get('/status', async (c) => {
    try {
      const service = new OfflineAIService(c);
      const isOffline = await service.isOffline();

      // Return mock cache status for demo
      const cacheStatus = {
        trips: { cached: false, age: null },
        gear: { cached: false, age: null },
      };

      return c.json({
        offlineMode: isOffline,
        cache: cacheStatus,
        features: {
          offlineRecommendations: true,
          localFallback: true,
          cachePersistence: true,
        },
      });
    } catch (error) {
      console.error('Offline AI status error:', error);
      return c.json({ error: 'Failed to get status' }, 500);
    }
  })

  /**
   * DELETE /ai/offline/cache
   * Clear all cached data
   */
  .delete('/cache', async (c) => {
    try {
      const service = new OfflineAIService(c);
      await service.clearCache();

      return c.json({
        success: true,
        message: 'Cache cleared successfully',
      });
    } catch (error) {
      console.error('Cache clear error:', error);
      return c.json({ error: 'Failed to clear cache' }, 500);
    }
  });

export { offlineAIRouter };
