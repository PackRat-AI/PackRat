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

describe('Pack Templates Routes', () => {
  describe('Authentication', () => {
    it('GET /pack-templates requires auth', async () => {
      const res = await api('/pack-templates', httpMethods.get(''));
      expectUnauthorized(res);
    });

    it('GET /pack-templates/:id requires auth', async () => {
      const res = await api('/pack-templates/1', httpMethods.get(''));
      expectUnauthorized(res);
    });

    it('GET /pack-templates/:id/items requires auth', async () => {
      const res = await api('/pack-templates/1/items', httpMethods.get(''));
      expectUnauthorized(res);
    });
  });

  describe('GET /pack-templates', () => {
    it('returns pack templates list', async () => {
      const res = await apiWithAuth('/pack-templates');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(Array.isArray(data) || data.templates).toBeTruthy();
    });

    it('accepts pagination parameters', async () => {
      const res = await apiWithAuth('/pack-templates?page=1&limit=10');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts activity filter', async () => {
      const res = await apiWithAuth('/pack-templates?activity=hiking');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts season filter', async () => {
      const res = await apiWithAuth('/pack-templates?season=summer');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts duration filter', async () => {
      const res = await apiWithAuth('/pack-templates?duration=weekend');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts difficulty filter', async () => {
      const res = await apiWithAuth('/pack-templates?difficulty=beginner');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts search query', async () => {
      const res = await apiWithAuth('/pack-templates?q=ultralight');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts sorting parameters', async () => {
      const res = await apiWithAuth('/pack-templates?sortBy=name&sortOrder=asc');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts featured filter', async () => {
      const res = await apiWithAuth('/pack-templates?featured=true');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });
  });

  describe('GET /pack-templates/:id', () => {
    it('returns single pack template', async () => {
      const res = await apiWithAuth('/pack-templates/1');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res, ['id', 'name']);
      expect(data.id).toBeDefined();
      expect(data.name).toBeDefined();
      expectNotFound(res);
    });

    it('returns template with metadata', async () => {
      const res = await apiWithAuth('/pack-templates/1');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(data.activity || data.type).toBeDefined();
      expect(data.description).toBeDefined();
    });

    it('returns template weight information', async () => {
      const res = await apiWithAuth('/pack-templates/1');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      // Template should have weight info
      expect(data.baseWeight || data.totalWeight || data.weight).toBeDefined();
    });

    it('returns 404 for non-existent template', async () => {
      const res = await apiWithAuth('/pack-templates/999999');
      expectNotFound(res);
    });

    it('validates ID parameter', async () => {
      const res = await apiWithAuth('/pack-templates/invalid-id');
      expect([400, 404]).toContain(res.status);
    });
  });

  describe('GET /pack-templates/:id/items', () => {
    it('returns template items list', async () => {
      const res = await apiWithAuth('/pack-templates/1/items');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(Array.isArray(data) || data.items).toBeTruthy();
      expectNotFound(res);
    });

    it('returns items with catalog information', async () => {
      const res = await apiWithAuth('/pack-templates/1/items');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      const items = Array.isArray(data) ? data : data.items;

      if (items && items.length > 0) {
        const item = items[0];
        expect(item.name || item.catalogItem?.name).toBeDefined();
        expect(item.weight || item.catalogItem?.weight).toBeDefined();
        expect(item.category || item.catalogItem?.category).toBeDefined();
      }
    });

    it('returns items with quantities', async () => {
      const res = await apiWithAuth('/pack-templates/1/items');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      const items = Array.isArray(data) ? data : data.items;

      if (items && items.length > 0) {
        const item = items[0];
        expect(item.quantity).toBeDefined();
        expect(typeof item.quantity).toBe('number');
        expect(item.quantity).toBeGreaterThan(0);
      }
    });

    it('returns 404 for non-existent template', async () => {
      const res = await apiWithAuth('/pack-templates/999999/items');
      expectNotFound(res);
    });

    it('accepts category filter', async () => {
      const res = await apiWithAuth('/pack-templates/1/items?category=shelter');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
      expectNotFound(res);
    });

    it('accepts optional/required filter', async () => {
      const res = await apiWithAuth('/pack-templates/1/items?optional=false');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
      expectNotFound(res);
    });
  });

  describe('Template Categories and Activities', () => {
    it('handles hiking templates', async () => {
      const res = await apiWithAuth('/pack-templates?activity=hiking');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      const templates = Array.isArray(data) ? data : data.templates;

      if (templates && templates.length > 0) {
        const template = templates[0];
        expect(template.activity).toBe('hiking');
      }
    });

    it('handles backpacking templates', async () => {
      const res = await apiWithAuth('/pack-templates?activity=backpacking');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      const templates = Array.isArray(data) ? data : data.templates;

      if (templates && templates.length > 0) {
        const template = templates[0];
        expect(template.activity).toBe('backpacking');
      }
    });

    it('handles camping templates', async () => {
      const res = await apiWithAuth('/pack-templates?activity=camping');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('handles ultralight templates', async () => {
      const res = await apiWithAuth('/pack-templates?q=ultralight');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });
  });

  describe('Error Handling', () => {
    it('handles malformed pagination parameters', async () => {
      const res = await apiWithAuth('/pack-templates?page=invalid&limit=notanumber');

      // Should either return 400 or default to valid pagination
      if (res.status === 400) {
        expectBadRequest(res);
      } else {
        expect(res.status).toBe(200);
      }
    });

    it('handles invalid activity filters', async () => {
      const res = await apiWithAuth('/pack-templates?activity=nonexistent-activity');

      // Should return empty results or 400, not crash
      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      const templates = Array.isArray(data) ? data : data.templates;
      expect(templates).toBeDefined();
      expectBadRequest(res);
    });

    it('handles invalid season filters', async () => {
      const res = await apiWithAuth('/pack-templates?season=invalid-season');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
      expectBadRequest(res);
    });

    it('handles large pagination requests', async () => {
      const res = await apiWithAuth('/pack-templates?page=1&limit=1000');

      // Should either cap the limit or return 400
      if (res.status === 400) {
        expectBadRequest(res);
      } else {
        expect(res.status).toBe(200);
      }
    });
  });

  describe('Template Usage Scenarios', () => {
    it('supports copying template to user pack', async () => {
      // This would typically be a separate endpoint or parameter
      const res = await apiWithAuth('/pack-templates/1?action=copy');

      // This endpoint may not exist yet, but testing the concept
      expect(res.status).toBe(200);
      await expectJsonResponse(res);
      } else {
      // Expected if this feature doesn't exist yet
      expect([404, 501]).toContain(res.status);
    });

    it('supports template customization preview', async () => {
      // Another potential feature
      const customization = {
        activity: 'backpacking',
        duration: 5,
        season: 'winter',
      };

      const res = await apiWithAuth(
        '/pack-templates/1/customize',
        httpMethods.post('', customization),
      );

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
      } else {
      // Expected if this feature doesn't exist yet
      expect([404, 501]).toContain(res.status);
    });
  });
});
