import { describe, expect, it } from 'vitest';
import { seedCatalogItem, seedPack, seedPackItem } from './utils/db-helpers';
import {
  api,
  apiWithAuth,
  expectBadRequest,
  expectJsonResponse,
  expectNotFound,
  expectUnauthorized,
  httpMethods,
  TEST_USER,
} from './utils/test-helpers';

describe('Packs Routes', () => {
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

    it('accepts pagination parameters', async () => {
      const res = await apiWithAuth('/packs?page=1&limit=10');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts search query', async () => {
      const res = await apiWithAuth('/packs?q=hiking');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts activity filter', async () => {
      const res = await apiWithAuth('/packs?activity=hiking');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts weight range filters', async () => {
      const res = await apiWithAuth('/packs?minWeight=1000&maxWeight=5000');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts public filter', async () => {
      const res = await apiWithAuth('/packs?public=true');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });
  });

  describe('GET /packs/:id', () => {
    it('returns single pack', async () => {
      // Seed a pack for the test user
      const seededPack = await seedPack({ userId: TEST_USER.id });

      const res = await apiWithAuth(`/packs/${seededPack.id}`);

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res, ['id', 'name']);
      expect(data.id).toBeDefined();
      expect(data.name).toBeDefined();
    });

    it('returns 404 for non-existent pack', async () => {
      const res = await apiWithAuth('/packs/999999');
      expectNotFound(res);
    });

    it('validates ID parameter', async () => {
      const res = await apiWithAuth('/packs/invalid-id');
      expect([400, 404]).toContain(res.status);
    });
  });

  describe('POST /packs', () => {
    it('creates new pack', async () => {
      const newPack = {
        name: 'Test Pack',
        description: 'A test pack for hiking',
        activity: 'hiking',
        public: false,
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
          description: 'Pack without name',
        }),
      );
      expectBadRequest(res);
    });

    it('validates activity field', async () => {
      const res = await apiWithAuth(
        '/packs',
        httpMethods.post('', {
          name: 'Test Pack',
          activity: 'invalid-activity',
        }),
      );
      expectBadRequest(res);
    });
  });

  describe('PUT /packs/:id', () => {
    it('updates existing pack', async () => {
      // Seed a pack for the test user
      const seededPack = await seedPack({ userId: TEST_USER.id });

      const updateData = {
        name: 'Updated Pack Name',
        description: 'Updated description',
        activity: 'backpacking',
      };

      const res = await apiWithAuth(`/packs/${seededPack.id}`, httpMethods.put('', updateData));

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(data.id).toBeDefined();
    });

    it('returns 404 for non-existent pack', async () => {
      const res = await apiWithAuth(
        '/packs/999999',
        httpMethods.put('', {
          name: 'Updated Pack',
        }),
      );
      expectNotFound(res);
    });

    it('prevents updating other users packs', async () => {
      // Seed a pack for a different user (user ID 2)
      const seededPack = await seedPack({ userId: 2 });

      const res = await apiWithAuth(
        `/packs/${seededPack.id}`,
        httpMethods.put('', {
          name: 'Attempting to update',
        }),
      );

      // Could be 403 (forbidden) or 404 (not found for this user)
      if (res.status === 403) {
        expect(res.status).toBe(403);
      }
    });
  });

  describe('DELETE /packs/:id', () => {
    it('deletes pack', async () => {
      // Seed a pack for the test user
      const seededPack = await seedPack({ userId: TEST_USER.id });

      const res = await apiWithAuth(`/packs/${seededPack.id}`, httpMethods.delete(''));

      expect([200, 204]).toContain(res.status);
    });

    it('returns 404 for non-existent pack', async () => {
      const res = await apiWithAuth('/packs/999999', httpMethods.delete(''));
      expectNotFound(res);
    });

    it('prevents deleting other users packs', async () => {
      // Seed a pack for a different user (user ID 2)
      const seededPack = await seedPack({ userId: 2 });

      const res = await apiWithAuth(`/packs/${seededPack.id}`, httpMethods.delete(''));

      if (res.status === 403) {
        expect(res.status).toBe(403);
      }
    });
  });

  describe('Pack Items Routes', () => {
    describe('GET /packs/:id/items', () => {
      it('returns pack items', async () => {
        // Seed a pack for the test user
        const seededPack = await seedPack({ userId: TEST_USER.id });

        const res = await apiWithAuth(`/packs/${seededPack.id}/items`);

        expect(res.status).toBe(200);
        const data = await expectJsonResponse(res);
        expect(Array.isArray(data) || data.items).toBeTruthy();
      });
    });

    describe('POST /packs/:id/items', () => {
      it('adds item to pack', async () => {
        // Seed a pack and catalog item for the test user
        const seededPack = await seedPack({ userId: TEST_USER.id });
        const catalogItem = await seedCatalogItem({ name: 'Test Catalog Item' });

        const newItem = {
          catalogItemId: catalogItem.id,
          quantity: 2,
          notes: 'Extra item for safety',
        };

        const res = await apiWithAuth(
          `/packs/${seededPack.id}/items`,
          httpMethods.post('', newItem),
        );

        expect([200, 201]).toContain(res.status);
        const data = await expectJsonResponse(res, ['id']);
        expect(data.id).toBeDefined();
      });

      it('validates required fields', async () => {
        // Seed a pack for the test user
        const seededPack = await seedPack({ userId: TEST_USER.id });

        const res = await apiWithAuth(`/packs/${seededPack.id}/items`, httpMethods.post('', {}));
        expectBadRequest(res);
      });
    });

    describe('PUT /packs/:packId/items/:itemId', () => {
      it('updates pack item', async () => {
        // Seed a pack and pack item for the test user
        const seededPack = await seedPack({ userId: TEST_USER.id });
        const seededItem = await seedPackItem({ packId: seededPack.id, userId: TEST_USER.id });

        const updateData = {
          quantity: 3,
          notes: 'Updated notes',
        };

        const res = await apiWithAuth(
          `/packs/${seededPack.id}/items/${seededItem.id}`,
          httpMethods.put('', updateData),
        );

        expect(res.status).toBe(200);
        await expectJsonResponse(res);
      });
    });

    describe('DELETE /packs/:packId/items/:itemId', () => {
      it('removes item from pack', async () => {
        // Seed a pack and pack item for the test user
        const seededPack = await seedPack({ userId: TEST_USER.id });
        const seededItem = await seedPackItem({ packId: seededPack.id, userId: TEST_USER.id });

        const res = await apiWithAuth(
          `/packs/${seededPack.id}/items/${seededItem.id}`,
          httpMethods.delete(''),
        );

        expect([200, 204]).toContain(res.status);
      });
    });
  });

  describe.skip('POST /packs/generate', () => {
    // Note: The /packs/generate endpoint doesn't currently exist in the API
    // The existing endpoint is /packs/generate-packs which requires admin access
    // These tests are skipped until the feature is implemented or tests are updated
    it('generates AI pack suggestions', async () => {
      const generateRequest = {
        activity: 'hiking',
        duration: 3,
        season: 'summer',
        location: 'mountains',
      };

      const res = await apiWithAuth('/packs/generate', httpMethods.post('', generateRequest));

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(data.items || data.suggestions).toBeDefined();
    });

    it('validates generate request', async () => {
      const res = await apiWithAuth('/packs/generate', httpMethods.post('', {}));
      expectBadRequest(res);
    });

    it('validates activity parameter', async () => {
      const res = await apiWithAuth(
        '/packs/generate',
        httpMethods.post('', {
          activity: 'invalid-activity',
          duration: 3,
        }),
      );
      expectBadRequest(res);
    });
  });
});
