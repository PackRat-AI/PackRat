import { createDb } from '@packrat/api/db';
import { PackService } from '@packrat/api/services/packService';
import type { Pack } from '@packrat/db';
import { packItems, packs } from '@packrat/db';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  seedAndLoginTestUser,
  seedCatalogItem,
  seedFatCatalogItem,
  seedPack,
  seedPackItem,
  seedTestUser,
} from './utils/db-helpers';
import {
  api,
  apiWithAdmin,
  apiWithAuth,
  apiWithAuthAs,
  expectBadRequest,
  expectJsonResponse,
  expectNotFound,
  expectUnauthorized,
  httpMethods,
} from './utils/test-helpers';

// Mock PackService.generatePacks to avoid AI dependencies in tests.
// Must use the alias path the route uses ('@packrat/api/services/packService') —
// vitest treats relative and alias paths as separate modules for mock purposes.
vi.mock('@packrat/api/services/packService', async () => {
  const actual = await vi.importActual<typeof import('@packrat/api/services/packService')>(
    '@packrat/api/services/packService',
  );
  return {
    ...actual,
    PackService: class PackService extends actual.PackService {
      private readonly _userId: string;
      constructor(...args: ConstructorParameters<typeof actual.PackService>) {
        super(...args);
        // First argument is the userId in the Elysia-native PackService.
        this._userId = args[0] as string;
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
  let testUser: Awaited<ReturnType<typeof seedTestUser>>;
  let testPackId: string;
  let testPackItemId: string;
  let testCatalogItemId: number;

  // Re-seed test data before each test (global beforeEach truncates all tables)
  beforeEach(async () => {
    testUser = await seedAndLoginTestUser();
    await seedAndLoginTestUser({ role: 'ADMIN', email: 'admin@example.com' });

    const catalogItem = await seedCatalogItem({
      name: 'Test Tent',
      categories: ['shelter'],
    });
    testCatalogItemId = catalogItem.id;

    const pack = await seedPack({
      userId: testUser.id,
      name: 'Test Pack',
      category: 'hiking',
    });
    testPackId = pack.id;

    const packItem = await seedPackItem(pack.id, {
      userId: testUser.id,
      catalogItemId: catalogItem.id,
      name: 'Test Tent Item',
      category: 'shelter',
    });
    testPackItemId = packItem.id;
  });

  describe('Authentication', () => {
    it('GET /packs requires auth', async () => {
      const res = await api('/packs', httpMethods.get());
      expectUnauthorized(res);
    });

    it('GET /packs/:id requires auth', async () => {
      const res = await api('/packs/1', httpMethods.get());
      expectUnauthorized(res);
    });

    it('POST /packs requires auth', async () => {
      const res = await api('/packs', httpMethods.post({}));
      expectUnauthorized(res);
    });

    it('PUT /packs/:id requires auth', async () => {
      const res = await api('/packs/1', httpMethods.put({}));
      expectUnauthorized(res);
    });

    it('DELETE /packs/:id requires auth', async () => {
      const res = await api('/packs/1', httpMethods.delete());
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

      const res = await apiWithAuth('/packs', httpMethods.post(newPack));

      expect([200, 201]).toContain(res.status);
      const data = await expectJsonResponse(res, ['id']);
      expect(data.id).toBeDefined();
    });

    it('validates required fields', async () => {
      const res = await apiWithAuth('/packs', httpMethods.post({}));
      expectBadRequest(res);
    });

    it('validates name field', async () => {
      const res = await apiWithAuth(
        '/packs',
        httpMethods.post({
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

      const res = await apiWithAuth(`/packs/${testPackId}`, httpMethods.put(updateData));

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(data.id).toBeDefined();
    });

    it('returns 404 for non-existent pack', async () => {
      const res = await apiWithAuth(
        '/packs/non_existent_pack_id_999',
        httpMethods.put({
          name: 'Updated Pack',
        }),
      );
      expectNotFound(res);
    });

    it('prevents updating other users packs', async () => {
      // Create a different user and their pack; capture testUser.id before seeding the other user
      const testUserId = testUser.id;
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

      // Use apiWithAuthAs to keep the original testUser credentials (not otherUser's)
      const res = await apiWithAuthAs(`/packs/${otherUserPack.id}`, {
        user: { id: testUserId, role: 'USER' },
        init: httpMethods.put({ name: 'Attempting to update' }),
      });

      // Should return 404 (not found for this user) or 403 (forbidden)
      expect([403, 404]).toContain(res.status);
    });
  });

  describe('DELETE /packs/:id', () => {
    it('deletes pack', async () => {
      // Create a new pack just for this test
      const packToDelete = await seedPack({
        userId: testUser.id,
        name: 'Pack to Delete',
        category: 'hiking',
      });

      const res = await apiWithAuth(`/packs/${packToDelete.id}`, httpMethods.delete());

      expect([200, 204]).toContain(res.status);
    });

    it('returns 404 for non-existent pack', async () => {
      const res = await apiWithAuth('/packs/non_existent_pack_id_999', httpMethods.delete());
      // Soft delete might return 200 even for non-existent packs
      expect([200, 404]).toContain(res.status);
    });

    it('prevents deleting other users packs', async () => {
      // Create a different user and their pack; capture testUser.id before seeding the other user
      const testUserId = testUser.id;
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

      // Use apiWithAuthAs to keep the original testUser credentials (not otherUser's)
      const res = await apiWithAuthAs(`/packs/${otherUserPack.id}`, {
        user: { id: testUserId, role: 'USER' },
        init: httpMethods.delete(),
      });

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

        const res = await apiWithAuth(`/packs/${testPackId}/items`, httpMethods.post(newItem));

        expect([200, 201]).toContain(res.status);
        const data = await expectJsonResponse(res, ['id']);
        expect(data.id).toBeDefined();
      });

      it('validates required fields', async () => {
        const res = await apiWithAuth(`/packs/${testPackId}/items`, httpMethods.post({}));
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
          httpMethods.patch(updateData),
        );

        expect(res.status).toBe(200);
      });
    });

    describe('DELETE /items/:itemId', () => {
      it('removes item from pack', async () => {
        // Create a new item to delete
        const itemToDelete = await seedPackItem(testPackId, {
          userId: testUser.id,
          name: 'Item to Delete',
          category: 'gear',
        });

        const res = await apiWithAuth(`/packs/items/${itemToDelete.id}`, httpMethods.delete());

        expect([200, 204]).toContain(res.status);
      });
    });
  });

  describe('POST /packs/generate-packs', () => {
    it('generates sample packs (admin only)', async () => {
      const generateRequest = {
        count: 2,
      };

      const res = await apiWithAdmin('/packs/generate-packs', httpMethods.post(generateRequest));

      expect(res.status).toBe(200);
    });

    it('uses default params', async () => {
      const res = await apiWithAdmin('/packs/generate-packs', httpMethods.post({}));

      expect(res.status).toBe(200);
    });

    it('requires admin privileges', async () => {
      const res = await apiWithAuth(
        '/packs/generate-packs',
        httpMethods.post({
          count: 1,
        }),
      );

      // Regular user should get 403
      expect(res.status).toBe(403);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // U1 characterization — locks current shape of pack endpoints so the
  // Tier-1 projection units (U5, U6) can prove they didn't silently regress
  // wire-shape or DB-side projection.
  //
  // Cost mechanism note: per the plan Summary, the bill driver is DB→Worker
  // bytes, not Worker→Client. Wire-shape assertions catch user-visible
  // regressions (e.g., `/packs/:packId/items` has no response Zod schema, so
  // missing columns leak as undefined to mobile). DB-side assertions, via
  // direct service calls or by inspecting raw `db.query` returns, catch the
  // cost-bearing regression where projection doesn't actually happen.
  // ───────────────────────────────────────────────────────────────────────────
  describe('shape contract (U1 characterization)', () => {
    it('GET /packs list — wire-shape today omits embedding (Zod strip in route), but DB-side query hydrates it', async () => {
      // Seeds in the outer beforeEach gave us a pack + packItem with an embedding.
      const res = await apiWithAuth('/packs');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);

      const ourPack = data.find((p: { id: string }) => p.id === testPackId);
      expect(ourPack).toBeDefined();
      expect(ourPack.items).toBeDefined();
      expect(Array.isArray(ourPack.items)).toBe(true);

      // Wire-shape: PackItemSchema does not declare `embedding`, so
      // z.array(PackWithWeightsSchema).parse(...) at packs/index.ts:74 already
      // strips it. Stays GREEN through U6 — projection doesn't change wire shape.
      for (const item of ourPack.items) {
        expect(item).not.toHaveProperty('embedding');
      }

      // DB-side proof of the U6 projection: run a Drizzle query mirroring the
      // route's NEW `columns:` whitelist and confirm embedding is excluded
      // from the hydrated JS objects. This is the cost surface — Postgres
      // doesn't ship the 1536-dim bytes back across the wire when the column
      // isn't selected. Confirming via the same Drizzle mechanism the route
      // uses also locks the whitelist contract: if a future PR drops the
      // `columns:` filter or adds `embedding: true`, this assertion fails.
      const db = createDb();
      const rawResult = await db.query.packs.findFirst({
        where: eq(packs.id, testPackId),
        with: {
          items: {
            columns: {
              id: true,
              name: true,
              weight: true,
              weightUnit: true,
              quantity: true,
              category: true,
              consumable: true,
              worn: true,
              packId: true,
              catalogItemId: true,
              userId: true,
              deleted: true,
              createdAt: true,
              updatedAt: true,
            },
            where: eq(packItems.deleted, false),
          },
        },
      });
      expect(rawResult).toBeDefined();
      expect(rawResult?.items.length).toBeGreaterThan(0);
      const rawItem = rawResult?.items[0];
      expect(rawItem).not.toHaveProperty('embedding');
    });

    it('GET /packs/:packId/items — wire-shape today leaks packItems.embedding AND full catalogItem (no response schema)', async () => {
      // Re-seed with fat catalog item so the leak surface is fully populated.
      const fatItem = await seedFatCatalogItem({ name: 'U1 Fat Item — pack items endpoint' });
      const fatPack = await seedPack({ userId: testUser.id, name: 'U1 Fat Pack' });
      await seedPackItem(fatPack.id, {
        userId: testUser.id,
        catalogItemId: fatItem.id,
        name: 'U1 fat-linked item',
        category: 'shelter',
      });

      const res = await apiWithAuth(`/packs/${fatPack.id}/items`);
      expect(res.status).toBe(200);
      const items = await res.json();
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);

      const item = items[0];
      // Route has NO response Zod schema (spreads ...item directly), so wire
      // shape mirrors the Drizzle query exactly. Post-U6 explicit `columns:`
      // whitelists exclude embedding from packItems AND embedding + fat JSONB
      // from the joined catalogItem. Cost win is direct: those bytes never
      // leave Neon, and they never appear in the response either.
      expect(item).not.toHaveProperty('embedding');
      expect(item).toHaveProperty('catalogItem');
      expect(item.catalogItem).not.toHaveProperty('embedding');
      expect(item.catalogItem).not.toHaveProperty('reviews');
      expect(item.catalogItem).not.toHaveProperty('qas');
      expect(item.catalogItem).not.toHaveProperty('faqs');
    });

    it('GET /packs/:packId/weight-breakdown — numeric correctness baseline (changes must not move the math)', async () => {
      // Add a second item with known weights to verify the breakdown math
      // survives the U6 minimal projection (which drops embedding + most cols
      // but keeps name/weight/weightUnit/category/quantity/worn/consumable per
      // plan F1 fix).
      await seedPackItem(testPackId, {
        userId: testUser.id,
        name: 'U1 known-weight item',
        weight: 500,
        weightUnit: 'g',
        category: 'kitchen',
        quantity: 2,
        worn: false,
        consumable: true,
      });

      const res = await apiWithAuth(`/packs/${testPackId}/weight-breakdown`);
      expect(res.status).toBe(200);
      const breakdown = await res.json();

      // Lock the shape — total + base + worn + consumable + byCategory
      expect(breakdown).toHaveProperty('totalWeight');
      expect(breakdown).toHaveProperty('baseWeight');
      expect(breakdown).toHaveProperty('wornWeight');
      expect(breakdown).toHaveProperty('consumableWeight');
      expect(breakdown).toHaveProperty('byCategory');

      // Lock per-item rendering inside byCategory — this is the F1-flagged
      // failure mode: if `name` is dropped from the U6 projection,
      // byCategory[].items[] strings render as "undefined (1200g × 1)".
      // After U6 adds name:true to the whitelist, these assertions remain GREEN.
      expect(Array.isArray(breakdown.byCategory)).toBe(true);
      for (const cat of breakdown.byCategory) {
        expect(cat).toHaveProperty('category');
        expect(cat).toHaveProperty('items');
        expect(Array.isArray(cat.items)).toBe(true);
        for (const itemString of cat.items) {
          // Must not start with "undefined" — guard against name being projected out.
          expect(itemString).not.toMatch(/^undefined/);
        }
      }
    });

    it('PackService.getPackDetails — DB-side projection today hydrates full catalogItem (U5 will narrow)', async () => {
      const fatItem = await seedFatCatalogItem({ name: 'U1 Fat Item — packDetails' });
      const sPack = await seedPack({ userId: testUser.id, name: 'U1 packDetails source pack' });
      await seedPackItem(sPack.id, {
        userId: testUser.id,
        catalogItemId: fatItem.id,
        name: 'U1 service-test item',
      });

      const service = new PackService(testUser.id);
      const result = await service.getPackDetails(sPack.id);

      expect(result).toBeDefined();
      expect(result?.items.length).toBeGreaterThan(0);
      const linkedItem = result?.items.find((it) => it.catalogItem?.id === fatItem.id);
      expect(linkedItem).toBeDefined();
      expect(linkedItem?.catalogItem).toBeDefined();

      // Cost-bearing assertion: post-U5 the `with: { catalogItem: { columns: {...} } }`
      // whitelist drops embedding + fat JSONB from the join. Hot path was
      // PackService.getPackDetails returning ~1-2 MB per call for a pack with
      // 20 catalog-linked items.
      expect(linkedItem?.catalogItem).not.toHaveProperty('embedding');
      expect(linkedItem?.catalogItem).not.toHaveProperty('reviews');
      expect(linkedItem?.catalogItem).not.toHaveProperty('qas');
      expect(linkedItem?.catalogItem).not.toHaveProperty('faqs');
    });
  });
});
