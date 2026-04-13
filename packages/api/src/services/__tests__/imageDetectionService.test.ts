import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageDetectionService } from '../imageDetectionService';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() =>
    vi.fn((modelName) => ({
      __mockModel: true,
      name: modelName,
    })),
  ),
}));

vi.mock('@packrat/api/utils/env-validation', () => ({
  getEnv: vi.fn(() => ({
    OPENAI_API_KEY: 'test-key',
  })),
}));

vi.mock('@packrat/api/utils/ai/models', () => ({
  DEFAULT_MODELS: {
    OPENAI_CHAT: 'gpt-4o',
  },
}));

vi.mock('../catalogService', () => ({
  CatalogService: vi.fn().mockImplementation(function (this: unknown) {
    return { batchVectorSearch: vi.fn().mockResolvedValue({ items: [] }) };
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockContext() {
  return {} as ConstructorParameters<typeof ImageDetectionService>[0];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ImageDetectionService', () => {
  let service: ImageDetectionService;
  let mockContext: ReturnType<typeof makeMockContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = makeMockContext();
    service = new ImageDetectionService(mockContext);
  });

  describe('analyzeImage', () => {
    it('analyzes image and returns detected items', async () => {
      const { generateObject } = await import('ai');
      const mockGenerateObject = generateObject as ReturnType<typeof vi.fn>;

      const mockResult = {
        items: [
          {
            name: 'Sleeping Bag',
            description: 'Down sleeping bag rated for 20°F',
            quantity: 1,
            category: 'Sleep System',
            consumable: false,
            worn: false,
            confidence: 0.95,
          },
          {
            name: 'Tent',
            description: '2-person backpacking tent',
            quantity: 1,
            category: 'Shelter',
            consumable: false,
            worn: false,
            confidence: 0.9,
          },
        ],
      };

      mockGenerateObject.mockResolvedValue({ object: mockResult });

      const result = await service.analyzeImage('https://example.com/gear.jpg');

      expect(result).toEqual(mockResult);
      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.anything(),
          schema: expect.anything(),
          temperature: 0.3,
        }),
      );
    });

    it('calls generateObject with image URL', async () => {
      const { generateObject } = await import('ai');
      const mockGenerateObject = generateObject as ReturnType<typeof vi.fn>;

      mockGenerateObject.mockResolvedValue({
        object: { items: [] },
      });

      await service.analyzeImage('https://example.com/test.jpg');

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: expect.stringContaining('identify all the outdoor gear'),
                },
                {
                  type: 'image',
                  image: 'https://example.com/test.jpg',
                },
              ],
            },
          ],
        }),
      );
    });

    it('uses low temperature for consistent results', async () => {
      const { generateObject } = await import('ai');
      const mockGenerateObject = generateObject as ReturnType<typeof vi.fn>;

      mockGenerateObject.mockResolvedValue({
        object: { items: [] },
      });

      await service.analyzeImage('https://example.com/test.jpg');

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
        }),
      );
    });

    it('initializes OpenAI with correct API key', async () => {
      const { generateObject } = await import('ai');
      const mockGenerateObject = generateObject as ReturnType<typeof vi.fn>;
      const { createOpenAI } = await import('@ai-sdk/openai');

      mockGenerateObject.mockResolvedValue({
        object: { items: [] },
      });

      await service.analyzeImage('https://example.com/test.jpg');

      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-key',
      });
    });
  });

  describe('detectAndMatchItems', () => {
    it('returns empty array when no items detected', async () => {
      const { generateObject } = await import('ai');
      const mockGenerateObject = generateObject as ReturnType<typeof vi.fn>;

      mockGenerateObject.mockResolvedValue({
        object: { items: [] },
      });

      const result = await service.detectAndMatchItems('https://example.com/empty.jpg');

      expect(result).toEqual([]);
    });

    it('filters out low confidence items (< 0.5)', async () => {
      const { generateObject } = await import('ai');
      const mockGenerateObject = generateObject as ReturnType<typeof vi.fn>;
      const { CatalogService } = await import('../catalogService');
      const MockCatalogService = CatalogService as ReturnType<typeof vi.fn>;

      const mockBatchVectorSearch = vi.fn().mockResolvedValue({
        items: [[{ id: 1, name: 'Tent', score: 0.9 }]],
      });
      MockCatalogService.mockImplementation(function (this: unknown) {
        return { batchVectorSearch: mockBatchVectorSearch };
      });

      mockGenerateObject.mockResolvedValue({
        object: {
          items: [
            {
              name: 'High Confidence Item',
              description: 'Clear item',
              confidence: 0.8,
            },
            {
              name: 'Low Confidence Item',
              description: 'Unclear item',
              confidence: 0.3,
            },
          ],
        },
      });

      await service.detectAndMatchItems('https://example.com/test.jpg');

      // Should only search for the high confidence item
      expect(mockBatchVectorSearch).toHaveBeenCalledWith(['High Confidence Item Clear item'], 3);
    });

    it('combines detected items with catalog matches', async () => {
      const { generateObject } = await import('ai');
      const mockGenerateObject = generateObject as ReturnType<typeof vi.fn>;
      const { CatalogService } = await import('../catalogService');
      const MockCatalogService = CatalogService as ReturnType<typeof vi.fn>;

      const mockBatchVectorSearch = vi.fn().mockResolvedValue({
        items: [
          [{ id: 1, name: 'Mountain Tent', score: 0.9 }],
          [{ id: 2, name: 'Sleeping Bag', score: 0.8 }],
        ],
      });
      MockCatalogService.mockImplementation(function (this: unknown) {
        return { batchVectorSearch: mockBatchVectorSearch };
      });

      mockGenerateObject.mockResolvedValue({
        object: {
          items: [
            {
              name: 'Tent',
              description: '2-person tent',
              confidence: 0.9,
              quantity: 1,
              category: 'Shelter',
            },
            {
              name: 'Sleeping Bag',
              description: 'Down sleeping bag',
              confidence: 0.85,
              quantity: 1,
              category: 'Sleep',
            },
          ],
        },
      });

      const result = await service.detectAndMatchItems('https://example.com/gear.jpg');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        detected: {
          name: 'Tent',
          description: '2-person tent',
          confidence: 0.9,
        },
        catalogMatches: [{ id: 1, name: 'Mountain Tent', score: 0.9 }],
      });
      expect(result[1]).toMatchObject({
        detected: {
          name: 'Sleeping Bag',
          description: 'Down sleeping bag',
          confidence: 0.85,
        },
        catalogMatches: [{ id: 2, name: 'Sleeping Bag', score: 0.8 }],
      });
    });

    it('filters out items with no catalog matches', async () => {
      const { generateObject } = await import('ai');
      const mockGenerateObject = generateObject as ReturnType<typeof vi.fn>;
      const { CatalogService } = await import('../catalogService');
      const MockCatalogService = CatalogService as ReturnType<typeof vi.fn>;

      const mockBatchVectorSearch = vi.fn().mockResolvedValue({
        items: [
          [{ id: 1, name: 'Tent', score: 0.9 }], // has matches
          [], // no matches
        ],
      });
      MockCatalogService.mockImplementation(function (this: unknown) {
        return { batchVectorSearch: mockBatchVectorSearch };
      });

      mockGenerateObject.mockResolvedValue({
        object: {
          items: [
            {
              name: 'Tent',
              description: '2-person tent',
              confidence: 0.9,
            },
            {
              name: 'Obscure Item',
              description: 'Unknown item',
              confidence: 0.7,
            },
          ],
        },
      });

      const result = await service.detectAndMatchItems('https://example.com/gear.jpg');

      // Should only return the item with catalog matches
      expect(result).toHaveLength(1);
      expect(result[0]?.detected.name).toBe('Tent');
    });

    it('handles catalog service errors gracefully', async () => {
      const { generateObject } = await import('ai');
      const mockGenerateObject = generateObject as ReturnType<typeof vi.fn>;
      const { CatalogService } = await import('../catalogService');
      const MockCatalogService = CatalogService as ReturnType<typeof vi.fn>;

      const mockBatchVectorSearch = vi.fn().mockRejectedValue(new Error('Catalog unavailable'));
      MockCatalogService.mockImplementation(function (this: unknown) {
        return { batchVectorSearch: mockBatchVectorSearch };
      });

      mockGenerateObject.mockResolvedValue({
        object: {
          items: [
            {
              name: 'Tent',
              description: '2-person tent',
              confidence: 0.9,
            },
          ],
        },
      });

      await expect(service.detectAndMatchItems('https://example.com/gear.jpg')).rejects.toThrow(
        'Failed to analyze image: Catalog unavailable',
      );
    });

    it('handles analysis errors gracefully', async () => {
      const { generateObject } = await import('ai');
      const mockGenerateObject = generateObject as ReturnType<typeof vi.fn>;

      mockGenerateObject.mockRejectedValue(new Error('AI service error'));

      await expect(service.detectAndMatchItems('https://example.com/gear.jpg')).rejects.toThrow(
        'Failed to analyze image: AI service error',
      );
    });

    it('respects custom matchLimit parameter', async () => {
      const { generateObject } = await import('ai');
      const mockGenerateObject = generateObject as ReturnType<typeof vi.fn>;
      const { CatalogService } = await import('../catalogService');
      const MockCatalogService = CatalogService as ReturnType<typeof vi.fn>;

      const mockBatchVectorSearch = vi.fn().mockResolvedValue({
        items: [[{ id: 1, name: 'Tent', score: 0.9 }]],
      });
      MockCatalogService.mockImplementation(function (this: unknown) {
        return { batchVectorSearch: mockBatchVectorSearch };
      });

      mockGenerateObject.mockResolvedValue({
        object: {
          items: [
            {
              name: 'Tent',
              description: '2-person tent',
              confidence: 0.9,
            },
          ],
        },
      });

      await service.detectAndMatchItems('https://example.com/gear.jpg', 5);

      expect(mockBatchVectorSearch).toHaveBeenCalledWith(['Tent 2-person tent'], 5);
    });
  });
});
