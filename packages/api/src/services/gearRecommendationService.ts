import type { Env } from '@packrat/api/types/env';
import { getEnv } from '@packrat/api/utils/env-validation';
import type { Context } from 'hono';
import { generateEmbedding, generateManyEmbeddings } from './embeddingService';

interface GearItem {
  id: string;
  name: string;
  category: string;
  weight: number;
  price: number;
  description: string;
  tags: string[];
  rating: number;
}

interface GearRecommendation {
  item: GearItem;
  score: number;
  reason: string;
}

interface GearPreferences {
  activities?: string[];
  budget?: { min?: number; max?: number };
  weightPreference?: 'lightweight' | 'standard' | 'ultralight';
  experience?: 'beginner' | 'intermediate' | 'expert';
}

interface TripContext {
  destination: string;
  duration: number;
  season: string;
  activities: string[];
}

export class GearRecommendationService {
  private env: Env;

  constructor(c: Context) {
    this.env = getEnv(c);
  }

  /**
   * Get personalized gear recommendations based on trip context and user preferences
   */
  async getRecommendations(
    preferences: GearPreferences,
    tripContext: TripContext,
    limit: number = 10,
  ): Promise<GearRecommendation[]> {
    // Build search query from preferences and trip context
    const searchQuery = this.buildSearchQuery(preferences, tripContext);

    // Generate embedding for the search query
    const queryEmbedding = await generateEmbedding({
      value: searchQuery,
      openAiApiKey: this.env.OPENAI_API_KEY,
      provider: 'cloudflare',
      cloudflareAccountId: this.env.CLOUDFLARE_ACCOUNT_ID,
      cloudflareGatewayId: this.env.CLOUDFLARE_GATEWAY_ID,
      cloudflareAiBinding: this.env.AI,
    });

    if (!queryEmbedding) {
      return this.getFallbackRecommendations(preferences, tripContext, limit);
    }

    // In production, this would query a vector database with the embedding
    // For now, return recommendations based on matching criteria
    const recommendations = await this.queryGearDatabase(
      queryEmbedding,
      preferences,
      tripContext,
      limit,
    );

    return recommendations;
  }

  /**
   * Get gear suggestions for similar trips (collaborative filtering)
   */
  async getSimilarTripGear(tripId: string, limit: number = 5): Promise<GearRecommendation[]> {
    // In production, this would query trips with similar characteristics
    // and return gear commonly used on those trips
    return this.getDefaultGearForTrip(tripId, limit);
  }

  /**
   * Analyze user's current pack and suggest improvements
   */
  async analyzePack(
    currentItems: Array<{ id: string; name: string; weight: number; category: string }>,
    tripContext: TripContext,
  ): Promise<{
    missingItems: GearRecommendation[];
    overweightItems: Array<{ item: string; weight: number; suggestion: string }>;
    suggestions: string[];
  }> {
    const missingItems = await this.findMissingEssentialGear(currentItems, tripContext, 5);
    const overweightItems = currentItems
      .filter((item) => item.weight > 5000) // > 5kg considered heavy
      .map((item) => ({
        item: item.name,
        weight: item.weight,
        suggestion: `Consider a lighter alternative for ${item.category}`,
      }));

    const suggestions = this.generatePackSuggestions(currentItems, tripContext);

    return { missingItems, overweightItems, suggestions };
  }

  private async queryGearDatabase(
    queryEmbedding: number[],
    preferences: GearPreferences,
    tripContext: TripContext,
    limit: number,
  ): Promise<GearRecommendation[]> {
    // Placeholder: In production, query vector database with embedding
    // For now, return curated recommendations based on trip context
    return this.getContextualGearRecommendations(preferences, tripContext, limit);
  }

  private getContextualGearRecommendations(
    preferences: GearPreferences,
    tripContext: TripContext,
    limit: number,
  ): GearRecommendation[] {
    const recommendations: GearRecommendation[] = [];

    // Base essentials for all trips
    const essentials = this.getEssentialGear(tripContext.season, tripContext.activities);

    for (const item of essentials.slice(0, limit)) {
      recommendations.push({
        item,
        score: this.calculateRelevanceScore(item, preferences, tripContext),
        reason: this.generateReason(item, preferences, tripContext),
      });
    }

    // Sort by score
    return recommendations.sort((a, b) => b.score - a.score);
  }

