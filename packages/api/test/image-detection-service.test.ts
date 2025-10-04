import type { Context } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { ImageDetectionService } from '../src/services/imageDetectionService';

// Mock the dependencies
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => ({})),
}));

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

vi.mock('../src/services/catalogService', () => ({
  CatalogService: vi.fn(() => ({
    vectorSearch: vi.fn(),
  })),
}));

vi.mock('../src/utils/env-validation', () => ({
  getEnv: vi.fn(() => ({
    OPENAI_API_KEY: 'test-key',
  })),
}));

describe('ImageDetectionService', () => {
  const mockContext = {} as Context;

  describe('Constructor', () => {
    it('creates service instance with context', () => {
      const service = new ImageDetectionService(mockContext);
      expect(service).toBeInstanceOf(ImageDetectionService);
    });
  });

  describe('convertToPackItems', () => {
    it('converts detected items to pack item format', () => {
      const service = new ImageDetectionService(mockContext);

      const detectedItems = [
        {
          detected: {
            name: 'Sleeping Bag',
            description: 'Down sleeping bag',
            quantity: 1,
            category: 'Sleep System',
            confidence: 0.9,
          },
          catalogMatches: [
            {
              id: 123,
              name: 'Premium Down Sleeping Bag',
              description: 'Lightweight down sleeping bag',
              weight: 850,
              weightUnit: 'g',
              image: 'https://example.com/bag.jpg',
              similarity: 0.95,
            },
          ],
        },
        {
          detected: {
            name: 'Tent',
            description: '2-person tent',
            quantity: 1,
            category: 'Shelter',
            confidence: 0.8,
          },
          catalogMatches: [], // No matches
        },
      ];

      const packItems = service.convertToPackItems(detectedItems, 'pack-123', 456);

      expect(packItems).toHaveLength(2);

      // First item with catalog match
      expect(packItems[0]).toMatchObject({
        name: 'Premium Down Sleeping Bag',
        description: 'Lightweight down sleeping bag',
        weight: 850,
        weightUnit: 'g',
        quantity: 1,
        category: 'Sleep System',
        packId: 'pack-123',
        userId: 456,
        catalogItemId: 123,
        isAIGenerated: true,
        consumable: false,
        worn: false,
      });

      // Second item without catalog match
      expect(packItems[1]).toMatchObject({
        name: 'Tent',
        description: '2-person tent',
        weight: 100, // Default weight
        weightUnit: 'g',
        quantity: 1,
        category: 'Shelter',
        packId: 'pack-123',
        userId: 456,
        catalogItemId: null,
        isAIGenerated: true,
      });

      // Check that IDs are generated
      expect(packItems[0].id).toBeDefined();
      expect(packItems[1].id).toBeDefined();
      expect(typeof packItems[0].id).toBe('string');
      expect(typeof packItems[1].id).toBe('string');

      // Check confidence notes
      expect(packItems[0].notes).toContain('confidence: 90%');
      expect(packItems[1].notes).toContain('confidence: 80%');
    });

    it('handles empty detected items array', () => {
      const service = new ImageDetectionService(mockContext);
      const packItems = service.convertToPackItems([], 'pack-123', 456);
      expect(packItems).toHaveLength(0);
    });

    it('uses fallback values for missing catalog data', () => {
      const service = new ImageDetectionService(mockContext);

      const detectedItems = [
        {
          detected: {
            name: 'Unknown Item',
            description: 'Unidentified gear',
            quantity: 2,
            category: 'Misc',
            confidence: 0.6,
          },
          catalogMatches: [
            {
              id: 999,
              name: 'Catalog Item',
              description: null, // Null description
              weight: null, // Null weight
              weightUnit: null, // Null weight unit
              image: null,
              similarity: 0.5,
            },
          ],
        },
      ];

      const packItems = service.convertToPackItems(detectedItems, 'pack-123', 456);

      expect(packItems[0]).toMatchObject({
        name: 'Catalog Item',
        description: 'Unidentified gear', // Uses detected description when catalog has null
        weight: 100, // Fallback to default weight
        weightUnit: 'g', // Fallback to default unit
        quantity: 2,
        image: null,
        catalogItemId: 999,
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles items with zero confidence', () => {
      const service = new ImageDetectionService(mockContext);

      const detectedItems = [
        {
          detected: {
            name: 'Uncertain Item',
            description: 'Low confidence detection',
            quantity: 1,
            category: 'Unknown',
            confidence: 0,
          },
          catalogMatches: [],
        },
      ];

      const packItems = service.convertToPackItems(detectedItems, 'pack-123', 456);
      expect(packItems[0].notes).toContain('confidence: 0%');
    });

    it('handles items with maximum confidence', () => {
      const service = new ImageDetectionService(mockContext);

      const detectedItems = [
        {
          detected: {
            name: 'Perfect Match',
            description: 'High confidence detection',
            quantity: 1,
            category: 'Gear',
            confidence: 1,
          },
          catalogMatches: [],
        },
      ];

      const packItems = service.convertToPackItems(detectedItems, 'pack-123', 456);
      expect(packItems[0].notes).toContain('confidence: 100%');
    });
  });
});
