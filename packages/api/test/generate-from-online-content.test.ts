import { beforeEach, describe, expect, it, vi } from 'vitest';
import { seedAndLoginTestUser, seedPackTemplate } from './utils/db-helpers';
import {
  api,
  apiWithAdmin,
  apiWithAuth,
  expectBadRequest,
  expectUnauthorized,
  httpMethods,
} from './utils/test-helpers';

// Helper: override the global @cloudflare/containers fetch for a single test
// by setting a function on globalThis that the global mock (in setup.ts) reads.
type MockContainerFetch = (req: Request) => Promise<Response>;
const setMockContainerFetch = (fn: MockContainerFetch | null) => {
  (
    globalThis as unknown as { __mockContainerFetch?: MockContainerFetch | null }
  ).__mockContainerFetch = fn;
};

const containerFetchWithContentId =
  (contentId: string): MockContainerFetch =>
  (_req) =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            imageUrls: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
            caption: 'Check out my hiking gear!',
            contentId,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

// Mock the catalog service batch vector search. Returns items with null IDs
// because in test environment we don't seed catalog items and the database has
// foreign key constraints on catalog_item_id references. In production, the
// service returns actual catalog IDs when matches are found.
vi.mock('@packrat/api/services/catalogService', () => ({
  CatalogService: vi.fn(function (this: unknown) {
    return {
      batchVectorSearch: vi.fn(() =>
        Promise.resolve({
          items: [
            [
              {
                id: null,
                name: 'Trail Backpack 20L',
                description: 'Lightweight day pack',
                weight: 480,
                weightUnit: 'g',
                images: ['https://example.com/backpack.jpg'],
              },
            ],
            [
              {
                id: null,
                name: 'HydroFlask 32oz',
                description: 'Insulated water bottle',
                weight: 180,
                weightUnit: 'g',
                images: ['https://example.com/bottle.jpg'],
              },
            ],
          ],
        }),
      ),
    };
  }),
}));

describe('Generate From Online Content Routes', () => {
  let testAdmin: Awaited<ReturnType<typeof seedAndLoginTestUser>>;

  beforeEach(async () => {
    // Re-seed both users before each test (global beforeEach truncates all tables).
    // Login both: regular user drives apiWithAuth (403 tests), admin drives apiWithAdmin.
    await seedAndLoginTestUser();
    testAdmin = await seedAndLoginTestUser({
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
    });
    vi.clearAllMocks();
    // Reset to the global default container fetch (setup.ts).
    setMockContainerFetch(null);
  });

  describe('Authentication', () => {
    it('requires auth for generate-from-online-content endpoint', async () => {
      const res = await api(
        '/pack-templates/generate-from-online-content',
        httpMethods.post({
          contentUrl: 'https://www.tiktok.com/@user/video/1234567890',
        }),
      );
      expectUnauthorized(res);
    });
  });

  describe('Authorization', () => {
    it('returns 403 for non-admin users', async () => {
      const res = await apiWithAuth(
        '/pack-templates/generate-from-online-content',
        httpMethods.post({
          contentUrl: 'https://www.tiktok.com/@user/video/1234567890',
        }),
      );

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Forbidden');
    });
  });

  describe('Request Validation', () => {
    it('requires contentUrl field', async () => {
      const res = await apiWithAdmin(
        '/pack-templates/generate-from-online-content',
        httpMethods.post({}),
      );
      expectBadRequest(res);
    });

    it('requires valid URL format', async () => {
      const res = await apiWithAdmin(
        '/pack-templates/generate-from-online-content',
        httpMethods.post({
          contentUrl: 'invalid-url',
        }),
      );
      expectBadRequest(res);
    });
  });

  describe('Duplicate Detection', () => {
    it('returns 409 for existing template with same contentId', async () => {
      const duplicateContentId = 'duplicate-content-test-123';

      // Seed an existing template with a TikTok content ID (owned by admin)
      await seedPackTemplate({
        userId: testAdmin.id,
        name: 'Existing TikTok Template',
        contentSource: 'tiktok',
        contentId: duplicateContentId,
      });

      // Configure mock to return the same contentId as the seeded template
      setMockContainerFetch(containerFetchWithContentId(duplicateContentId));

      const res = await apiWithAdmin(
        '/pack-templates/generate-from-online-content',
        httpMethods.post({
          contentUrl: 'https://www.tiktok.com/@user/video/1234567890',
        }),
      );

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('already exists');
      expect(data.code).toBe('DUPLICATE_TEMPLATE');
      expect(data.existingTemplateId).toBeDefined();
    });
  });

  describe('POST /pack-templates/generate-from-online-content', () => {
    it('successfully generates template from online content URL', async () => {
      const res = await apiWithAdmin(
        '/pack-templates/generate-from-online-content',
        httpMethods.post({
          contentUrl: 'https://www.tiktok.com/@user/video/9999999999',
        }),
      );

      // Should succeed with 201
      expect(res.status).toBe(201);

      const data = await res.json();

      // Verify template structure
      expect(data.id).toBeDefined();
      expect(data.id).toMatch(/^pt_/);
      expect(data.name).toBeDefined();
      expect(data.description).toBeDefined();
      expect(data.category).toBeDefined();
      expect(data.contentSource).toBe('tiktok');
      expect(data.contentId).toBeDefined();

      // Verify items were created
      expect(data.items).toBeDefined();
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBeGreaterThan(0);
    });

    it('accepts isAppTemplate flag', async () => {
      const res = await apiWithAdmin(
        '/pack-templates/generate-from-online-content',
        httpMethods.post({
          contentUrl: 'https://www.tiktok.com/@user/video/temp-test',
          isAppTemplate: false,
        }),
      );

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.isAppTemplate).toBe(false);
    });

    it('returns items with matched catalog data when available', async () => {
      const res = await apiWithAdmin(
        '/pack-templates/generate-from-online-content',
        httpMethods.post({
          contentUrl: 'https://www.tiktok.com/@user/video/catalog-test',
        }),
      );

      expect(res.status).toBe(201);
      const data = await res.json();

      // Items should have data from catalog matches (name, weight, etc.)
      expect(data.items.length).toBeGreaterThan(0);
      const item = data.items[0];
      expect(item.name).toBeDefined();
      expect(item.weight).toBeDefined();
    });
  });
});
