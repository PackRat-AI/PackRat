import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  seedPackTemplate,
  seedPackTemplateItem,
  seedPackTemplateItems,
  seedTestUser,
} from './utils/db-helpers';
import {
  api,
  apiWithAdmin,
  apiWithAuth,
  expectJsonResponse,
  expectNotFound,
  expectUnauthorized,
  httpMethods,
} from './utils/test-helpers';

// Mock TiktokService to avoid real AI calls in tests
vi.mock('@packrat/api/services/tiktokService', () => ({
  TiktokService: class MockTiktokService {
    async extractPackConcept(url: string) {
      if (url.includes('fail')) {
        throw new Error('TikTok content extraction failed');
      }
      return {
        name: 'Mock TikTok Hiking Pack',
        description: 'A great hiking pack from TikTok',
        category: 'hiking',
        tags: ['hiking', 'outdoor'],
        items: [
          {
            name: 'Hiking Boots',
            description: 'Sturdy hiking boots',
            weight: 800,
            weightUnit: 'g',
            quantity: 1,
            category: 'footwear',
            consumable: false,
            worn: true,
            notes: null,
          },
          {
            name: 'Water Bottle',
            description: '1L water bottle',
            weight: 200,
            weightUnit: 'g',
            quantity: 2,
            category: 'hydration',
            consumable: false,
            worn: false,
            notes: null,
          },
        ],
      };
    }
  },
}));

// Mock CatalogService.batchVectorSearch to avoid real vector search in tests
vi.mock('@packrat/api/services/catalogService', async () => {
  const actual = await vi.importActual<typeof import('@packrat/api/services/catalogService')>(
    '@packrat/api/services/catalogService',
  );
  return {
    ...actual,
    CatalogService: class MockCatalogService extends actual.CatalogService {
      async batchVectorSearch(_queries: string[], _limit?: number) {
        return { items: [] };
      }
    },
  };
});

describe('Pack Templates Routes', () => {
  // Seed a test user before all tests
  beforeAll(async () => {
    await seedTestUser();
  });
  describe('Authentication', () => {
    it('GET /pack-templates requires auth', async () => {
      const res = await api('/pack-templates', httpMethods.get(''));
      expectUnauthorized(res);
    });

    it('GET /pack-templates/:id requires auth', async () => {
      const res = await api('/pack-templates/1', httpMethods.get(''));
      expectUnauthorized(res);
    });

    it('GET /pack-templates/:id/items requires auth', async () => {
      const res = await api('/pack-templates/1/items', httpMethods.get(''));
      expectUnauthorized(res);
    });
  });

  describe('GET /pack-templates', () => {
    it('returns pack templates list', async () => {
      // Seed a template first
      await seedPackTemplate();

      const res = await apiWithAuth('/pack-templates');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(Array.isArray(data) || data.templates).toBeTruthy();
    });
  });

  describe('GET /pack-templates/:id', () => {
    it('returns single pack template', async () => {
      // Seed a template first
      const seededTemplate = await seedPackTemplate({ name: 'Test Template for GET' });

      const res = await apiWithAuth(`/pack-templates/${seededTemplate.id}`);

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res, ['id', 'name']);
      expect(data.id).toBeDefined();
      expect(data.name).toBeDefined();
    });

    it('returns template with metadata', async () => {
      // Seed a template first
      const seededTemplate = await seedPackTemplate();

      const res = await apiWithAuth(`/pack-templates/${seededTemplate.id}`);

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(data.category || data.type).toBeDefined();
      expect(data.description).toBeDefined();
    });

    it('returns 404 for non-existent template', async () => {
      const res = await apiWithAuth('/pack-templates/999999');
      expectNotFound(res);
    });
  });

  describe('GET /pack-templates/:id/items', () => {
    it('returns template items list', async () => {
      // Seed a template with items
      const seededTemplate = await seedPackTemplate();
      await seedPackTemplateItems(seededTemplate.id, 3);

      const res = await apiWithAuth(`/pack-templates/${seededTemplate.id}/items`);

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(Array.isArray(data) || data.items).toBeTruthy();
    });

    it('returns items with quantities', async () => {
      // Seed a template with items
      const seededTemplate = await seedPackTemplate();
      await seedPackTemplateItem(seededTemplate.id, { quantity: 2 });

      const res = await apiWithAuth(`/pack-templates/${seededTemplate.id}/items`);

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      const items = Array.isArray(data) ? data : data.items;

      const item = items[0];
      expect(item.quantity).toBeDefined();
      expect(typeof item.quantity).toBe('number');
      expect(item.quantity).toBeGreaterThan(0);
    });

    it('returns 404 for non-existent template', async () => {
      const res = await apiWithAuth('/pack-templates/999999/items');
      expectNotFound(res);
    });
  });

  describe('POST /pack-templates/generate-from-tiktok', () => {
    it('returns 403 for non-admin user', async () => {
      const res = await apiWithAuth(
        '/pack-templates/generate-from-tiktok',
        httpMethods.post('', { url: 'https://www.tiktok.com/@user/video/1234567890' }),
      );

      expect(res.status).toBe(403);
    });

    it('returns 422 when TikTok service fails to extract content', async () => {
      const res = await apiWithAdmin(
        '/pack-templates/generate-from-tiktok',
        httpMethods.post('', { url: 'https://www.tiktok.com/@user/video/fail-extraction' }),
      );

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('returns 409 when a template from the same URL already exists', async () => {
      const tiktokUrl = 'https://www.tiktok.com/@user/video/duplicate123';

      // Seed a template that already has this source URL
      await seedPackTemplate({ sourceUrl: tiktokUrl });

      const res = await apiWithAdmin(
        '/pack-templates/generate-from-tiktok',
        httpMethods.post('', { url: tiktokUrl }),
      );

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('already exists');
    });

    it('creates a template with items on success', async () => {
      const tiktokUrl = `https://www.tiktok.com/@user/video/success-${Date.now()}`;

      const res = await apiWithAdmin(
        '/pack-templates/generate-from-tiktok',
        httpMethods.post('', { url: tiktokUrl }),
      );

      expect(res.status).toBe(201);
      const data = await expectJsonResponse(res, ['id', 'name', 'items']);
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Mock TikTok Hiking Pack');
      expect(data.isAppTemplate).toBe(true);
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBeGreaterThan(0);
    });
  });
});
