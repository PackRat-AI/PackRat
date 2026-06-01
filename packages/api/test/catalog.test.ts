import { CatalogService } from '@packrat/api/services';
import { describe, expect, it } from 'vitest';
import { seedCatalogItem, seedFatCatalogItem } from './utils/db-helpers';
import {
  api,
  apiWithApiKey,
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
      const res = await api('/catalog', httpMethods.get());
      expectUnauthorized(res);
    });

    it('GET /catalog/:id requires auth', async () => {
      const res = await api('/catalog/1', httpMethods.get());
      expectUnauthorized(res);
    });

    it('POST /catalog/ requires auth', async () => {
      const res = await api('/catalog', httpMethods.post({}));
      expectUnauthorized(res);
    });

    it('PUT /catalog/:id requires auth', async () => {
      const res = await api('/catalog/1', httpMethods.put({}));
      expectUnauthorized(res);
    });

    it('DELETE /catalog/:id requires auth', async () => {
      const res = await api('/catalog/1', httpMethods.delete());
      expectUnauthorized(res);
    });
  });

  describe('GET /catalog', () => {
    it('returns catalog items list', async () => {
      const res = await apiWithAuth('/catalog');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(Array.isArray(data) || data.items).toBeTruthy();
    });

    it('accepts pagination parameters', async () => {
      const res = await apiWithAuth('/catalog?page=1&limit=10');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts category filter', async () => {
      const res = await apiWithAuth('/catalog?category=shelter');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts search query', async () => {
      const res = await apiWithAuth('/catalog?q=tent');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts weight range filters', async () => {
      const res = await apiWithAuth('/catalog?minWeight=0&maxWeight=1000');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts sorting parameters', async () => {
      const res = await apiWithAuth('/catalog?sortBy=weight&sortOrder=asc');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });
  });

  describe('GET /catalog/categories', () => {
    it('returns available categories', async () => {
      const res = await apiWithAuth('/catalog/categories');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(Array.isArray(data) || data.categories).toBeTruthy();
    });
  });

  describe('GET /catalog/:id', () => {
    it('returns single catalog item', async () => {
      // Seed a catalog item first
      const seededItem = await seedCatalogItem({ name: 'Test Tent for GET' });

      const res = await apiWithAuth(`/catalog/${seededItem.id}`);

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res, ['id', 'name']);
      expect(data.id).toBeDefined();
      expect(data.name).toBeDefined();
    });

    it('returns 404 for non-existent item', async () => {
      const res = await apiWithAuth('/catalog/999999');
      expectNotFound(res);
    });

    it('returns 404 for non-numeric ID (no NaN coercion to SQL)', async () => {
      const res = await apiWithAuth('/catalog/invalid-id');
      expect(res.status).toBe(404);
    });

    it('returns 404 for hex-shaped ID (0x10, not a valid serial id)', async () => {
      const res = await apiWithAuth('/catalog/0x10');
      expect(res.status).toBe(404);
    });

    it('returns 404 for exponent-shaped ID (1e5, not a digits-only id)', async () => {
      const res = await apiWithAuth('/catalog/1e5');
      expect(res.status).toBe(404);
    });

    it('returns 404 for ID larger than PG int4 max', async () => {
      const res = await apiWithAuth('/catalog/9999999999');
      expect(res.status).toBe(404);
    });

    it('returns 404 for ID with leading zero (007 is not a canonical serial id)', async () => {
      const res = await apiWithAuth('/catalog/007');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /catalog', () => {
    it('creates new catalog item', async () => {
      const newItem = {
        name: 'Test Tent',
        productUrl: 'https://example.com/tent',
        sku: `TEST-CREATE-${Date.now()}`,
        weight: 1200,
        weightUnit: 'g',
        description: 'A test tent for backpacking',
        categories: ['shelter'],
        price: 299.99,
      };

      const res = await apiWithAuth('/catalog', httpMethods.post(newItem));

      expect([201, 200]).toContain(res.status);
      const data = await expectJsonResponse(res, ['id']);
      expect(data.id).toBeDefined();
    });

    it('validates required fields', async () => {
      const res = await apiWithAuth('/catalog', httpMethods.post({}));
      expectBadRequest(res);
    });

    it('validates name field', async () => {
      const res = await apiWithAuth(
        '/catalog',
        httpMethods.post({
          productUrl: 'https://example.com/tent',
          sku: 'TEST-123',
          weight: 1200,
          weightUnit: 'g',
        }),
      );
      expectBadRequest(res);
    });

    it('validates weight field', async () => {
      const res = await apiWithAuth(
        '/catalog',
        httpMethods.post({
          name: 'Test Item',
          productUrl: 'https://example.com/tent',
          sku: 'TEST-123',
          weight: -1, // Invalid weight
          weightUnit: 'g',
        }),
      );
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /catalog/:id', () => {
    it('updates existing catalog item', async () => {
      // Seed a catalog item first
      const seededItem = await seedCatalogItem({ name: 'Original Name' });

      const updateData = {
        name: 'Updated Test Item',
        weight: 1500,
      };

      const res = await apiWithAuth(`/catalog/${seededItem.id}`, httpMethods.put(updateData));

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(data.id).toBeDefined();
    });

    it('returns 404 for non-existent item', async () => {
      const res = await apiWithAuth(
        '/catalog/999999',
        httpMethods.put({
          name: 'Updated Item',
        }),
      );
      expectNotFound(res);
    });

    it('validates update data', async () => {
      // Seed a catalog item first
      const seededItem = await seedCatalogItem();

      const res = await apiWithAuth(
        `/catalog/${seededItem.id}`,
        httpMethods.put({
          weight: -1, // Invalid weight
        }),
      );
      expectBadRequest(res);
    });
  });

  describe('DELETE /catalog/:id', () => {
    it('deletes catalog item', async () => {
      // Seed a catalog item first
      const seededItem = await seedCatalogItem({ name: 'Item to Delete' });

      const res = await apiWithAuth(`/catalog/${seededItem.id}`, httpMethods.delete());

      expect(res.status).toBeOneOf([200, 204]);
    });

    it('returns 404 for non-existent item', async () => {
      const res = await apiWithAuth('/catalog/999999', httpMethods.delete());
      expectNotFound(res);
    });
  });

  describe('POST /catalog/etl', () => {
    it('queues ETL job', async () => {
      const res = await apiWithApiKey(
        '/catalog/etl',
        httpMethods.post({
          filename: 'test.csv',
          chunks: ['chunk1.csv'],
          source: 'test-source',
          scraperRevision: 'v1.0.0',
        }),
      );

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('regular users cannot queue ETL without API key', async () => {
      const res = await apiWithAuth(
        '/catalog/etl',
        httpMethods.post({
          filename: 'test.csv',
          chunks: ['chunk1.csv'],
          source: 'test-source',
          scraperRevision: 'v1.0.0',
        }),
      );
      expect(res.status).toBe(401);
    });
  });

  describe('POST /catalog/backfill-embeddings', () => {
    it('backfills embeddings', async () => {
      const res = await apiWithApiKey('/catalog/backfill-embeddings', httpMethods.post({}));

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('regular users cannot backfill embeddings without API key', async () => {
      const res = await apiWithAuth('/catalog/backfill-embeddings', httpMethods.post({}));
      expect(res.status).toBe(401);
    });
  });

  describe('GET /catalog/:id/similar', () => {
    it('requires authentication', async () => {
      const res = await api('/catalog/1/similar');
      expectUnauthorized(res);
    });

    it('returns similar items for existing catalog item', async () => {
      // Seed a catalog item first
      const seededItem = await seedCatalogItem({ name: 'Test Tent for Similar' });

      const res = await apiWithAuth(`/catalog/${seededItem.id}/similar`);

      expect(res.status).toBe(200);
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
    });

    it('returns 404 for non-existent catalog item', async () => {
      const res = await apiWithAuth('/catalog/999999/similar');
      expectNotFound(res);
    });

    it('accepts limit parameter', async () => {
      // Seed a catalog item first
      const seededItem = await seedCatalogItem({ name: 'Test Tent for Limit' });

      const res = await apiWithAuth(`/catalog/${seededItem.id}/similar?limit=3`);

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res, ['items']);
      expect(data.items.length).toBeLessThanOrEqual(3);
    });

    it('accepts threshold parameter', async () => {
      // Seed a catalog item first
      const seededItem = await seedCatalogItem({ name: 'Test Tent for Threshold' });

      const res = await apiWithAuth(`/catalog/${seededItem.id}/similar?threshold=0.5`);

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res, ['items']);
      // All returned items should have similarity >= 0.5
      if (data.items.length > 0) {
        for (const item of data.items) {
          expect(item.similarity).toBeGreaterThanOrEqual(0.5);
        }
      }
    });

    it('validates limit parameter bounds', async () => {
      // Seed a catalog item first
      const seededItem = await seedCatalogItem({ name: 'Test Tent for Bounds' });

      // Test upper bound
      const res1 = await apiWithAuth(`/catalog/${seededItem.id}/similar?limit=50`);
      expect(res1.status).toBe(200);
      const data = await expectJsonResponse(res1, ['items']);
      expect(data.items.length).toBeLessThanOrEqual(20); // Should be capped at 20

      // Test lower bound
      const res2 = await apiWithAuth(`/catalog/${seededItem.id}/similar?limit=0`);
      const data2 = await expectJsonResponse(res2, ['items']);
      expect(data2.items.length).toBeGreaterThanOrEqual(0); // Should be at least 0
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // U1 characterization — locks current shape of catalog endpoints so the
  // Tier-1 projection units (U2-U6) can prove they didn't silently regress
  // wire-shape or DB-side projection. Each assertion flips at the unit that
  // changes its underlying query — the flip is part of that unit's commit.
  //
  // Cost mechanism note (see plan Summary): the win is at the DB→Worker
  // boundary, not Worker→Client. Service-level assertions below check
  // whether the embedding column is hydrated into the JS object returned by
  // the service (the actual cost surface). Wire-shape assertions are
  // secondary because Zod schemas strip embedding on the way out for most
  // catalog routes regardless of query projection.
  // ───────────────────────────────────────────────────────────────────────────
  describe('shape contract (U1 characterization)', () => {
    it('GET /catalog list — wire-shape excludes embedding AND fat JSONB (post-U4 projection)', async () => {
      await seedFatCatalogItem({ name: 'U1 Fat Item — catalog list' });

      const res = await apiWithAuth('/catalog?limit=5');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBeGreaterThan(0);

      const seededItem = data.items.find((it: { name: string }) =>
        it.name?.includes('U1 Fat Item'),
      );
      expect(seededItem).toBeDefined();

      expect(seededItem).toHaveProperty('id');
      expect(seededItem).toHaveProperty('name');
      expect(seededItem).toHaveProperty('sku');
      expect(seededItem).toHaveProperty('brand');
      expect(seededItem).toHaveProperty('weight');
      // Embedding already absent from wire (Zod schema doesn't include it);
      // post-U4 also absent at the DB-side projection.
      expect(seededItem).not.toHaveProperty('embedding');
      // Fat JSONB dropped from list projection per U4 — detail endpoint still has them.
      expect(seededItem).not.toHaveProperty('reviews');
      expect(seededItem).not.toHaveProperty('qas');
      expect(seededItem).not.toHaveProperty('faqs');
      expect(seededItem).not.toHaveProperty('variants');
      expect(seededItem).not.toHaveProperty('techs');
      expect(seededItem).not.toHaveProperty('links');
    });

    it('CatalogService.getCatalogItems — DB-side projection excludes embedding + fat JSONB (post-U4)', async () => {
      await seedFatCatalogItem({ name: 'U1 Fat Item — service projection' });

      const service = new CatalogService();
      const result = await service.getCatalogItems({ limit: 5 });

      const seededItem = result.items.find((it) => it.name?.includes('U1 Fat Item'));
      expect(seededItem).toBeDefined();

      // Cost-bearing assertion: post-U4 the service projects scalars only.
      // Bytes don't leave Postgres for these fields, which is the actual cost win
      // (wire-shape Zod strip happens downstream of the egress).
      expect(seededItem).not.toHaveProperty('embedding');
      expect(seededItem).not.toHaveProperty('reviews');
      expect(seededItem).not.toHaveProperty('qas');
      expect(seededItem).not.toHaveProperty('faqs');
      expect(seededItem).not.toHaveProperty('techs');
      expect(seededItem).not.toHaveProperty('links');
      expect(seededItem).not.toHaveProperty('variants');
    });

    it('GET /catalog/:id — baseline shape (not changing in this PR; locked ahead of pivot migration)', async () => {
      const seeded = await seedFatCatalogItem({ name: 'U1 Fat Item — detail' });

      const res = await apiWithAuth(`/catalog/${seeded.id}`);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.id).toBe(seeded.id);
      expect(data.name).toBe('U1 Fat Item — detail');
      // Wire-shape baseline — embedding stripped, fat JSONB present, usageCount computed.
      expect(data).not.toHaveProperty('embedding');
      expect(data).toHaveProperty('reviews');
      expect(data).toHaveProperty('qas');
      expect(data).toHaveProperty('faqs');
      expect(data).toHaveProperty('usageCount');
    });

    it('GET /catalog/:id/similar — baseline shape (not changing in this PR; locked ahead of pivot migration)', async () => {
      const seeded = await seedFatCatalogItem({ name: 'U1 Fat Item — similar source' });

      const res = await apiWithAuth(`/catalog/${seeded.id}/similar?limit=3&threshold=0`);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('sourceItem');
      expect(data).toHaveProperty('total');
      expect(Array.isArray(data.items)).toBe(true);
      // sourceItem already excludes embedding (route destructures it out at routes/catalog/index.ts:470).
      expect(data.sourceItem).not.toHaveProperty('embedding');
      // Each result item already excludes embedding (route destructures at line 455).
      for (const item of data.items) {
        expect(item).not.toHaveProperty('embedding');
        expect(item).toHaveProperty('similarity');
      }
    });

    it('GET /catalog/vector-search — baseline shape (not changing in this PR; locked ahead of pivot migration)', async () => {
      await seedFatCatalogItem({ name: 'U1 Fat Item — vector search' });

      // Vector search requires a real embedding for the source query; without an AI provider
      // configured in tests this path returns { items: [] } early. Assert the response envelope
      // shape regardless of whether items are populated.
      const res = await apiWithAuth('/catalog/vector-search?q=fat%20tent');
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('limit');
      expect(data).toHaveProperty('offset');
      expect(data).toHaveProperty('nextOffset');
      expect(Array.isArray(data.items)).toBe(true);
      // When the search returns items, each has similarity and no embedding.
      for (const item of data.items) {
        expect(item).not.toHaveProperty('embedding');
        expect(item).toHaveProperty('similarity');
      }
    });
  });
});
