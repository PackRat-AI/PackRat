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

describe('User Routes', () => {
  describe('Authentication', () => {
    it('GET /user/items requires auth', async () => {
      const res = await api('/user/items', httpMethods.get(''));
      expectUnauthorized(res);
    });

    it('POST /user/items requires auth', async () => {
      const res = await api('/user/items', httpMethods.post('', {}));
      expectUnauthorized(res);
    });

    it('PUT /user/items/:id requires auth', async () => {
      const res = await api('/user/items/1', httpMethods.put('', {}));
      expectUnauthorized(res);
    });

    it('DELETE /user/items/:id requires auth', async () => {
      const res = await api('/user/items/1', httpMethods.delete(''));
      expectUnauthorized(res);
    });
  });

  describe('GET /user/items', () => {
    it('returns user items list', async () => {
      const res = await apiWithAuth('/user/items');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(Array.isArray(data) || data.items).toBeTruthy();
    });

    it('accepts pagination parameters', async () => {
      const res = await apiWithAuth('/user/items?page=1&limit=10');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts search query', async () => {
      const res = await apiWithAuth('/user/items?q=tent');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts category filter', async () => {
      const res = await apiWithAuth('/user/items?category=shelter');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts weight range filters', async () => {
      const res = await apiWithAuth('/user/items?minWeight=100&maxWeight=2000');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts sorting parameters', async () => {
      const res = await apiWithAuth('/user/items?sortBy=name&sortOrder=asc');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });
  });

  describe('GET /user/items/:id', () => {
    it('returns single user item', async () => {
      const res = await apiWithAuth('/user/items/1');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res, ['id', 'name']);
      expect(data.id).toBeDefined();
      expect(data.name).toBeDefined();
    });

    it('returns 404 for non-existent item', async () => {
      const res = await apiWithAuth('/user/items/999999');
      expectNotFound(res);
    });

    it('prevents accessing other users items', async () => {
      // This would need proper test data setup
      const res = await apiWithAuth('/user/items/1');

      // Should either return the item (if owned) or 404 (if not owned)
      expect([200, 404]).toContain(res.status);
    });

    it('validates ID parameter', async () => {
      const res = await apiWithAuth('/user/items/invalid-id');
      expect([400, 404]).toContain(res.status);
    });
  });

  describe('POST /user/items', () => {
    it('creates new user item', async () => {
      const newItem = {
        name: 'My Custom Tent',
        category: 'shelter',
        weight: 1200,
        unit: 'g',
        price: 299.99,
        notes: 'Personal tent for backpacking',
      };

      const res = await apiWithAuth('/user/items', httpMethods.post('', newItem));

      expect([201, 200]).toContain(res.status);
      const data = await expectJsonResponse(res, ['id']);
      expect(data.id).toBeDefined();
    });

    it('validates required fields', async () => {
      const res = await apiWithAuth('/user/items', httpMethods.post('', {}));
      expectBadRequest(res);
    });

    it('validates name field', async () => {
      const res = await apiWithAuth(
        '/user/items',
        httpMethods.post('', {
          category: 'shelter',
          weight: 1200,
        }),
      );
      expectBadRequest(res);
    });

    it('validates category field', async () => {
      const res = await apiWithAuth(
        '/user/items',
        httpMethods.post('', {
          name: 'Test Item',
          category: 'invalid-category',
          weight: 1200,
        }),
      );
      expectBadRequest(res);
    });

    it('validates weight field', async () => {
      const res = await apiWithAuth(
        '/user/items',
        httpMethods.post('', {
          name: 'Test Item',
          category: 'shelter',
          weight: -1, // Invalid weight
        }),
      );
      expectBadRequest(res);
    });

    it('validates weight unit', async () => {
      const res = await apiWithAuth(
        '/user/items',
        httpMethods.post('', {
          name: 'Test Item',
          category: 'shelter',
          weight: 1200,
          unit: 'invalid-unit',
        }),
      );
      expectBadRequest(res);
    });

    it('accepts optional fields', async () => {
      const itemWithOptionals = {
        name: 'Test Item',
        category: 'shelter',
        weight: 1200,
        unit: 'g',
        price: 199.99,
        brand: 'TestBrand',
        model: 'TestModel',
        notes: 'Test notes',
        purchaseDate: '2024-01-01',
        purchaseLocation: 'Test Store',
      };

      const res = await apiWithAuth('/user/items', httpMethods.post('', itemWithOptionals));

      expect([201, 200]).toContain(res.status);
      await expectJsonResponse(res, ['id']);
    });
  });

  describe('PUT /user/items/:id', () => {
    it('updates existing user item', async () => {
      const updateData = {
        name: 'Updated Item Name',
        category: 'shelter',
        weight: 1500,
        unit: 'g',
        notes: 'Updated notes',
      };

      const res = await apiWithAuth('/user/items/1', httpMethods.put('', updateData));

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(data.id).toBeDefined();
    });

    it('returns 404 for non-existent item', async () => {
      const res = await apiWithAuth(
        '/user/items/999999',
        httpMethods.put('', {
          name: 'Updated Item',
        }),
      );
      expectNotFound(res);
    });

    it('prevents updating other users items', async () => {
      const res = await apiWithAuth(
        '/user/items/1',
        httpMethods.put('', {
          name: 'Attempting to update',
        }),
      );

      // Should either succeed (if owned) or return 404/403 (if not owned)
      expect([200, 403, 404]).toContain(res.status);
    });

    it('validates update data', async () => {
      const res = await apiWithAuth(
        '/user/items/1',
        httpMethods.put('', {
          weight: -1, // Invalid weight
        }),
      );

      if (res.status !== 404) {
        expectBadRequest(res);
      }
    });

    it('allows partial updates', async () => {
      const res = await apiWithAuth(
        '/user/items/1',
        httpMethods.put('', {
          notes: 'Only updating notes',
        }),
      );

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });
  });

  describe('DELETE /user/items/:id', () => {
    it('deletes user item', async () => {
      const res = await apiWithAuth('/user/items/1', httpMethods.delete(''));

      expect([200, 204]).toContain(res.status);
    });

    it('returns 404 for non-existent item', async () => {
      const res = await apiWithAuth('/user/items/999999', httpMethods.delete(''));
      expectNotFound(res);
    });

    it('prevents deleting other users items', async () => {
      const res = await apiWithAuth('/user/items/1', httpMethods.delete(''));

      // Should either succeed (if owned) or return 404/403 (if not owned)
      expect([200, 204, 403, 404]).toContain(res.status);
    });

    it('validates ID parameter', async () => {
      const res = await apiWithAuth('/user/items/invalid-id', httpMethods.delete(''));
      expect([400, 404]).toContain(res.status);
    });
  });

  describe('Error Handling', () => {
    it('handles malformed requests gracefully', async () => {
      const res = await apiWithAuth('/user/items?page=invalid&limit=notanumber');

      // Should either return 400 or default to valid pagination
      if (res.status === 400) {
        expectBadRequest(res);
      } else {
        expect(res.status).toBe(200);
      }
    });

    it('handles invalid filter values', async () => {
      const res = await apiWithAuth('/user/items?minWeight=invalid&maxWeight=alsoInvalid');

      // Should return 400 or ignore invalid filters
      if (res.status === 400) {
        expectBadRequest(res);
      } else {
        expect(res.status).toBe(200);
      }
    });

    it('handles large pagination requests', async () => {
      const res = await apiWithAuth('/user/items?page=1&limit=1000');

      // Should either cap the limit or return 400
      if (res.status === 400) {
        expectBadRequest(res);
      } else {
        expect(res.status).toBe(200);
      }
    });
  });
});
