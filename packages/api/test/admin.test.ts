import { describe, expect, it } from 'vitest';
import {
  api,
  apiWithBasicAuth,
  expectJsonResponse,
  expectUnauthorized,
} from './utils/test-helpers';

describe('Admin Routes', () => {
  describe('Authentication', () => {
    it('requires basic auth for all admin routes', async () => {
      const routes = ['/', '/stats', '/users-list', '/packs', '/catalog'];

      for (const route of routes) {
        const res = await api(`/admin${route}`);
        expectUnauthorized(res);
      }
    });

    it('rejects invalid basic auth credentials', async () => {
      const invalidAuth = btoa('wrong:credentials');
      const res = await api('/admin/', {
        headers: { Authorization: `Basic ${invalidAuth}` },
      });
      expectUnauthorized(res);
    });
  });

  describe('GET /admin/', () => {
    it('returns admin dashboard HTML', async () => {
      const res = await apiWithBasicAuth('');
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');

      const html = await res.text();
      expect(html).toContain('PackRat Admin Panel');
      expect(html).toContain('Dashboard');
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
  });

  describe('GET /admin/packs', () => {
    it('returns admin packs management interface', async () => {
      const res = await apiWithBasicAuth('/packs');
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');

      const html = await res.text();
      expect(html).toContain('Pack Management');
    });

    it('accepts search parameter', async () => {
      const res = await apiWithBasicAuth('/packs?search=hiking');
      expect(res.status).toBe(200);
    });

    it('accepts pagination parameters', async () => {
      const res = await apiWithBasicAuth('/packs?page=1&limit=10');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /admin/catalog', () => {
    it('returns admin catalog management interface', async () => {
      const res = await apiWithBasicAuth('/catalog');
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');

      const html = await res.text();
      expect(html).toContain('Catalog Management');
    });

    it('accepts search parameter', async () => {
      const res = await apiWithBasicAuth('/catalog?search=tent');
      expect(res.status).toBe(200);
    });

    it('accepts pagination parameters', async () => {
      const res = await apiWithBasicAuth('/catalog?page=1&limit=10');
      expect(res.status).toBe(200);
    });
  });
});
