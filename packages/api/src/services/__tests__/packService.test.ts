import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PackService } from '../packService';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

// Mock the DB – we inject a mock that the service obtains via createDb(c)
const mockFindFirst = vi.fn();
const mockDb = {
  query: {
    packs: {
      findFirst: mockFindFirst,
    },
  },
  transaction: vi.fn(),
  insert: vi.fn(),
};

vi.mock('@packrat/api/db', () => ({
  createDb: vi.fn(() => mockDb),
}));

// Prevent real AI calls
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => vi.fn((modelName) => ({ name: modelName }))),
}));

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

// Prevent real catalog/embedding calls
const mockVectorSearch = vi.fn().mockResolvedValue({ items: [], totalCount: 0 });
const mockBatchVectorSearch = vi.fn().mockResolvedValue({ items: [[]] });

vi.mock('@packrat/api/services/catalogService', () => ({
  CatalogService: vi.fn().mockImplementation(() => ({
    vectorSearch: mockVectorSearch,
    batchVectorSearch: mockBatchVectorSearch,
  })),
}));

vi.mock('@packrat/api/utils/env-validation', () => ({
  getEnv: vi.fn(() => ({
    OPENAI_API_KEY: 'test-key',
    AI_PROVIDER: 'openai',
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockContext() {
  return {
    get: vi.fn((key: string) => {
      if (key === 'user') return { userId: 1 };
      return undefined;
    }),
    req: { json: vi.fn() },
    json: vi.fn(),
    env: {},
  } as unknown as ConstructorParameters<typeof PackService>[0];
}

function makePackRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pack-1',
    name: 'Test Pack',
    description: null,
    category: 'hiking',
    userId: 1,
    templateId: null,
    isPublic: false,
    image: null,
    tags: [],
    deleted: false,
    isAIGenerated: false,
    localCreatedAt: new Date(),
    localUpdatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PackService', () => {
  let service: PackService;
  let mockContext: ReturnType<typeof makeMockContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = makeMockContext();
    service = new PackService(mockContext, 1);
  });

  // -------------------------------------------------------------------------
  // getPackDetails
  // -------------------------------------------------------------------------
  describe('getPackDetails', () => {
    it('returns null when the pack is not found', async () => {
      mockFindFirst.mockResolvedValue(undefined);
      const result = await service.getPackDetails('non-existent');
      expect(result).toBeNull();
    });

    it('returns computed pack weights when the pack is found', async () => {
      const mockPack = makePackRow({
        items: [
          {
            id: 'item-1',
            name: 'Tent',
            weight: 1000,
            weightUnit: 'g',
            quantity: 1,
            consumable: false,
            worn: false,
            packId: 'pack-1',
            userId: 1,
            deleted: false,
            isAIGenerated: false,
            category: null,
            description: null,
            image: null,
            notes: null,
            catalogItemId: null,
            templateItemId: null,
            embedding: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });
      mockFindFirst.mockResolvedValue(mockPack);

      const result = await service.getPackDetails('pack-1');
      expect(result).not.toBeNull();
      expect((result as unknown as { totalWeight: number })?.totalWeight).toBe(1000);
      expect((result as unknown as { baseWeight: number })?.baseWeight).toBe(1000);
    });

    it('calls findFirst once when querying pack details', async () => {
      mockFindFirst.mockResolvedValue(undefined);
      await service.getPackDetails('pack-42');
      expect(mockFindFirst).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // generatePacks – input validation
  // -------------------------------------------------------------------------
  describe('generatePacks – input validation', () => {
    it('throws for count of 0', async () => {
      await expect(service.generatePacks(0)).rejects.toThrow('Count must be a positive integer');
    });

    it('throws for negative count', async () => {
      await expect(service.generatePacks(-1)).rejects.toThrow('Count must be a positive integer');
    });
  });
});
