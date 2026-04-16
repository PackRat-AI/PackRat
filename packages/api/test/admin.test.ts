import { createDb } from '@packrat/api/db';
import { refreshTokens } from '@packrat/api/db/schema';
import type { Context } from 'hono';
import { describe, expect, it } from 'vitest';
import { seedCatalogItem, seedPack, seedTestUser } from './utils/db-helpers';
import {
  api,
  apiWithBasicAuth,
  expectJsonResponse,
  expectUnauthorized,
} from './utils/test-helpers';

describe('Admin Routes', () => {
  describe('Authentication', () => {
    it('requires auth for all admin routes', async () => {
      const routes = ['/stats', '/users-list', '/packs-list', '/catalog-list'];
      for (const route of routes) {
        const res = await api(`/admin${route}`);
        expectUnauthorized(res);
      }
    });

    it('rejects invalid basic auth credentials', async () => {
      const res = await api('/admin/stats', {
        headers: { Authorization: `Basic ${btoa('wrong:credentials')}` },
      });
      expectUnauthorized(res);
    });
  });

  describe('GET /admin/stats', () => {
    it('returns system statistics', async () => {
      const res = await apiWithBasicAuth('/stats');
      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res, ['users', 'packs', 'items']);
      expect(typeof data.users).toBe('number');
      expect(typeof data.packs).toBe('number');
      expect(typeof data.items).toBe('number');
    });

    it('stats reflect seeded data', async () => {
      const before = await (await apiWithBasicAuth('/stats')).json();

      const user = await seedTestUser({ email: 'admin-stats@example.com' });
      await seedPack({ userId: user.id, name: 'Admin stats pack' });
      await seedCatalogItem({ name: 'Admin stats item' });

      const after = await (await apiWithBasicAuth('/stats')).json();
      expect(after.users).toBeGreaterThanOrEqual(before.users + 1);
      expect(after.packs).toBeGreaterThanOrEqual(before.packs + 1);
      expect(after.items).toBeGreaterThanOrEqual(before.items + 1);
    });
  });

  describe('GET /admin/users-list', () => {
    it('returns paginated users list', async () => {
      const res = await apiWithBasicAuth('/users-list');
      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(Array.isArray(data)).toBe(true);
    });

    it('accepts search query parameter', async () => {
      const res = await apiWithBasicAuth('/users-list?q=test');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /admin/packs-list', () => {
    it('returns paginated packs list', async () => {
      const res = await apiWithBasicAuth('/packs-list');
      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(Array.isArray(data)).toBe(true);
    });

    it('accepts search query parameter', async () => {
      const res = await apiWithBasicAuth('/packs-list?q=hiking');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /admin/catalog-list', () => {
    it('returns paginated catalog list', async () => {
      const res = await apiWithBasicAuth('/catalog-list');
      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(Array.isArray(data)).toBe(true);
    });

    it('accepts search query parameter', async () => {
      const res = await apiWithBasicAuth('/catalog-list?q=tent');
      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /admin/users/:id', () => {
    it('deletes a user', async () => {
      const user = await seedTestUser({ email: 'admin-del-user@example.com' });
      const res = await apiWithBasicAuth(`/users/${user.id}`, { method: 'DELETE' });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('returns 404 for a non-existent user', async () => {
      const res = await apiWithBasicAuth('/users/999999', { method: 'DELETE' });
      expect(res.status).toBe(404);
    });

    it('returns 409 when the user has dependent data (e.g. refresh token)', async () => {
      // refresh_tokens.user_id uses ON DELETE RESTRICT (schema.ts:48), so a
      // row here triggers Postgres 23503 → 409 in the admin delete handler.
      // packs/pack_items cascade, so they can't be used to verify this path.
      const user = await seedTestUser({ email: 'admin-del-conflict@example.com' });
      const db = createDb({} as unknown as Context);
      await db.insert(refreshTokens).values({
        userId: user.id,
        token: `test-${Date.now()}-${Math.random()}`,
        expiresAt: new Date(Date.now() + 86_400_000),
      });

      const res = await apiWithBasicAuth(`/users/${user.id}`, { method: 'DELETE' });
      expect(res.status).toBe(409);
    });
  });

  describe('DELETE /admin/packs/:id', () => {
    it('soft-deletes a pack', async () => {
      const user = await seedTestUser({ email: 'admin-del-pack@example.com' });
      const pack = await seedPack({ userId: user.id, name: 'Soft delete me' });

      const res = await apiWithBasicAuth(`/packs/${pack.id}`, { method: 'DELETE' });
      expect(res.status).toBe(200);
    });

    it('returns 404 for non-existent pack id', async () => {
      const res = await apiWithBasicAuth('/packs/non-existent-pack-id', { method: 'DELETE' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /admin/catalog/:id', () => {
    it('deletes a catalog item', async () => {
      const item = await seedCatalogItem({ name: 'Admin delete target' });
      const res = await apiWithBasicAuth(`/catalog/${item.id}`, { method: 'DELETE' });
      expect(res.status).toBe(200);
    });

    it('returns 404 for a non-existent catalog item', async () => {
      const res = await apiWithBasicAuth('/catalog/999999', { method: 'DELETE' });
      expect(res.status).toBe(404);
    });
  });
});
