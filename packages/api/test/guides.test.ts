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

describe('Guides Routes', () => {
  describe('Authentication', () => {
    it('GET /guides requires auth', async () => {
      const res = await api('/guides', httpMethods.get(''));
      expectUnauthorized(res);
    });

    it('GET /guides/categories requires auth', async () => {
      const res = await api('/guides/categories', httpMethods.get(''));
      expectUnauthorized(res);
    });

    it('GET /guides/search requires auth', async () => {
      const res = await api('/guides/search', httpMethods.get(''));
      expectUnauthorized(res);
    });

    it('GET /guides/:id requires auth', async () => {
      const res = await api('/guides/1', httpMethods.get(''));
      expectUnauthorized(res);
    });
  });

  describe('GET /guides', () => {
    it('returns guides list', async () => {
      const res = await apiWithAuth('/guides');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(Array.isArray(data) || data.guides).toBeTruthy();
    });

    it('accepts pagination parameters', async () => {
      const res = await apiWithAuth('/guides?page=1&limit=10');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts category filter', async () => {
      const res = await apiWithAuth('/guides?category=backpacking');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts difficulty filter', async () => {
      const res = await apiWithAuth('/guides?difficulty=beginner');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts sorting parameters', async () => {
      const res = await apiWithAuth('/guides?sortBy=title&sortOrder=asc');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts featured filter', async () => {
      const res = await apiWithAuth('/guides?featured=true');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });
  });

  describe('GET /guides/categories', () => {
    it('returns available guide categories', async () => {
      const res = await apiWithAuth('/guides/categories');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(Array.isArray(data) || data.categories).toBeTruthy();
    });

    it('includes category metadata', async () => {
      const res = await apiWithAuth('/guides/categories');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      if (Array.isArray(data) && data.length > 0) {
        const category = data[0];
        expect(category).toHaveProperty('name');
        expect(category).toHaveProperty('slug');
      }
    });
  });

  describe('GET /guides/search', () => {
    it('searches guides with query parameter', async () => {
      const res = await apiWithAuth('/guides/search?q=hiking');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(Array.isArray(data) || data.results).toBeTruthy();
    });

    it('requires query parameter', async () => {
      const res = await apiWithAuth('/guides/search');
      expectBadRequest(res);

      const data = await res.json();
      expect(data.error).toContain('query');
    });

    it('accepts search filters', async () => {
      const res = await apiWithAuth('/guides/search?q=tent&category=gear&difficulty=intermediate');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts pagination for search results', async () => {
      const res = await apiWithAuth('/guides/search?q=backpacking&page=1&limit=5');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('handles empty search results', async () => {
      const res = await apiWithAuth('/guides/search?q=veryrareunlikelyterm12345');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      if (Array.isArray(data)) {
        expect(data.length).toBe(0);
      } else if (data.results) {
        expect(data.results.length).toBe(0);
      }
    });
  });

  describe('GET /guides/:id', () => {
    it('returns single guide by ID', async () => {
      const res = await apiWithAuth('/guides/1');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res, ['id', 'title']);
      expect(data.id).toBeDefined();
      expect(data.title).toBeDefined();
    });

    it('returns guide with content', async () => {
      const res = await apiWithAuth('/guides/1');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(data.content || data.body || data.markdown).toBeDefined();
    });

    it('returns guide metadata', async () => {
      const res = await apiWithAuth('/guides/1');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      // Common guide metadata fields
      expect(data.title).toBeDefined();
      expect(data.category || data.categories).toBeDefined();
    });

    it('returns 404 for non-existent guide', async () => {
      const res = await apiWithAuth('/guides/999999');
      expectNotFound(res);
    });

    it('validates ID parameter', async () => {
      const res = await apiWithAuth('/guides/invalid-id');
      expect([400, 404]).toContain(res.status);
    });
  });

  describe('GET /guides/:slug (if slug-based routing exists)', () => {
    it('returns guide by slug', async () => {
      const res = await apiWithAuth('/guides/backpacking-basics');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res, ['id', 'title']);
      expect(data.slug || data.title).toBeDefined();
    });

    it('returns 404 for non-existent slug', async () => {
      const res = await apiWithAuth('/guides/non-existent-guide-slug');
      expectNotFound(res);
    });
  });

  describe('Error Handling', () => {
    it('handles malformed requests gracefully', async () => {
      const res = await apiWithAuth('/guides?page=invalid&limit=notanumber');

      // Should either return 400 or default to valid pagination
      expect([200, 400]).toContain(res.status);
      if (res.status === 400) {
        expectBadRequest(res);
      }
    });

    it('handles invalid category filters', async () => {
      const res = await apiWithAuth('/guides?category=nonexistent-category');

      // Should return empty results or 400, not crash
      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      if (Array.isArray(data)) {
        expect(data.length).toBeGreaterThanOrEqual(0);
      }
      expectBadRequest(res);
    });
  });
});
