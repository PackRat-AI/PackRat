/**
 * OfflineFirstAIService for PackRat
 * 
 * Provides AI capabilities that work offline using cached data
 * and local inference when network is unavailable.
 */

import type { Env } from '@packrat/api/types/env';
import { getEnv } from '@packrat/api/utils/env-validation';
import type { Context } from 'hono';

export interface OfflineConfig {
  enableOffline: boolean;
  cacheTimeout: number; // seconds
  preferLocal: boolean;
}

export interface TripContext {
  destination: string;
  duration: number;
  difficulty: 'easy' | 'moderate' | 'hard' | 'expert';
  season: string;
  activities: string[];
}

export interface OfflineRecommendation {
  id: string;
  title: string;
  description: string;
  type: 'trip' | 'gear' | 'weather' | 'route';
  confidence: number;
  source: 'cache' | 'local' | 'online';
  cachedAt?: string;
  expiresAt?: string;
}

export interface CacheEntry<T> {
  data: T;
  cachedAt: string;
  expiresAt: string;
}

export class OfflineAIService {
  private env: Env;
  private config: OfflineConfig;

  constructor(c: Context) {
    this.env = getEnv(c);
    this.config = {
      enableOffline: true,
      cacheTimeout: 86400, // 24 hours
      preferLocal: false,
    };
  }

  /**
   * Get trip recommendations with offline-first approach
   */
  async getTripRecommendations(
    context: TripContext,
  ): Promise<OfflineRecommendation[]> {
    // Check cache first
    if (this.config.enableOffline) {
      const cached = await this.getCachedRecommendations(context);
      if (cached.length > 0) {
        return cached.map((r) => ({ ...r, source: 'cache' as const }));
      }
    }

    // Fetch from online AI if available
    try {
      const online = await this.fetchOnlineRecommendations(context);
      if (online.length > 0) {
        // Cache the results
        await this.cacheRecommendations(context, online);
        return online.map((r) => ({ ...r, source: 'online' as const }));
      }
    } catch (error) {
      console.warn('Online AI unavailable, falling back to local', error);
    }

    // Fall back to local recommendations
    const local = this.getLocalRecommendations(context);
    return local.map((r) => ({ ...r, source: 'local' as const }));
  }

  /**
   * Get gear recommendations with offline support
   */
  async getGearRecommendations(
    context: TripContext,
  ): Promise<OfflineRecommendation[]> {
    const key = this.getCacheKey('gear', context);

    // Check cache
    if (this.config.enableOffline) {
      const cached = await this.getFromCache<OfflineRecommendation[]>(key);
      if (cached) {
        return cached.map((r) => ({ ...r, source: 'cache' as const }));
      }
    }

    // Try online
    try {
      const online = await this.fetchGearFromAI(context);
      await this.saveToCache(key, online);
      return online.map((r) => ({ ...r, source: 'online' as const }));
    } catch {
      // Fall back to local
      const local = this.getLocalGear(context);
      return local.map((r) => ({ ...r, source: 'local' as const }));
    }
  }

  /**
   * Check if offline mode is active
   */
  async isOffline(): Promise<boolean> {
    // In production, this would check actual network status
    // For now, we'll simulate based on environment
    return false; // Assume online by default
  }

  /**
   * Get cache status for a context
   */
  async getCacheStatus(context: TripContext): Promise<{
    trips: { cached: boolean; age: number | null };
    gear: { cached: boolean; age: number | null };
  }> {
    const tripKey = this.getCacheKey('trips', context);
    const gearKey = this.getCacheKey('gear', context);

    const trips = await this.getCacheMeta(tripKey);
    const gear = await this.getCacheMeta(gearKey);

    return {
      trips,
      gear,
    };
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    // In production, this would clear actual cache storage
    console.log('Cache cleared');
  }

  // Private methods

  private async getCachedRecommendations(
    context: TripContext,
  ): Promise<OfflineRecommendation[]> {
    const key = this.getCacheKey('trips', context);
    return (await this.getFromCache<OfflineRecommendation[]>(key)) || [];
  }

  private async cacheRecommendations(
    context: TripContext,
    recommendations: OfflineRecommendation[],
  ): Promise<void> {
    const key = this.getCacheKey('trips', context);
    await this.saveToCache(key, recommendations);
  }

  private async fetchOnlineRecommendations(
    context: TripContext,
  ): Promise<OfflineRecommendation[]> {
    // In production, this would call the AI service
    // For now, return placeholder
    return this.getLocalRecommendations(context);
  }

  private async fetchGearFromAI(
    context: TripContext,
  ): Promise<OfflineRecommendation[]> {
    // In production, this would call the gear recommendation service
    return this.getLocalGear(context);
  }

  private getLocalRecommendations(
    context: TripContext,
  ): OfflineRecommendation[] {
    // Offline fallback - curated recommendations
    const baseRecommendations: OfflineRecommendation[] = [
      {
        id: 'local-trip-1',
        title: `${context.destination} Day Hike`,
        description: `A ${context.difficulty} ${context.duration}-day adventure`,
        type: 'trip',
        confidence: 0.85,
        source: 'local',
      },
      {
        id: 'local-trip-2',
        title: `${context.destination} Weekend Escape`,
        description: 'Quick getaway for experienced travelers',
        type: 'trip',
        confidence: 0.75,
        source: 'local',
      },
    ];

    return baseRecommendations;
  }

  private getLocalGear(context: TripContext): OfflineRecommendation[] {
    const gear: OfflineRecommendation[] = [
      {
        id: 'local-gear-1',
        title: 'Essential Gear Kit',
        description: 'Core items for your trip',
        type: 'gear',
        confidence: 0.9,
        source: 'local',
      },
    ];

    return gear;
  }

  private getCacheKey(type: string, context: TripContext): string {
    const hash = JSON.stringify(context);
    return `${type}:${Buffer.from(hash).toString('base64')}`;
  }

  private async getFromCache<T>(key: string): Promise<T | null> {
    // In production, this would query actual cache (Redis, D1, etc.)
    // For now, return null (no cache in prototype)
    return null;
  }

  private async saveToCache<T>(key: string, data: T): Promise<void> {
    // In production, this would save to actual cache
    const entry: CacheEntry<T> = {
      data,
      cachedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.config.cacheTimeout * 1000).toISOString(),
    };
    console.log(`Cached ${key}`, entry);
  }

  private async getCacheMeta(
    key: string,
  ): Promise<{ cached: boolean; age: number | null }> {
    // In production, this would check actual cache
    return { cached: false, age: null };
  }
}
