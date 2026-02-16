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

const batchRequestSchema = z.object({
  requests: z.array(tripContextSchema).min(1).max(10),
  types: z.array(z.enum(['trip', 'gear'])).min(1),
});

const conflictResolutionSchema = z.object({
  operationId: z.string().min(1),
  resolution: z.enum(['local', 'server', 'merged']),
  mergedData: z.unknown().optional(),
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
   * POST /ai/offline/batch
   * Get multiple recommendations in a single request
   */
  .post('/batch', async (c) => {
    try {
      const body = await c.req.json();
      const validated = batchRequestSchema.parse(body);

      const service = new OfflineAIService(c);
      const result = await service.getBatchRecommendations(validated);

      // Convert Map to plain object for JSON serialization
      const results: Record<string, unknown[]> = {};
      for (const [key, value] of result.results) {
        results[key] = value;
      }

      return c.json({
        results,
        errors: Object.fromEntries(result.errors),
        totalTime: result.totalTime,
        meta: {
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
      console.error('Batch recommendations error:', error);
      return c.json({ error: 'Failed to process batch recommendations' }, 500);
    }
  })

  /**
   * POST /ai/offline/invalidate-cache
   * Invalidate cache entries (smart invalidation)
   */
  .post('/invalidate-cache', async (c) => {
    try {
      const { pattern } = await c.req.json().catch(() => ({ pattern: undefined }));

      const service = new OfflineAIService(c);
      const result = await service.invalidateCache(pattern);

      return c.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Cache invalidation error:', error);
      return c.json({ error: 'Failed to invalidate cache' }, 500);
    }
  })

  /**
   * GET /ai/offline/sync/pending
   * Get pending sync operations for conflict resolution
   */
  .get('/sync/pending', async (c) => {
    try {
      const service = new OfflineAIService(c);
      const pending = await service.getPendingSyncs();

      return c.json({
        pending,
        count: pending.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Get pending syncs error:', error);
      return c.json({ error: 'Failed to get pending syncs' }, 500);
    }
  })

  /**
   * POST /ai/offline/sync/resolve
   * Resolve a conflict between local and server data
   */
  .post('/sync/resolve', async (c) => {
    try {
      const body = await c.req.json();
      const { operationId, resolution, mergedData } = conflictResolutionSchema.parse(body);

      const service = new OfflineAIService(c);
      const result = await service.resolveConflict(operationId, resolution, mergedData);

      if (!result) {
        return c.json({ error: 'Operation not found' }, 404);
      }

      return c.json({
        success: true,
        resolution: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          { error: 'Validation error', details: error.errors },
          400,
        );
      }
      console.error('Conflict resolution error:', error);
      return c.json({ error: 'Failed to resolve conflict' }, 500);
    }
  })

  /**
   * POST /ai/offline/sync/trigger
   * Trigger sync of pending operations
   */
  .post('/sync/trigger', async (c) => {
    try {
      const service = new OfflineAIService(c);
      const result = await service.triggerSync();

      return c.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Sync trigger error:', error);
      return c.json({ error: 'Failed to trigger sync' }, 500);
    }
  })

  /**
   * GET /ai/offline/status
   * Check offline mode status and cache health (enhanced)
   */
  .get('/status', async (c) => {
    try {
      const service = new OfflineAIService(c);
      const isOffline = await service.isOffline();

      // Get enhanced cache status with version info
      const sampleContext: z.infer<typeof tripContextSchema> = {
        destination: 'any',
        duration: 1,
        difficulty: 'moderate',
        season: 'any',
      };

      const cacheStatus = await service.getCacheStatus(sampleContext as any);

      return c.json({
        offlineMode: isOffline,
        cache: cacheStatus,
        features: {
          offlineRecommendations: true,
          localFallback: true,
          cachePersistence: true,
          batchOperations: true,
          conflictResolution: true,
          smartCacheInvalidation: true,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Offline AI status error:', error);
      return c.json({ error: 'Failed to get status' }, 500);
    }
  })

  /**
   * GET /ai/offline/metrics
   * Get comprehensive metrics (new endpoint)
   */
  .get('/metrics', async (c) => {
    try {
      const service = new OfflineAIService(c);
      const metrics = await service.getMetrics();

      return c.json({
        metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Metrics error:', error);
      return c.json({ error: 'Failed to get metrics' }, 500);
    }
  })

  /**
   * DELETE /ai/offline/cache
   * Clear all cached data (enhanced)
   */
  .delete('/cache', async (c) => {
    try {
      const service = new OfflineAIService(c);
      const result = await service.clearCache();

      return c.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Cache clear error:', error);
      return c.json({ error: 'Failed to clear cache' }, 500);
    }
  });

export { offlineAIRouter };
