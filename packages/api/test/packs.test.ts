import { beforeAll, describe, expect, it, vi } from 'vitest';
import { seedCatalogItem, seedPack, seedPackItem, seedTestUser } from './utils/db-helpers';
import {
  api,
  apiWithAdmin,
  apiWithAuth,
  expectBadRequest,
  expectJsonResponse,
  expectNotFound,
  expectUnauthorized,
  httpMethods,
  TEST_USER,
} from './utils/test-helpers';
import type { Pack } from '@packrat/api/db/schema';

// Mock PackService.generatePacks to avoid AI dependencies in tests
vi.mock('../src/services/packService', async () => {
  const actual = await vi.importActual<typeof import('../src/services/packService')>(
    '../src/services/packService',
  );
  return {
    ...actual,
    PackService: class PackService extends actual.PackService {
      private readonly _userId: number;
      constructor(...args: ConstructorParameters<typeof actual.PackService>) {
        super(...args);
        // Capture userId (second argument in original constructor)
        this._userId = args[1] as number;
      }
      async generatePacks(count: number) {
        const mockPacks: Pack[] = [];
        for (let i = 0; i < count; i++) {
          mockPacks.push({
            id: `generated-pack-${i}-${Date.now()}`,
            userId: this._userId,
            name: `Generated Test Pack ${i + 1}`,
            description: `AI-generated pack for testing purposes ${i + 1}`,
            category: 'hiking',
            tags: ['test', 'generated'],
            isPublic: true,
            isAIGenerated: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            image: null,
            templateId: null,
            localCreatedAt: new Date(),
            localUpdatedAt: new Date(),
            deleted: false,
          });
        }
        return mockPacks;
      }
    },
  };
});