  private getEssentialGear(season: string, activities: string[]): GearItem[] {
    const baseGear: GearItem[] = [
      {
        id: 'backpack-40l',
        name: '40-50L Backpack',
        category: 'Bags',
        weight: 1200,
        price: 150,
        description: 'Versatile backpack for multi-day trips',
        tags: ['hiking', 'camping', 'travel'],
        rating: 4.5,
      },
      {
        id: 'sleeping-bag-20f',
        name: '20°F Sleeping Bag',
        category: 'Sleep',
        weight: 1500,
        price: 200,
        description: 'Down sleeping bag rated for 20°F',
        tags: ['camping', 'backpacking', 'cold-weather'],
        rating: 4.7,
      },
      {
        id: 'sleeping-pad',
        name: 'Sleeping Pad (R-value 4)',
        category: 'Sleep',
        weight: 500,
        price: 80,
        description: 'Insulated sleeping pad for comfort and warmth',
        tags: ['camping', 'backpacking'],
        rating: 4.3,
      },
      {
        id: 'water-filter',
        name: 'Water Filter System',
        category: 'Water',
        weight: 200,
        price: 40,
        description: 'Portable water filter removes 99.99% of bacteria',
        tags: ['hiking', 'camping', 'backpacking', 'safety'],
        rating: 4.6,
      },
      {
        id: 'headlamp',
        name: 'LED Headlamp (500 lumens)',
        category: 'Lighting',
        weight: 100,
        price: 30,
        description: 'Hands-free lighting with multiple modes',
        tags: ['camping', 'hiking', 'safety'],
        rating: 4.4,
      },
      {
        id: 'first-aid',
        name: 'Adventure First Aid Kit',
        category: 'Safety',
        weight: 400,
        price: 50,
        description: 'Comprehensive first aid kit for outdoor activities',
        tags: ['safety', 'camping', 'hiking'],
        rating: 4.5,
      },
      {
        id: 'navigation',
        name: 'GPS Device + Map/Compass',
        category: 'Navigation',
        weight: 200,
        price: 100,
        description: 'Primary navigation tools for backcountry travel',
        tags: ['navigation', 'safety', 'hiking'],
        rating: 4.5,
      },
      {
        id: 'sun-protection',
        name: 'Sun Protection Kit',
        category: 'Health',
        weight: 100,
        price: 25,
        description: 'SPF 50+ sunscreen, lip balm, and sunglasses',
        tags: ['health', 'summer', 'hiking'],
        rating: 4.2,
      },
    ];

    // Add seasonal gear
    if (['winter', 'spring', 'fall'].includes(season.toLowerCase())) {
      baseGear.push({
        id: 'insulated-jacket',
        name: 'Insulated Down Jacket',
        category: 'Clothing',
        weight: 400,
        price: 180,
        description: 'Lightweight down jacket for cold conditions',
        tags: ['cold-weather', 'winter', 'layering'],
        rating: 4.7,
      });
    }

    if (season.toLowerCase() === 'summer') {
      baseGear.push({
        id: 'rain-jacket',
        name: 'Lightweight Rain Jacket',
        category: 'Clothing',
        weight: 300,
        price: 80,
        description: 'Waterproof breathable rain shell',
        tags: ['rain', 'summer', 'hiking'],
        rating: 4.4,
      });
    }

    // Add activity-specific gear
    if (activities.includes('hiking') || activities.includes('backpacking')) {
      baseGear.push({
        id: 'trekking-poles',
        name: 'Trekking Poles (adjustable)',
        category: 'Hiking',
        weight: 450,
        price: 50,
        description: 'Adjustable poles for stability on trails',
        tags: ['hiking', 'backpacking', 'trekking'],
        rating: 4.3,
      });
    }

    if (activities.includes('camping')) {
      baseGear.push({
        id: 'camp-stove',
        name: 'Canister Stove',
        category: 'Cooking',
        weight: 350,
        price: 60,
        description: 'Compact isobutane stove for camp cooking',
        tags: ['camping', 'cooking', 'backpacking'],
        rating: 4.5,
      });
    }

    return baseGear;
  }

