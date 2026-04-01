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

      const res = await apiWithAuth(`/pack-templates/${seededTemplate.id}`);

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res, ['id', 'name']);
      expect(data.id).toBeDefined();
      expect(data.name).toBeDefined();
    });

    it('returns template with metadata', async () => {
      // Seed a template first
      const seededTemplate = await seedPackTemplate();

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
      await seedPackTemplateItems(seededTemplate.id, 3);

      const res = await apiWithAuth(`/pack-templates/${seededTemplate.id}/items`);

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(Array.isArray(data) || data.items).toBeTruthy();
    });

    it('returns items with quantities', async () => {
      // Seed a template with items
      const seededTemplate = await seedPackTemplate();
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

  describe('POST /pack-templates', () => {
    it('should create a new pack template', async () => {
      const templateData = {
        id: `pt-test-${Date.now()}`,
        name: 'Test Weekend Trip Template',
        description: 'Template for weekend camping trips',
        category: 'Camping',
        tags: ['weekend', 'camping'],
        localCreatedAt: new Date().toISOString(),
        localUpdatedAt: new Date().toISOString(),
      };

      const res = await apiWithAuth('/pack-templates', {
        method: 'POST',
        body: JSON.stringify(templateData),
      });

      expect(res.status).toBe(201);
      const data = await expectJsonResponse(res);
      expect(data.id).toBe(templateData.id);
      expect(data.name).toBe(templateData.name);
      expect(data.category).toBe(templateData.category);
    });

    it('should create template with minimal fields', async () => {
      const templateData = {
        id: `pt-minimal-${Date.now()}`,
        name: 'Minimal Template',
        localCreatedAt: new Date().toISOString(),
        localUpdatedAt: new Date().toISOString(),
      };

      const res = await apiWithAuth('/pack-templates', {
        method: 'POST',
        body: JSON.stringify(templateData),
      });

      expect(res.status).toBe(201);
      const data = await expectJsonResponse(res);
      expect(data.id).toBe(templateData.id);
      expect(data.name).toBe(templateData.name);
    });

    it('should not allow regular user to create app template', async () => {
      const templateData = {
        id: `pt-app-${Date.now()}`,
        name: 'Attempted App Template',
        isAppTemplate: true,
        localCreatedAt: new Date().toISOString(),
        localUpdatedAt: new Date().toISOString(),
      };

      const res = await apiWithAuth('/pack-templates', {
        method: 'POST',
        body: JSON.stringify(templateData),
      });

      expect(res.status).toBe(201);
      const data = await expectJsonResponse(res);
      // isAppTemplate should be false for non-admin users
      expect(data.isAppTemplate).toBe(false);
    });

    it('should require authentication', async () => {
      const templateData = {
        id: `pt-unauth-${Date.now()}`,
        name: 'Unauthorized Template',
        localCreatedAt: new Date().toISOString(),
        localUpdatedAt: new Date().toISOString(),
      };

      const res = await api('/pack-templates', {
        method: 'POST',
        body: JSON.stringify(templateData),
        headers: { 'Content-Type': 'application/json' },
      });

      expectUnauthorized(res);
    });
  });

  describe('PUT /pack-templates/:id', () => {
    it('should update a pack template', async () => {
      const template = await seedPackTemplate({ name: 'Original Name' });

      const updateData = {
        name: 'Updated Name',
        description: 'Updated description',
      };

      const res = await apiWithAuth(`/pack-templates/${template.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(data.name).toBe('Updated Name');
      expect(data.description).toBe('Updated description');
    });

    it('should update only provided fields', async () => {
      const template = await seedPackTemplate({
        name: 'Original',
        description: 'Original Description',
        category: 'Original Category',
      });

      const updateData = {
        name: 'Updated Name Only',
      };

      const res = await apiWithAuth(`/pack-templates/${template.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(data.name).toBe('Updated Name Only');
      expect(data.description).toBe('Original Description');
      expect(data.category).toBe('Original Category');
    });

    it('should return 404 for non-existent template', async () => {
      const res = await apiWithAuth('/pack-templates/non-existent-id', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated' }),
      });

      expectNotFound(res);
    });

    it('should require authentication', async () => {
      const template = await seedPackTemplate();

      const res = await api(`/pack-templates/${template.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expectUnauthorized(res);
    });
  });

  describe('DELETE /pack-templates/:id', () => {
    it('should delete a pack template', async () => {
      const template = await seedPackTemplate({ name: 'To Delete' });

      const res = await apiWithAuth(`/pack-templates/${template.id}`, {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(data.success).toBe(true);

      // Verify template is deleted
      const getRes = await apiWithAuth(`/pack-templates/${template.id}`);
      expectNotFound(getRes);
    });

    it('should return 404 for non-existent template', async () => {
      const res = await apiWithAuth('/pack-templates/non-existent-id', {
        method: 'DELETE',
      });

      expectNotFound(res);
    });

    it('should require authentication', async () => {
      const template = await seedPackTemplate();

      const res = await api(`/pack-templates/${template.id}`, {
        method: 'DELETE',
      });

      expectUnauthorized(res);
    });
  });

  describe('POST /pack-templates/:id/items', () => {
    it('should add an item to a template', async () => {
      const template = await seedPackTemplate();

      const itemData = {
        id: `pti-test-${Date.now()}`,
        name: 'Test Item',
        description: 'Test Description',
        weight: 500,
        weightUnit: 'g',
        quantity: 2,
        category: 'Gear',
        consumable: false,
        worn: false,
      };

      const res = await apiWithAuth(`/pack-templates/${template.id}/items`, {
        method: 'POST',
        body: JSON.stringify(itemData),
      });

      expect(res.status).toBe(201);
      const data = await expectJsonResponse(res);
      expect(data.id).toBe(itemData.id);
      expect(data.name).toBe(itemData.name);
      expect(data.quantity).toBe(2);
    });

    it('should add item with minimal fields', async () => {
      const template = await seedPackTemplate();

      const itemData = {
        id: `pti-minimal-${Date.now()}`,
        name: 'Minimal Item',
        weight: 100,
        weightUnit: 'g',
      };

      const res = await apiWithAuth(`/pack-templates/${template.id}/items`, {
        method: 'POST',
        body: JSON.stringify(itemData),
      });

      expect(res.status).toBe(201);
      const data = await expectJsonResponse(res);
      expect(data.id).toBe(itemData.id);
      expect(data.quantity).toBe(1); // Default quantity
    });

    it('should return 404 for non-existent template', async () => {
      const itemData = {
        id: `pti-test-${Date.now()}`,
        name: 'Test Item',
        weight: 100,
        weightUnit: 'g',
      };

      const res = await apiWithAuth('/pack-templates/non-existent/items', {
        method: 'POST',
        body: JSON.stringify(itemData),
      });

      expectNotFound(res);
    });

    it('should not allow adding items to app template by non-admin', async () => {
      const template = await seedPackTemplate({ isAppTemplate: true });

      const itemData = {
        id: `pti-app-${Date.now()}`,
        name: 'Test Item',
        weight: 100,
        weightUnit: 'g',
      };

      const res = await apiWithAuth(`/pack-templates/${template.id}/items`, {
        method: 'POST',
        body: JSON.stringify(itemData),
      });

      expect(res.status).toBe(403);
    });

    it('should require authentication', async () => {
      const template = await seedPackTemplate();

      const itemData = {
        id: `pti-unauth-${Date.now()}`,
        name: 'Test Item',
        weight: 100,
        weightUnit: 'g',
      };

      const res = await api(`/pack-templates/${template.id}/items`, {
        method: 'POST',
        body: JSON.stringify(itemData),
        headers: { 'Content-Type': 'application/json' },
      });

      expectUnauthorized(res);
    });
  });

  describe('PATCH /pack-templates/items/:itemId', () => {
    it('should update a template item', async () => {
      const template = await seedPackTemplate();
      const item = await seedPackTemplateItem(template.id, { name: 'Original Item' });

      const updateData = {
        name: 'Updated Item',
        quantity: 3,
      };

      const res = await apiWithAuth(`/pack-templates/items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(data.name).toBe('Updated Item');
      expect(data.quantity).toBe(3);
    });

    it('should return 404 for non-existent item', async () => {
      const res = await apiWithAuth('/pack-templates/items/non-existent-id', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated' }),
      });

      expectNotFound(res);
    });

    it('should require authentication', async () => {
      const template = await seedPackTemplate();
      const item = await seedPackTemplateItem(template.id);

      const res = await api(`/pack-templates/items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expectUnauthorized(res);
    });
  });

  describe('DELETE /pack-templates/items/:itemId', () => {
    it('should delete a template item', async () => {
      const template = await seedPackTemplate();
      const item = await seedPackTemplateItem(template.id);

      const res = await apiWithAuth(`/pack-templates/items/${item.id}`, {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(data.success).toBe(true);

      // Verify item is deleted
      const itemsRes = await apiWithAuth(`/pack-templates/${template.id}/items`);
      const items = await itemsRes.json();
      const deletedItem = (Array.isArray(items) ? items : items.items).find(
        (i: { id: string }) => i.id === item.id,
      );
      expect(deletedItem).toBeUndefined();
    });

    it('should return 404 for non-existent item', async () => {
      const res = await apiWithAuth('/pack-templates/items/non-existent-id', {
        method: 'DELETE',
      });

      expectNotFound(res);
    });

    it('should require authentication', async () => {
      const template = await seedPackTemplate();
      const item = await seedPackTemplateItem(template.id);

      const res = await api(`/pack-templates/items/${item.id}`, {
        method: 'DELETE',
      });

      expectUnauthorized(res);
    });
  });
});
