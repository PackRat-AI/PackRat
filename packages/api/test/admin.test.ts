import { describe, expect, it } from 'vitest';
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
});
