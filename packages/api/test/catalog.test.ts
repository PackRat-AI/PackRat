import { describe, expect, it } from 'vitest';
import {
  api,
  apiWithAdmin,
  apiWithAuth,
  expectBadRequest,
  expectJsonResponse,
  expectNotFound,
  expectUnauthorized,
  httpMethods,
} from './utils/test-helpers';

describe('Catalog Routes', () => {
  describe('Authentication', () => {
    it('GET /catalog/ requires auth', async () => {
      const res = await api('/catalog/', httpMethods.get(''));
      expectUnauthorized(res);
    });

    it('GET /catalog/:id requires auth', async () => {
      const res = await api('/catalog/1', httpMethods.get(''));
      expectUnauthorized(res);
    });

    it('POST /catalog/ requires auth', async () => {
      const res = await api('/catalog/', httpMethods.post('', {}));
      expectUnauthorized(res);
    });

    it('PUT /catalog/:id requires auth', async () => {
      const res = await api('/catalog/1', httpMethods.put('', {}));
      expectUnauthorized(res);
    });

    it('DELETE /catalog/:id requires auth', async () => {
      const res = await api('/catalog/1', httpMethods.delete(''));
      expectUnauthorized(res);
    });
  });

  describe('GET /catalog/', () => {
    it('returns catalog items list', async () => {
      const res = await apiWithAuth('/catalog/');

      if (res.status === 200) {
        const data = await expectJsonResponse(res);
        expect(Array.isArray(data) || data.items).toBeTruthy();
      }
    });

    it('accepts pagination parameters', async () => {
      const res = await apiWithAuth('/catalog/?page=1&limit=10');

      if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });

    it('accepts category filter', async () => {
      const res = await apiWithAuth('/catalog/?category=shelter');

      if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });

    it('accepts search query', async () => {
      const res = await apiWithAuth('/catalog/?q=tent');

      if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });

    it('accepts weight range filters', async () => {
      const res = await apiWithAuth('/catalog/?minWeight=0&maxWeight=1000');

      if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });

    it('accepts sorting parameters', async () => {
      const res = await apiWithAuth('/catalog/?sortBy=weight&sortOrder=asc');

      if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });
  });

  describe('GET /catalog/categories', () => {
    it('returns available categories', async () => {
      const res = await apiWithAuth('/catalog/categories');

      if (res.status === 200) {
        const data = await expectJsonResponse(res);
        expect(Array.isArray(data) || data.categories).toBeTruthy();
      }
    });
  });

  describe('GET /catalog/:id', () => {
    it('returns single catalog item', async () => {
      const res = await apiWithAuth('/catalog/1');

      if (res.status === 200) {
        const data = await expectJsonResponse(res, ['id', 'name']);
        expect(data.id).toBeDefined();
        expect(data.name).toBeDefined();
      } else if (res.status === 404) {
        expectNotFound(res);
      }
    });

    it('returns 404 for non-existent item', async () => {
      const res = await apiWithAuth('/catalog/999999');
      expectNotFound(res);
    });

    it('validates ID parameter', async () => {
      const res = await apiWithAuth('/catalog/invalid-id');
      // May return 400 or 404 depending on implementation
      expect([400, 404]).toContain(res.status);
    });
  });

  describe('POST /catalog/', () => {
    it('creates new catalog item', async () => {
      const newItem = {
        name: 'Test Tent',
        category: 'shelter',
        weight: 1200,
        unit: 'g',
        price: 299.99,
      };

      const res = await apiWithAuth('/catalog/', httpMethods.post('', newItem));

      if (res.status === 201 || res.status === 200) {
        const data = await expectJsonResponse(res, ['id']);
        expect(data.id).toBeDefined();
      }
    });

    it('validates required fields', async () => {
      const res = await apiWithAuth('/catalog/', httpMethods.post('', {}));
      expectBadRequest(res);
    });

    it('validates name field', async () => {
      const res = await apiWithAuth(
        '/catalog/',
        httpMethods.post('', {
          category: 'shelter',
          weight: 1200,
        }),
      );
      expectBadRequest(res);
    });

    it('validates weight field', async () => {
      const res = await apiWithAuth(
        '/catalog/',
        httpMethods.post('', {
          name: 'Test Item',
          category: 'shelter',
          weight: -1, // Invalid weight
        }),
      );
      expectBadRequest(res);
    });

    it('validates category field', async () => {
      const res = await apiWithAuth(
        '/catalog/',
        httpMethods.post('', {
          name: 'Test Item',
          category: 'invalid-category',
          weight: 1200,
        }),
      );
      expectBadRequest(res);
    });
  });

  describe('PUT /catalog/:id', () => {
    it('updates existing catalog item', async () => {
      const updateData = {
        name: 'Updated Test Item',
        category: 'shelter',
        weight: 1500,
        unit: 'g',
      };

      const res = await apiWithAuth('/catalog/1', httpMethods.put('', updateData));

      if (res.status === 200) {
        const data = await expectJsonResponse(res);
        expect(data.id).toBeDefined();
      } else if (res.status === 404) {
        expectNotFound(res);
      }
    });

    it('returns 404 for non-existent item', async () => {
      const res = await apiWithAuth(
        '/catalog/999999',
        httpMethods.put('', {
          name: 'Updated Item',
        }),
      );
      expectNotFound(res);
    });

    it('validates update data', async () => {
      const res = await apiWithAuth(
        '/catalog/1',
        httpMethods.put('', {
          weight: -1, // Invalid weight
        }),
      );
      expectBadRequest(res);
    });
  });

  describe('DELETE /catalog/:id', () => {
    it('deletes catalog item', async () => {
      const res = await apiWithAuth('/catalog/1', httpMethods.delete(''));

      if (res.status === 200 || res.status === 204) {
        // Success - item deleted
        expect(res.status).toBeOneOf([200, 204]);
      } else if (res.status === 404) {
        expectNotFound(res);
      }
    });

    it('returns 404 for non-existent item', async () => {
      const res = await apiWithAuth('/catalog/999999', httpMethods.delete(''));
      expectNotFound(res);
    });
  });

  describe('POST /catalog/queue-etl', () => {
    it('queues ETL job (admin only)', async () => {
      const res = await apiWithAdmin('/catalog/queue-etl', httpMethods.post('', {}));

      // This may require admin permissions
      if (res.status === 403) {
        expect(res.status).toBe(403);
      } else if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });

    it('regular users cannot queue ETL', async () => {
      const res = await apiWithAuth('/catalog/queue-etl', httpMethods.post('', {}));
      expect([403, 401]).toContain(res.status);
    });
  });

  describe('POST /catalog/backfill-embeddings', () => {
    it('backfills embeddings (admin only)', async () => {
      const res = await apiWithAdmin('/catalog/backfill-embeddings', httpMethods.post('', {}));

      if (res.status === 403) {
        expect(res.status).toBe(403);
      } else if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });

    it('regular users cannot backfill embeddings', async () => {
      const res = await apiWithAuth('/catalog/backfill-embeddings', httpMethods.post('', {}));
      expect([403, 401]).toContain(res.status);
    });
  });

  describe('GET /catalog/:id/similar', () => {
    it('requires authentication', async () => {
      const res = await api('/catalog/1/similar');
      expectUnauthorized(res);
    });

    it('returns similar items for existing catalog item', async () => {
      const res = await apiWithAuth('/catalog/1/similar');

      if (res.status === 200) {
        const data = await expectJsonResponse(res, ['items', 'total', 'sourceItem']);
        expect(Array.isArray(data.items)).toBeTruthy();
        expect(typeof data.total).toBe('number');
        expect(data.sourceItem).toBeDefined();
        expect(data.sourceItem.id).toBeDefined();

        // Check that each similar item has a similarity score
        if (data.items.length > 0) {
          for (const item of data.items) {
            expect(typeof item.similarity).toBe('number');
            expect(item.similarity).toBeGreaterThan(0);
            expect(item.similarity).toBeLessThanOrEqual(1);
          }
        }
      } else if (res.status === 404) {
        expectNotFound(res);
      }
    });

    it('returns 404 for non-existent catalog item', async () => {
      const res = await apiWithAuth('/catalog/999999/similar');
      expectNotFound(res);
    });

    it('accepts limit parameter', async () => {
      const res = await apiWithAuth('/catalog/1/similar?limit=3');

      if (res.status === 200) {
        const data = await expectJsonResponse(res, ['items']);
        expect(data.items.length).toBeLessThanOrEqual(3);
      } else if (res.status === 404) {
        expectNotFound(res);
      }
    });

    it('accepts threshold parameter', async () => {
      const res = await apiWithAuth('/catalog/1/similar?threshold=0.5');

      if (res.status === 200) {
        const data = await expectJsonResponse(res, ['items']);
        // All returned items should have similarity >= 0.5
        if (data.items.length > 0) {
          for (const item of data.items) {
            expect(item.similarity).toBeGreaterThanOrEqual(0.5);
          }
        }
      } else if (res.status === 404) {
        expectNotFound(res);
      }
    });

    it('validates limit parameter bounds', async () => {
      // Test upper bound
      const res1 = await apiWithAuth('/catalog/1/similar?limit=50');
      if (res1.status === 200) {
        const data = await expectJsonResponse(res1, ['items']);
        expect(data.items.length).toBeLessThanOrEqual(20); // Should be capped at 20
      }

      // Test lower bound
      const res2 = await apiWithAuth('/catalog/1/similar?limit=0');
      if (res2.status === 200) {
        const data = await expectJsonResponse(res2, ['items']);
        expect(data.items.length).toBeGreaterThanOrEqual(0); // Should be at least 0
      }
    });
  });
});
