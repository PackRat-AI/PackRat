import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageDetectionService } from '../imageDetectionService';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => ({
    __mockModel: true,
  })),
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
  CatalogService: vi.fn().mockImplementation(() => ({
    vectorSearch: vi.fn().mockResolvedValue([]),
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockContext() {
  return {} as any;
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
  });
});
