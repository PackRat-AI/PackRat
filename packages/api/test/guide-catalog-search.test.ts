import { describe, expect, it } from 'vitest';
import { GuideCatalogSearchTool } from '../src/utils/guideCatalogSearch';
import type { Env } from '../src/utils/env-validation';

// Mock environment for testing
const mockEnv: Env = {
  NEON_DATABASE_URL: process.env.NEON_DATABASE_URL || 'mock://test',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'mock-api-key',
  AI_PROVIDER: 'openai',
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || 'mock-account',
  CLOUDFLARE_AI_GATEWAY_ID: process.env.CLOUDFLARE_AI_GATEWAY_ID || 'mock-gateway',
} as Env;

describe('Guide Catalog Search Tool', () => {
  const searchTool = new GuideCatalogSearchTool(mockEnv);

  describe('extractGearTerms', () => {
    it('should extract known gear terms from text', () => {
      const content = 'For this hike, you need a good tent, sleeping bag, and backpack. Don\'t forget your headlamp!';
      const terms = searchTool.extractGearTerms(content);
      
      expect(terms).toContain('tent');
      expect(terms).toContain('sleeping bag');
      expect(terms).toContain('headlamp');
    });

    it('should handle empty content', () => {
      const terms = searchTool.extractGearTerms('');
      expect(terms).toEqual([]);
    });

    it('should be case insensitive', () => {
      const content = 'TENT and SLEEPING BAG are essential.';
      const terms = searchTool.extractGearTerms(content);
      
      expect(terms).toContain('tent');
      expect(terms).toContain('sleeping bag');
    });

    it('should not duplicate terms', () => {
      const content = 'tent tent tent and more tent';
      const terms = searchTool.extractGearTerms(content);
      
      expect(terms.filter(term => term === 'tent')).toHaveLength(1);
    });
  });

  describe('formatCatalogLink', () => {
    const mockItem = {
      id: 1,
      name: 'Awesome Tent',
      productUrl: 'https://example.com/tent',
      brand: 'TestBrand',
      categories: ['shelter'],
      price: 299.99,
      ratingValue: 4.5,
    };

    it('should format basic link correctly', () => {
      const link = searchTool.formatCatalogLink(mockItem);
      expect(link).toBe('[Awesome Tent](https://example.com/tent "Awesome Tent by TestBrand")');
    });

    it('should use custom link text when provided', () => {
      const link = searchTool.formatCatalogLink(mockItem, 'this tent');
      expect(link).toBe('[this tent](https://example.com/tent "Awesome Tent by TestBrand")');
    });

    it('should handle items without brand', () => {
      const itemWithoutBrand = { ...mockItem, brand: null };
      const link = searchTool.formatCatalogLink(itemWithoutBrand);
      expect(link).toBe('[Awesome Tent](https://example.com/tent "Awesome Tent")');
    });
  });

  describe('formatRecommendationsList', () => {
    const mockItems = [
      {
        id: 1,
        name: 'Awesome Tent',
        productUrl: 'https://example.com/tent',
        brand: 'TestBrand',
        categories: ['shelter'],
        price: 299.99,
        ratingValue: 4.5,
      },
      {
        id: 2,
        name: 'Great Backpack',
        productUrl: 'https://example.com/backpack',
        brand: null,
        categories: ['packs'],
        price: null,
        ratingValue: 4.2,
      },
    ];

    it('should format recommendations list correctly', () => {
      const list = searchTool.formatRecommendationsList(mockItems);
      
      expect(list).toContain('## Recommended Gear');
      expect(list).toContain('[Awesome Tent](https://example.com/tent) (TestBrand) - $299.99 ⭐ 4.5');
      expect(list).toContain('[Great Backpack](https://example.com/backpack) ⭐ 4.2');
    });

    it('should handle empty items array', () => {
      const list = searchTool.formatRecommendationsList([]);
      expect(list).toBe('');
    });

    it('should use custom title', () => {
      const list = searchTool.formatRecommendationsList(mockItems, 'Essential Items');
      expect(list).toContain('## Essential Items');
    });
  });

  // Integration tests would require actual database connection
  // These are skipped in CI but can be run locally with proper environment
  describe.skipIf(!process.env.NEON_DATABASE_URL)('Integration Tests', () => {
    it('should search catalog and return formatted results', async () => {
      const result = await searchTool.searchCatalogForGuides('tent');
      
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('query', 'tent');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.items)).toBe(true);
      
      // Check that returned items have required fields
      if (result.items.length > 0) {
        const item = result.items[0];
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('productUrl');
        expect(typeof item.productUrl).toBe('string');
        expect(item.productUrl).toMatch(/^https?:\/\//);
      }
    });

    it('should handle batch search correctly', async () => {
      const results = await searchTool.batchSearchCatalogForGuides(['tent', 'backpack'], {
        limit: 5
      });
      
      expect(results).toHaveProperty('tent');
      expect(results).toHaveProperty('backpack');
      
      for (const [query, result] of Object.entries(results)) {
        expect(result.query).toBe(query);
        expect(Array.isArray(result.items)).toBe(true);
      }
    });

    it('should filter by category when specified', async () => {
      const result = await searchTool.searchCatalogForGuides('gear', {
        category: 'shelter',
        limit: 5
      });
      
      // All returned items should be in shelter category
      result.items.forEach(item => {
        if (item.categories) {
          expect(item.categories).toContain('shelter');
        }
      });
    });

    it('should filter by minimum rating when specified', async () => {
      const result = await searchTool.searchCatalogForGuides('tent', {
        minRating: 4.0,
        limit: 10
      });
      
      // All returned items should have rating >= 4.0
      result.items.forEach(item => {
        if (item.ratingValue !== null && item.ratingValue !== undefined) {
          expect(item.ratingValue).toBeGreaterThanOrEqual(4.0);
        }
      });
    });
  });
});