import { GearAugmentationService } from '@packrat/api/services/gearAugmentationService';
import { describe, expect, test } from 'vitest';

interface GearWithLinks {
  gear: { item: string; category?: string; context?: string };
  products: Array<{
    id: number;
    name: string;
    productUrl: string;
    price?: number | null;
    brand?: string | null;
    similarity: number;
    weight?: number;
    weightUnit?: string;
    categories?: string[] | null;
  }>;
}

// Mock environment for testing
const mockEnv = {
  OPENAI_API_KEY: 'test-key',
  AI_PROVIDER: 'openai' as const,
  CLOUDFLARE_ACCOUNT_ID: 'test-account',
  CLOUDFLARE_AI_GATEWAY_ID: 'test-gateway',
  AI: {},
  // Add other required env vars as needed
  NEON_DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
};

describe('GearAugmentationService', () => {
  // Initialize service with mock environment
  const gearAugmentationService = new GearAugmentationService(mockEnv, false);

  describe('extractGearMentions', () => {
    test('should return empty array for empty content', async () => {
      const result = await gearAugmentationService.extractGearMentions('');
      expect(result).toEqual([]);
    });

    test('should return empty array for whitespace-only content', async () => {
      const result = await gearAugmentationService.extractGearMentions('   \n  \t  ');
      expect(result).toEqual([]);
    });

    // Note: These tests would require actual API calls to OpenAI
    // In a real test environment, you'd want to mock the AI calls
    test.skip('should extract gear mentions from hiking content', async () => {
      const content = `
        When planning a backpacking trip, a lightweight tent is essential for shelter.
        Don't forget to pack a reliable sleeping bag rated for the expected temperatures.
        A sturdy hiking boots and a comfortable backpack will make your journey more enjoyable.
        Water purification tablets are crucial for safe drinking water on the trail.
      `;

      const result = await gearAugmentationService.extractGearMentions(content);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // Would expect items like 'tent', 'sleeping bag', 'hiking boots', etc.
    });
  });

  describe('augmentContentWithProductLinks', () => {
    test('should return original content when no gears with products provided', () => {
      const content = 'This is a simple guide without gear mentions.';
      const gearsWithLinks: GearWithLinks[] = [];

      const result = gearAugmentationService.augmentContentWithProductLinks(
        content,
        gearsWithLinks,
      );

      expect(result.augmentedContent).toBe(content);
      expect(result.totalProductsAdded).toBe(0);
    });

    test('should return original content when gears have no products', () => {
      const content = 'You need a tent for camping.';
      const gearsWithLinks = [
        {
          gear: { item: 'tent', category: 'shelter' },
          products: [],
        },
      ];

      const result = gearAugmentationService.augmentContentWithProductLinks(
        content,
        gearsWithLinks,
      );

      expect(result.augmentedContent).toBe(content);
      expect(result.totalProductsAdded).toBe(0);
    });

    test('should add product links when gear is mentioned and products are available', () => {
      const content = 'You need a tent for camping. It should be lightweight and waterproof.';
      const gearsWithLinks = [
        {
          gear: { item: 'tent', category: 'shelter' },
          products: [
            {
              id: 1,
              name: 'REI Co-op Quarter Dome SL 2+ Tent',
              productUrl: 'https://example.com/tent',
              price: 399,
              brand: 'REI Co-op',
              similarity: 0.85,
              weight: 1200,
              weightUnit: 'g',
              categories: ['camping', 'shelter'],
            },
          ],
        },
      ];

      const result = gearAugmentationService.augmentContentWithProductLinks(
        content,
        gearsWithLinks,
      );

      expect(result.augmentedContent).toContain('**Recommended tent:**');
      expect(result.augmentedContent).toContain('REI Co-op Quarter Dome SL 2+ Tent');
      expect(result.augmentedContent).toContain('$399');
      expect(result.augmentedContent).toContain('1200g');
      expect(result.augmentedContent).toContain('85.0%');
      expect(result.totalProductsAdded).toBe(1);
    });

    test('should handle multiple products for single gear item', () => {
      const content = 'A sleeping bag is essential for overnight trips.';
      const gearsWithLinks = [
        {
          gear: { item: 'sleeping bag', category: 'sleep' },
          products: [
            {
              id: 1,
              name: 'Patagonia 850 Down Sleeping Bag',
              productUrl: 'https://example.com/bag1',
              price: 299,
              brand: 'Patagonia',
              similarity: 0.9,
              categories: ['sleep'],
            },
            {
              id: 2,
              name: 'REI Co-op Trailbreak 30 Sleeping Bag',
              productUrl: 'https://example.com/bag2',
              price: 179,
              brand: 'REI Co-op',
              similarity: 0.8,
              categories: ['sleep'],
            },
          ],
        },
      ];

      const result = gearAugmentationService.augmentContentWithProductLinks(
        content,
        gearsWithLinks,
      );

      expect(result.augmentedContent).toContain('**Recommended sleeping bag:**');
      expect(result.augmentedContent).toContain('Patagonia 850 Down Sleeping Bag');
      expect(result.augmentedContent).toContain('REI Co-op Trailbreak 30 Sleeping Bag');
      expect(result.totalProductsAdded).toBe(2);
    });
  });

  describe('createProductLinksHtml', () => {
    test('should create proper markdown links for products', () => {
      const gearAugmentationService = new GearAugmentationService(mockEnv, false);

      const products = [
        {
          id: 1,
          name: 'Test Tent',
          productUrl: 'https://example.com/tent',
          price: 299,
          brand: 'TestBrand',
          similarity: 0.85,
          weight: 1500,
          weightUnit: 'g',
          categories: ['camping'],
        },
      ];

      // Access private method via type assertion for testing
      const html = (
        gearAugmentationService as unknown as {
          createProductLinksHtml: (products: unknown[]) => string;
        }
      ).createProductLinksHtml(products);

      expect(html).toContain('- **[Test Tent](https://example.com/tent)**');
      expect(html).toContain('by TestBrand');
      expect(html).toContain('$299');
      expect(html).toContain('1500g');
      expect(html).toContain('85.0%');
    });

    test('should handle products with missing optional fields', () => {
      const gearAugmentationService = new GearAugmentationService(mockEnv, false);

      const products = [
        {
          id: 1,
          name: 'Basic Gear',
          productUrl: 'https://example.com/gear',
          price: null,
          brand: null,
          similarity: 0.7,
          categories: null,
        },
      ];

      const html = (
        gearAugmentationService as unknown as {
          createProductLinksHtml: (products: unknown[]) => string;
        }
      ).createProductLinksHtml(products);

      expect(html).toContain('- **[Basic Gear](https://example.com/gear)**');
      expect(html).toContain('70.0%');
      expect(html).not.toContain('by ');
      expect(html).not.toContain('$');
      expect(html).not.toContain('g)');
    });
  });

  // Integration tests would require actual database and API connections
  describe.skip('Integration Tests', () => {
    test('should perform complete augmentation pipeline', async () => {
      const content = `
        # Backpacking Essentials

        When planning a backpacking trip, you'll need several key items:

        A lightweight tent provides shelter from the elements. Look for something under 2 pounds.
        Your sleeping bag should be rated for the lowest temperature you expect to encounter.
        Don't forget a reliable backpack that can carry all your gear comfortably.
      `;

      const result = await gearAugmentationService.augmentGuide(content, 2, 0.3);

      expect(result.extractedGears).toBeDefined();
      expect(result.augmentedContent).toBeDefined();
      expect(result.totalProductsAdded).toBeGreaterThanOrEqual(0);

      if (result.extractedGears.length > 0) {
        expect(result.augmentedContent).not.toBe(content);
      }
    });
  });
});

// Removed export to comply with linting rules for test files
