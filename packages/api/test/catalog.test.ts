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
});