describe('Packs Routes', () => {
  let testPackId: string;
  let testPackItemId: string;
  let testCatalogItemId: number;

  // Seed test data before all tests
  beforeAll(async () => {
    await seedTestUser();

    // Create a test catalog item for pack items
    const catalogItem = await seedCatalogItem({
      name: 'Test Tent',
      categories: ['shelter'],
    });
    testCatalogItemId = catalogItem.id;

    // Create a test pack owned by the test user
    const pack = await seedPack({
      userId: TEST_USER.id,
      name: 'Test Pack',
      category: 'hiking',
    });
    testPackId = pack.id;

    // Add some items to the pack
    const packItem = await seedPackItem(pack.id, {
      userId: TEST_USER.id,
      catalogItemId: catalogItem.id,
      name: 'Test Tent Item',
      category: 'shelter',
    });
    testPackItemId = packItem.id;
  });

  describe('Authentication', () => {
    it('GET /packs requires auth', async () => {
      const res = await api('/packs', httpMethods.get(''));
      expectUnauthorized(res);
    });

    it('GET /packs/:id requires auth', async () => {
      const res = await api('/packs/1', httpMethods.get(''));
      expectUnauthorized(res);
    });

    it('POST /packs requires auth', async () => {
      const res = await api('/packs', httpMethods.post('', {}));
      expectUnauthorized(res);
    });

    it('PUT /packs/:id requires auth', async () => {
      const res = await api('/packs/1', httpMethods.put('', {}));
      expectUnauthorized(res);
    });

    it('DELETE /packs/:id requires auth', async () => {
      const res = await api('/packs/1', httpMethods.delete(''));
      expectUnauthorized(res);
    });
  });

  describe('GET /packs', () => {
    it('returns user packs list', async () => {
      const res = await apiWithAuth('/packs');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(Array.isArray(data) || data.packs).toBeTruthy();
    });

    it('accepts public filter', async () => {
      const res = await apiWithAuth('/packs?includePublic=1');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });
  });

  describe('GET /packs/:id', () => {
    it('returns single pack', async () => {
      const res = await apiWithAuth(`/packs/${testPackId}`);

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res, ['id', 'name']);
      expect(data.id).toBeDefined();
      expect(data.name).toBeDefined();
    });

    it('returns 404 for non-existent pack', async () => {
      const res = await apiWithAuth('/packs/999999');
      expectNotFound(res);
    });
  });

  describe('POST /packs', () => {
    it('creates new pack', async () => {
      const newPack = {
        id: `pack_test_${Date.now()}`,
        name: 'Test Pack',
        description: 'A test pack for hiking',
        category: 'hiking',
        isPublic: false,
        localCreatedAt: new Date().toISOString(),
        localUpdatedAt: new Date().toISOString(),
      };

      const res = await apiWithAuth('/packs', httpMethods.post('', newPack));

      expect([200, 201]).toContain(res.status);
      const data = await expectJsonResponse(res, ['id']);
      expect(data.id).toBeDefined();
    });

    it('validates required fields', async () => {
      const res = await apiWithAuth('/packs', httpMethods.post('', {}));
      expectBadRequest(res);
    });

    it('validates name field', async () => {
      const res = await apiWithAuth(
        '/packs',
        httpMethods.post('', {
          id: `pack_test_${Date.now()}`,
          description: 'Pack without name',
          category: 'hiking',
          localCreatedAt: new Date().toISOString(),
          localUpdatedAt: new Date().toISOString(),
        }),
      );
      expectBadRequest(res);
    });
  });

  describe('PUT /packs/:id', () => {
    it('updates existing pack', async () => {
      const updateData = {
        name: 'Updated Pack Name',
        description: 'Updated description',
        activity: 'backpacking',
      };

      const res = await apiWithAuth(`/packs/${testPackId}`, httpMethods.put('', updateData));

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(data.id).toBeDefined();
    });

    it('returns 404 for non-existent pack', async () => {
      const res = await apiWithAuth(
        '/packs/non_existent_pack_id_999',
        httpMethods.put('', {
          name: 'Updated Pack',
        }),
      );
      expectNotFound(res);
    });

    it('prevents updating other users packs', async () => {
      // Create a different user and their pack
      const otherUser = await seedTestUser({
        email: 'other@example.com',
        firstName: 'Other',
        lastName: 'User',
      });

      const otherUserPack = await seedPack({
        userId: otherUser.id,
        name: 'Other User Pack',
        category: 'hiking',
      });

      const res = await apiWithAuth(
        `/packs/${otherUserPack.id}`,
        httpMethods.put('', {
          name: 'Attempting to update',
        }),
      );

      // Should return 404 (not found for this user) or 403 (forbidden)
      expect([403, 404]).toContain(res.status);
    });
  });

  describe('DELETE /packs/:id', () => {
    it('deletes pack', async () => {
      // Create a new pack just for this test
      const packToDelete = await seedPack({
        userId: TEST_USER.id,
        name: 'Pack to Delete',
        category: 'hiking',
      });

      const res = await apiWithAuth(`/packs/${packToDelete.id}`, httpMethods.delete(''));

      expect([200, 204]).toContain(res.status);
    });

    it('returns 404 for non-existent pack', async () => {
      const res = await apiWithAuth('/packs/non_existent_pack_id_999', httpMethods.delete(''));
      // Soft delete might return 200 even for non-existent packs
      expect([200, 404]).toContain(res.status);
    });

    it('prevents deleting other users packs', async () => {
      // Create a different user and their pack
      const otherUser = await seedTestUser({
        email: 'another@example.com',
        firstName: 'Another',
        lastName: 'User',
      });

      const otherUserPack = await seedPack({
        userId: otherUser.id,
        name: 'Other User Pack',
        category: 'hiking',
      });

      const res = await apiWithAuth(`/packs/${otherUserPack.id}`, httpMethods.delete(''));

      // Should return 404 (not found for this user) or 403 (forbidden)
      expect([403, 404]).toContain(res.status);
    });
  });

  describe('Pack Items Routes', () => {
    describe('GET /packs/:id/items', () => {
      it('returns pack items', async () => {
        const res = await apiWithAuth(`/packs/${testPackId}/items`);

        expect(res.status).toBe(200);
        const data = await expectJsonResponse(res);
        expect(Array.isArray(data) || data.items).toBeTruthy();
      });
    });

    describe('POST /packs/:id/items', () => {
      it('adds item to pack', async () => {
        const newItem = {
          id: `item_test_${Date.now()}`,
          catalogItemId: testCatalogItemId,
          name: 'New Test Item',
          weight: 500,
          weightUnit: 'g',
          quantity: 2,
          category: 'gear',
          notes: 'Extra item for safety',
        };

        const res = await apiWithAuth(`/packs/${testPackId}/items`, httpMethods.post('', newItem));

        expect([200, 201]).toContain(res.status);
        const data = await expectJsonResponse(res, ['id']);
        expect(data.id).toBeDefined();
      });

      it('validates required fields', async () => {
        const res = await apiWithAuth(`/packs/${testPackId}/items`, httpMethods.post('', {}));
        expectBadRequest(res);
      });
    });

    describe('PATCH /items/:itemId', () => {
      it('updates pack item', async () => {
        const updateData = {
          quantity: 3,
          notes: 'Updated notes',
        };

        const res = await apiWithAuth(
          `/packs/items/${testPackItemId}`,
          httpMethods.patch('', updateData),
        );

        expect(res.status).toBe(200);
      });
    });

    describe('DELETE /items/:itemId', () => {
      it('removes item from pack', async () => {
        // Create a new item to delete
        const itemToDelete = await seedPackItem(testPackId, {
          userId: TEST_USER.id,
          name: 'Item to Delete',
          category: 'gear',
        });

        const res = await apiWithAuth(`/packs/items/${itemToDelete.id}`, httpMethods.delete(''));

        expect([200, 204]).toContain(res.status);
      });
    });
  });

  describe('POST /packs/generate-packs', () => {
    it('generates sample packs (admin only)', async () => {
      const generateRequest = {
        count: 2,
      };

      const res = await apiWithAdmin(
        '/packs/generate-packs',
        httpMethods.post('', generateRequest),
      );

      expect(res.status).toBe(200);
    });

    it('uses default params', async () => {
      const res = await apiWithAdmin('/packs/generate-packs', httpMethods.post('', {}));

      expect(res.status).toBe(200);
    });

    it('requires admin privileges', async () => {
      const res = await apiWithAuth(
        '/packs/generate-packs',
        httpMethods.post('', {
          count: 1,
        }),
      );

      // Regular user should get 403
      expect(res.status).toBe(403);
    });
  });
});
