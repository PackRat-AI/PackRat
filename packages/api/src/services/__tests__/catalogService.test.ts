import * as embeddingService from '@packrat/api/services/embeddingService';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogService } from '../catalogService';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

vi.mock('@packrat/api/db', () => ({
  createDb: vi.fn(),
  createDbClient: vi.fn(),
}));

// Mock embedding service
vi.mock('@packrat/api/services/embeddingService', () => ({
  generateEmbedding: vi.fn(),
  generateManyEmbeddings: vi.fn(),
}));

vi.mock('@packrat/api/utils/env-validation', () => ({
  getEnv: vi.fn(() => ({
    OPENAI_API_KEY: 'test-key',
    ENVIRONMENT: 'test',
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeEnv() {
  return {
    OPENAI_API_KEY: 'test-key',
    ENVIRONMENT: 'test',
    NEON_DATABASE_URL: 'postgres://localhost/test',
    NEON_DATABASE_URL_READONLY: 'postgres://localhost/test',
    JWT_SECRET: 'secret',
  } as unknown as ConstructorParameters<typeof CatalogService>[0];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('CatalogService', () => {
  let service: CatalogService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Construct with a plain Env object (isHonoContext = false)
    service = new CatalogService(makeEnv(), false);
  });

  // -------------------------------------------------------------------------
  // Input validation – these throw before hitting the database
  // -------------------------------------------------------------------------
  describe('getCatalogItems – input validation', () => {
    it('throws when limit is less than 1', async () => {
      await expect(service.getCatalogItems({ limit: 0 })).rejects.toThrow(
        'Limit must be at least 1',
      );
    });

    it('throws when limit is negative', async () => {
      await expect(service.getCatalogItems({ limit: -5 })).rejects.toThrow(
        'Limit must be at least 1',
      );
    });

    it('throws when offset is negative', async () => {
      await expect(service.getCatalogItems({ offset: -1 })).rejects.toThrow(
        'Offset cannot be negative',
      );
    });
  });

  // -------------------------------------------------------------------------
  // vectorSearch
  // -------------------------------------------------------------------------
  describe('vectorSearch', () => {
    beforeEach(() => {
      vi.mocked(embeddingService.generateEmbedding).mockResolvedValue(new Array(1536).fill(0.1));
    });

    it('returns empty result for empty query string', async () => {
      const result = await service.vectorSearch('', 10, 0);

      expect(result).toEqual({
        items: [],
        total: 0,
        limit: 10,
        offset: 0,
        nextOffset: 10,
      });
      expect(embeddingService.generateEmbedding).not.toHaveBeenCalled();
    });

    it('returns empty result for whitespace-only query', async () => {
      const result = await service.vectorSearch('   ', 10, 0);

      expect(result).toEqual({
        items: [],
        total: 0,
        limit: 10,
        offset: 0,
        nextOffset: 10,
      });
      expect(embeddingService.generateEmbedding).not.toHaveBeenCalled();
    });

    it('returns empty result when embedding generation fails', async () => {
      vi.mocked(embeddingService.generateEmbedding).mockResolvedValueOnce(null);

      const result = await service.vectorSearch('tent', 10, 0);

      expect(result).toEqual({
        items: [],
        total: 0,
        limit: 10,
        offset: 0,
        nextOffset: 10,
      });
      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith({
        value: 'tent',
        openAiApiKey: 'test-key',
        provider: undefined,
        cloudflareAccountId: undefined,
        cloudflareGatewayId: undefined,
        cloudflareAiBinding: undefined,
      });
    });

    it('calls generateEmbedding with correct parameters', async () => {
      vi.mocked(embeddingService.generateEmbedding).mockResolvedValueOnce(
        new Array(1536).fill(0.1),
      );

      // We can't fully test the DB query without a real/mocked database,
      // but we can verify the embedding generation was called correctly
      try {
        await service.vectorSearch('lightweight tent', 10, 0);
      } catch (err) {
        // DB query will fail since we don't have a proper mock, but that's OK
        // We're just testing the input validation and embedding call
      }

      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith({
        value: 'lightweight tent',
        openAiApiKey: 'test-key',
        provider: undefined,
        cloudflareAccountId: undefined,
        cloudflareGatewayId: undefined,
        cloudflareAiBinding: undefined,
      });
    });
  });

  // -------------------------------------------------------------------------
  // batchVectorSearch
  // -------------------------------------------------------------------------
  describe('batchVectorSearch', () => {
    beforeEach(() => {
      vi.mocked(embeddingService.generateManyEmbeddings).mockResolvedValue([
        new Array(1536).fill(0.1),
        new Array(1536).fill(0.2),
      ]);
    });

    it('returns empty result for empty query array', async () => {
      const result = await service.batchVectorSearch([], 5);

      expect(result).toEqual({
        items: [],
      });
      expect(embeddingService.generateManyEmbeddings).not.toHaveBeenCalled();
    });

    it('returns empty result when embeddings generation fails', async () => {
      vi.mocked(embeddingService.generateManyEmbeddings).mockResolvedValueOnce(null);

      const result = await service.batchVectorSearch(['tent', 'sleeping bag'], 5);

      expect(result).toEqual({
        items: [],
      });
      expect(embeddingService.generateManyEmbeddings).toHaveBeenCalledWith({
        values: ['tent', 'sleeping bag'],
        openAiApiKey: 'test-key',
        cloudflareAccountId: undefined,
        cloudflareGatewayId: undefined,
        provider: undefined,
        cloudflareAiBinding: undefined,
      });
    });

    it('calls generateManyEmbeddings with correct parameters', async () => {
      vi.mocked(embeddingService.generateManyEmbeddings).mockResolvedValueOnce([
        new Array(1536).fill(0.1),
        new Array(1536).fill(0.2),
      ]);

      try {
        await service.batchVectorSearch(['tent', 'sleeping bag'], 5);
      } catch (err) {
        // DB query will fail since we don't have a proper mock, but that's OK
      }

      expect(embeddingService.generateManyEmbeddings).toHaveBeenCalledWith({
        values: ['tent', 'sleeping bag'],
        openAiApiKey: 'test-key',
        cloudflareAccountId: undefined,
        cloudflareGatewayId: undefined,
        provider: undefined,
        cloudflareAiBinding: undefined,
      });
    });
  });
});
