import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setMockContainerFetch } from './setup';
import { seedPackTemplate, seedTestUser } from './utils/db-helpers';
import {
  api,
  apiWithAdmin,
  apiWithAuth,
  expectBadRequest,
  expectUnauthorized,
  httpMethods,
} from './utils/test-helpers';

// Counter for generating unique contentIds in tests (incremented per call to avoid duplicates)
let mockContentIdCounter = 0;

// Create a mock fetch function that can be configured per test
const createMockContainerFetch = (contentId?: string) =>
  vi.fn((_request: Request) => {
    // Generate a unique content ID or use provided contentId
    // Pre-increment ensures each call gets a different ID (safe since tests run sequentially per vitest.config.ts)
    mockContentIdCounter += 1;
    const uniqueContentId = contentId ?? `mock-content-${mockContentIdCounter}`;

    return Promise.resolve(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            imageUrls: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
            caption: 'Check out my hiking gear!',
            contentId: uniqueContentId,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  });

// Mock the AI generateObject function
vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    generateObject: vi.fn(() =>
      Promise.resolve({
        object: {
          templateName: 'Hiking Essentials',
          templateCategory: 'hiking',
          templateDescription: 'Essential gear for a day hike',
          items: [
            {
              name: 'Backpack',
              description: 'Day hiking backpack, 20L capacity',
              quantity: 1,
              category: 'Packs',
              weightGrams: 500,
              consumable: false,
              worn: false,
            },
            {
              name: 'Water Bottle',
              description: 'Reusable water bottle, 1L',
              quantity: 2,
              category: 'Hydration',
              weightGrams: 150,
              consumable: false,
              worn: false,
            },
          ],
        },
      }),
    ),
  };
});

// Mock the catalog service batch vector search
// Returns items with null IDs because in test environment we don't seed catalog items
// and the database has foreign key constraints on catalog_item_id references.
// In production, the service returns actual catalog IDs when matches are found.
vi.mock('@packrat/api/services/catalogService', () => ({
  CatalogService: vi.fn(function (this: unknown) {
    return {
      batchVectorSearch: vi.fn(() =>
        Promise.resolve({
          items: [
            // First item match (backpack)
            [
              {
                id: null, // No catalog ID in tests to avoid FK constraint
                name: 'Trail Backpack 20L',
                description: 'Lightweight day pack',
                weight: 480,
                weightUnit: 'g',
                images: ['https://example.com/backpack.jpg'],
              },
            ],
            // Second item match (water bottle)
            [
              {
                id: null, // No catalog ID in tests to avoid FK constraint
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
  let testAdmin: Awaited<ReturnType<typeof seedTestUser>>;

  beforeEach(async () => {
    // Re-seed both users before each test (global beforeEach truncates all tables)
    await seedTestUser();
    testAdmin = await seedTestUser({
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
    });
    vi.clearAllMocks();
    // Reset container fetch mock to default (unique contentIds per call)
    setMockContainerFetch(createMockContainerFetch());
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
      setMockContainerFetch(createMockContainerFetch(duplicateContentId));

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
