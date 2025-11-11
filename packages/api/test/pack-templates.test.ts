import { beforeAll, describe, expect, it } from 'vitest';
import {
  seedPackTemplate,
  seedPackTemplateItem,
  seedPackTemplateItems,
  seedTestUser,
} from './utils/db-helpers';
import {
  api,
  apiWithAuth,
  expectJsonResponse,
  expectNotFound,
  expectUnauthorized,
  httpMethods,
} from './utils/test-helpers';

describe('Pack Templates Routes', () => {
  // Seed a test user before all tests
  beforeAll(async () => {
    await seedTestUser();
  });
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
      // Seed a template first
      await seedPackTemplate();

      const res = await apiWithAuth('/pack-templates');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(Array.isArray(data) || data.templates).toBeTruthy();
    });
  });

  describe('GET /pack-templates/:id', () => {
    it('returns single pack template', async () => {
      // Seed a template first
      const seededTemplate = await seedPackTemplate({ name: 'Test Template for GET' });
      if (!seededTemplate) throw new Error('Failed to seed pack template');

      const res = await apiWithAuth(`/pack-templates/${seededTemplate.id}`);

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res, ['id', 'name']);
      expect(data.id).toBeDefined();
      expect(data.name).toBeDefined();
    });

    it('returns template with metadata', async () => {
      // Seed a template first
      const seededTemplate = await seedPackTemplate();
      if (!seededTemplate) throw new Error('Failed to seed pack template');

      const res = await apiWithAuth(`/pack-templates/${seededTemplate.id}`);

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(data.category || data.type).toBeDefined();
      expect(data.description).toBeDefined();
    });

    it('returns 404 for non-existent template', async () => {
      const res = await apiWithAuth('/pack-templates/999999');
      expectNotFound(res);
    });
  });

  describe('GET /pack-templates/:id/items', () => {
    it('returns template items list', async () => {
      // Seed a template with items
      const seededTemplate = await seedPackTemplate();
      if (!seededTemplate) throw new Error('Failed to seed pack template');
      await seedPackTemplateItems(seededTemplate.id, 3);

      const res = await apiWithAuth(`/pack-templates/${seededTemplate.id}/items`);

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(Array.isArray(data) || data.items).toBeTruthy();
    });

    it('returns items with quantities', async () => {
      // Seed a template with items
      const seededTemplate = await seedPackTemplate();
      if (!seededTemplate) throw new Error('Failed to seed pack template');
      await seedPackTemplateItem(seededTemplate.id, { quantity: 2 });

      const res = await apiWithAuth(`/pack-templates/${seededTemplate.id}/items`);

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      const items = Array.isArray(data) ? data : data.items;

      const item = items[0];
      expect(item.quantity).toBeDefined();
      expect(typeof item.quantity).toBe('number');
      expect(item.quantity).toBeGreaterThan(0);
    });

    it('returns 404 for non-existent template', async () => {
      const res = await apiWithAuth('/pack-templates/999999/items');
      expectNotFound(res);
    });
  });
});
