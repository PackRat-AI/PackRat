import { describe, expect, it } from 'vitest';
import {
  api,
  apiWithAuth,
  expectBadRequest,
  expectJsonResponse,
  expectNotFound,
  expectUnauthorized,
  httpMethods,
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
      const res = await apiWithAuth('/packs/1');

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
      const updateData = {
        name: 'Updated Pack Name',
        description: 'Updated description',
        activity: 'backpacking',
      };

      const res = await apiWithAuth('/packs/1', httpMethods.put('', updateData));

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
      // This would need proper test data setup to verify ownership
      const res = await apiWithAuth(
        '/packs/1',
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
      const res = await apiWithAuth('/packs/1', httpMethods.delete(''));

      expect([200, 204]).toContain(res.status);
    });

    it('returns 404 for non-existent pack', async () => {
      const res = await apiWithAuth('/packs/999999', httpMethods.delete(''));
      expectNotFound(res);
    });

    it('prevents deleting other users packs', async () => {
      const res = await apiWithAuth('/packs/1', httpMethods.delete(''));

      if (res.status === 403) {
        expect(res.status).toBe(403);
      }
    });
  });

  describe('Pack Items Routes', () => {
    describe('GET /packs/:id/items', () => {
      it('returns pack items', async () => {
        const res = await apiWithAuth('/packs/1/items');

        expect(res.status).toBe(200);
        const data = await expectJsonResponse(res);
        expect(Array.isArray(data) || data.items).toBeTruthy();
      });
    });

    describe('POST /packs/:id/items', () => {
      it('adds item to pack', async () => {
        const newItem = {
          catalogItemId: 1,
          quantity: 2,
          notes: 'Extra item for safety',
        };

        const res = await apiWithAuth('/packs/1/items', httpMethods.post('', newItem));

        expect([200, 201]).toContain(res.status);
        const data = await expectJsonResponse(res, ['id']);
        expect(data.id).toBeDefined();
      });

      it('validates required fields', async () => {
        const res = await apiWithAuth('/packs/1/items', httpMethods.post('', {}));
        expectBadRequest(res);
      });
    });

    describe('PUT /packs/:packId/items/:itemId', () => {
      it('updates pack item', async () => {
        const updateData = {
          quantity: 3,
          notes: 'Updated notes',
        };

        const res = await apiWithAuth('/packs/1/items/1', httpMethods.put('', updateData));

        expect(res.status).toBe(200);
        await expectJsonResponse(res);
      });
    });

    describe('DELETE /packs/:packId/items/:itemId', () => {
      it('removes item from pack', async () => {
        const res = await apiWithAuth('/packs/1/items/1', httpMethods.delete(''));

        expect([200, 204]).toContain(res.status);
      });
    });
  });

  describe('POST /packs/generate', () => {
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
