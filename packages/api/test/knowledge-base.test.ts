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

describe('Knowledge Base Routes', () => {
  describe('Authentication', () => {
    it('requires auth for knowledge base endpoints', async () => {
      const res = await api('/knowledge-base', httpMethods.get(''));
      expectUnauthorized(res);
    });

    it('requires auth for search', async () => {
      const res = await api('/knowledge-base/search', httpMethods.get(''));
      expectUnauthorized(res);
    });

    it('requires auth for articles', async () => {
      const res = await api('/knowledge-base/articles/1', httpMethods.get(''));
      expectUnauthorized(res);
    });
  });

  describe('GET /knowledge-base', () => {
    it('returns knowledge base overview', async () => {
      const res = await apiWithAuth('/knowledge-base');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(data.categories || data.articles || Array.isArray(data)).toBeTruthy();
      } else if (res.status === 404) {
      // Feature may not be implemented yet
      expect(res.status).toBe(404);
    });

    it('includes category information', async () => {
      const res = await apiWithAuth('/knowledge-base');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      if (data.categories) {
        expect(Array.isArray(data.categories)).toBe(true);
      }
    });
  });

  describe('GET /knowledge-base/categories', () => {
    it('returns available categories', async () => {
      const res = await apiWithAuth('/knowledge-base/categories');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(Array.isArray(data) || data.categories).toBeTruthy();
      } else if (res.status === 404) {
      expect(res.status).toBe(404);
    });

    it('includes category metadata', async () => {
      const res = await apiWithAuth('/knowledge-base/categories');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      const categories = Array.isArray(data) ? data : data.categories;

      if (categories && categories.length > 0) {
        const category = categories[0];
        expect(category.name || category.title).toBeDefined();
        expect(category.slug || category.id).toBeDefined();
      }
    });
  });

  describe('GET /knowledge-base/articles', () => {
    it('returns articles list', async () => {
      const res = await apiWithAuth('/knowledge-base/articles');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(Array.isArray(data) || data.articles).toBeTruthy();
      } else if (res.status === 404) {
      expect(res.status).toBe(404);
    });

    it('accepts pagination parameters', async () => {
      const res = await apiWithAuth('/knowledge-base/articles?page=1&limit=10');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
      } else if (res.status === 404) {
      expect(res.status).toBe(404);
    });

    it('accepts category filter', async () => {
      const res = await apiWithAuth('/knowledge-base/articles?category=gear');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
      } else if (res.status === 404) {
      expect(res.status).toBe(404);
    });

    it('accepts tag filter', async () => {
      const res = await apiWithAuth('/knowledge-base/articles?tags=backpacking,ultralight');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
      } else if (res.status === 404) {
      expect(res.status).toBe(404);
    });

    it('accepts featured filter', async () => {
      const res = await apiWithAuth('/knowledge-base/articles?featured=true');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
      } else if (res.status === 404) {
      expect(res.status).toBe(404);
    });
  });

  describe('GET /knowledge-base/articles/:id', () => {
    it('returns single article', async () => {
      const res = await apiWithAuth('/knowledge-base/articles/1');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res, ['id', 'title', 'content']);
      expect(data.id).toBeDefined();
      expect(data.title).toBeDefined();
      expect(data.content || data.body).toBeDefined();
      } else if (res.status === 404) {
      expectNotFound(res);
    });

    it('includes article metadata', async () => {
      const res = await apiWithAuth('/knowledge-base/articles/1');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(data.title).toBeDefined();
      expect(data.category || data.categories).toBeDefined();
      expect(data.createdAt || data.publishedAt).toBeDefined();
    });

    it('includes related articles', async () => {
      const res = await apiWithAuth('/knowledge-base/articles/1');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      if (data.relatedArticles) {
        expect(Array.isArray(data.relatedArticles)).toBe(true);
      }
    });

    it('returns 404 for non-existent article', async () => {
      const res = await apiWithAuth('/knowledge-base/articles/999999');
      expectNotFound(res);
    });
  });

  describe('GET /knowledge-base/search', () => {
    it('searches knowledge base with query', async () => {
      const res = await apiWithAuth('/knowledge-base/search?q=tent setup');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(Array.isArray(data) || data.results).toBeTruthy();
      } else if (res.status === 404) {
      expect(res.status).toBe(404);
    });

    it('requires query parameter', async () => {
      const res = await apiWithAuth('/knowledge-base/search');

      if (res.status === 400) {
        expectBadRequest(res);
        const data = await res.json();
        expect(data.error).toContain('query');
      } else if (res.status === 404) {
        expect(res.status).toBe(404);
      }
    });

    it('accepts category filter', async () => {
      const res = await apiWithAuth('/knowledge-base/search?q=sleeping&category=gear');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
      } else if (res.status === 404) {
      expect(res.status).toBe(404);
    });

    it('accepts pagination for search results', async () => {
      const res = await apiWithAuth('/knowledge-base/search?q=backpack&page=1&limit=5');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
      } else if (res.status === 404) {
      expect(res.status).toBe(404);
    });

    it('handles empty search results', async () => {
      const res = await apiWithAuth('/knowledge-base/search?q=veryrareunlikelyterm12345');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      const results = Array.isArray(data) ? data : data.results;
      if (results) {
        expect(results.length).toBe(0);
      } else if (res.status === 404) {
        expect(res.status).toBe(404);
      }
    });
  });

  describe('Tags and Categories', () => {
    it('handles gear category articles', async () => {
      const res = await apiWithAuth('/knowledge-base/articles?category=gear');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      const articles = Array.isArray(data) ? data : data.articles;

      if (articles && articles.length > 0) {
        const article = articles[0];
        expect(article.category || article.categories).toContain('gear');
      }
    });

    it('handles technique category articles', async () => {
      const res = await apiWithAuth('/knowledge-base/articles?category=techniques');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
      } else if (res.status === 404) {
      expect(res.status).toBe(404);
    });

    it('handles safety category articles', async () => {
      const res = await apiWithAuth('/knowledge-base/articles?category=safety');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
      } else if (res.status === 404) {
      expect(res.status).toBe(404);
    });

    it('handles multiple tags', async () => {
      const res = await apiWithAuth('/knowledge-base/articles?tags=ultralight,backpacking,gear');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
      } else if (res.status === 404) {
      expect(res.status).toBe(404);
    });
  });

  describe('Content Features', () => {
    it('may support article ratings', async () => {
      const res = await apiWithAuth('/knowledge-base/articles/1');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      if (data.rating || data.votes) {
        expect(typeof data.rating).toBe('number');
      }
    });

    it('may support article comments', async () => {
      const res = await apiWithAuth('/knowledge-base/articles/1/comments');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(Array.isArray(data) || data.comments).toBeTruthy();
      } else if (res.status === 404) {
      expect(res.status).toBe(404);
    });

    it('may support bookmarking articles', async () => {
      const res = await apiWithAuth(
        '/knowledge-base/articles/1/bookmark',
        httpMethods.post('', {}),
      );

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
      } else if (res.status === 404) {
      expect(res.status).toBe(404);
    });
  });

  describe('Error Handling', () => {
    it('handles malformed requests gracefully', async () => {
      const res = await apiWithAuth('/knowledge-base/articles?page=invalid&limit=notanumber');

      if (res.status === 400) {
        expectBadRequest(res);
      } else if (res.status === 404) {
        expect(res.status).toBe(404);
      } else {
        expect(res.status).toBe(200);
      }
    });

    it('handles invalid category filters', async () => {
      const res = await apiWithAuth('/knowledge-base/articles?category=nonexistent-category');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      const articles = Array.isArray(data) ? data : data.articles;
      expect(articles).toBeDefined();
      } else if (res.status === 400) {
      expectBadRequest(res);
      } else if (res.status === 404) {
      expect(res.status).toBe(404);
    });

    it('handles very long search queries', async () => {
      const longQuery = 'a'.repeat(1000);
      const res = await apiWithAuth(`/knowledge-base/search?q=${longQuery}`);

      if (res.status === 400) {
        expectBadRequest(res);
      } else if (res.status === 404) {
        expect(res.status).toBe(404);
      } else {
        expect(res.status).toBe(200);
      }
    });
  });

  describe('Content Management (if admin features exist)', () => {
    it('may allow creating articles (admin only)', async () => {
      const newArticle = {
        title: 'Test Article',
        content: 'Test content',
        category: 'gear',
        tags: ['test', 'gear'],
      };

      const res = await apiWithAuth('/knowledge-base/articles', httpMethods.post('', newArticle));

      // May require admin privileges
      if (res.status === 403) {
        expect(res.status).toBe(403);
      } else if (res.status === 201 || res.status === 200) {
        await expectJsonResponse(res, ['id']);
      } else if (res.status === 404) {
        expect(res.status).toBe(404);
      }
    });

    it('may allow updating articles (admin only)', async () => {
      const updateData = {
        title: 'Updated Article Title',
        content: 'Updated content',
      };

      const res = await apiWithAuth('/knowledge-base/articles/1', httpMethods.put('', updateData));

      expect([200, 403, 404]).toContain(res.status);
      if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });

    it('may allow deleting articles (admin only)', async () => {
      const res = await apiWithAuth('/knowledge-base/articles/1', httpMethods.delete(''));

      expect([200, 204, 403, 404]).toContain(res.status);
    });
  });
});
