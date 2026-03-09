import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogService } from '../catalogService';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

vi.mock('@packrat/api/db', () => ({
  createDb: vi.fn(),
  createDbClient: vi.fn(),
}));

vi.mock('@packrat/api/utils/env-validation', () => ({
  getEnv: vi.fn(() => ({
    OPENAI_API_KEY: 'test-key',
    ENVIRONMENT: 'test',
  })),
}));

vi.mock('@packrat/api/services/embeddingService', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
  generateManyEmbeddings: vi.fn().mockResolvedValue([]),
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
  } as Parameters<typeof CatalogService>[0];
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
});