  private buildSearchQuery(preferences: GearPreferences, tripContext: TripContext): string {
    const parts: string[] = [];

    if (preferences.weightPreference) {
      parts.push(`${preferences.weightPreference} gear`);
    }

    if (preferences.experience) {
      parts.push(`${preferences.experience} outdoor gear`);
    }

    parts.push(`gear for ${tripContext.activities.join(', ')} in ${tripContext.destination}`);
    parts.push(`${tripContext.season} weather activities`);

    return parts.join('. ');
  }

  private calculateRelevanceScore(
    item: GearItem,
    preferences: Preferences,
    tripContext: TripContext,
  ): number {
    let score = item.rating * 20; // Base score from rating

    // Boost if category matches activities
    const categoryBoost = tripContext.activities.some((a) =>
      item.tags.some((t) => t.toLowerCase().includes(a.toLowerCase())),
    )
      ? 10
      : 0;

    // Weight preference adjustment
    if (preferences.weightPreference === 'ultralight' && item.weight < 500) {
      score += 15;
    } else if (preferences.weightPreference === 'lightweight' && item.weight < 1000) {
      score += 10;
    }

    // Budget consideration
    if (preferences.budget?.max && item.price <= preferences.budget.max) {
      score += 5;
    }

    return Math.min(100, score + categoryBoost);
  }

  private generateReason(
    item: GearItem,
    preferences: GearPreferences,
    tripContext: TripContext,
  ): string {
    const reasons: string[] = [];

    if (tripContext.activities.some((a) => item.tags.includes(a))) {
      reasons.push(`Essential for ${tripContext.activities.join(' and ')}`);
    }

    if (preferences.weightPreference === 'ultralight' && item.weight < 500) {
      reasons.push('Lightweight option');
    }

    if (item.rating >= 4.5) {
      reasons.push('Highly rated by users');
    }

    return reasons.join('. ') || 'Recommended for your trip';
  }

  private async getFallbackRecommendations(
    preferences: GearPreferences,
    tripContext: TripContext,
    limit: number,
  ): Promise<GearRecommendation[]> {
    return this.getContextualGearRecommendations(preferences, tripContext, limit);
  }

  private async getDefaultGearForTrip(tripId: string, limit: number): Promise<GearRecommendation[]> {
    // Placeholder: Return default gear recommendations
    return this.getContextualGearRecommendations(
      { experience: 'intermediate' },
      { destination: 'Unknown', duration: 3, season: 'any', activities: ['hiking'] },
      limit,
    );
  }

  private async findMissingEssentialGear(
    currentItems: Array<{ id: string; name: string; category: string }>,
    tripContext: TripContext,
    limit: number,
  ): Promise<GearRecommendation[]> {
    const currentCategories = new Set(currentItems.map((i) => i.category.toLowerCase()));
    const essentials = this.getEssentialGear(tripContext.season, tripContext.activities);

    const missing = essentials.filter(
      (item) => !currentCategories.has(item.category.toLowerCase()),
    );

    return missing.slice(0, limit).map((item) => ({
      item,
      score: 85,
      reason: `Essential ${item.category} item not in your pack`,
    }));
  }

  private generatePackSuggestions(
    currentItems: Array<{ weight: number; category: string }>,
    tripContext: TripContext,
  ): string[] {
    const suggestions: string[] = [];

    const totalWeight = currentItems.reduce((sum, item) => sum + item.weight, 0);

    if (totalWeight > 15000) {
      suggestions.push('Consider reducing overall pack weight - aim for under 15kg for multi-day trips');
    }

    const hasWater = currentItems.some((i) => i.category.toLowerCase().includes('water'));
    if (!hasWater) {
      suggestions.push('Add water filtration or purification method');
    }

    const hasLighting = currentItems.some((i) => i.category.toLowerCase().includes('lighting'));
    if (!hasLighting) {
      suggestions.push('Include a headlamp or flashlight');
    }

    return suggestions;
  }
}
