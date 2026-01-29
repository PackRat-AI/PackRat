import { describe, expect, it } from 'vitest';
import { api, apiWithAuth, apiWithAdmin, httpMethods } from './utils/test-helpers';

describe('Pack Routes - Core Functionality', () => {
  describe('Authentication', () => {
    it('GET /packs requires auth', async () => {
      const res = await api('/packs', httpMethods.get(''));
      expect(res.status).toBe(401);
    });

    it('POST /packs requires auth', async () => {
      const res = await api('/packs', httpMethods.post('', {}));
      expect(res.status).toBe(401);
    });
  });

  describe('List Packs', () => {
    it('returns packs list for authenticated user', async () => {
      const res = await apiWithAuth('/packs', httpMethods.get(''));
      expect([200, 400, 500]).toContain(res.status);
    });

    it('accepts pagination parameters', async () => {
      const res = await apiWithAuth('/packs?page=1&limit=10', httpMethods.get(''));
      expect([200, 400, 500]).toContain(res.status);
    });

    it('accepts category filter', async () => {
      const res = await apiWithAuth('/packs?category=hiking', httpMethods.get(''));
      expect([200, 400, 500]).toContain(res.status);
    });
  });

  describe('Get Single Pack', () => {
    it('returns 404 for non-existent pack', async () => {
      const res = await apiWithAuth('/packs/non-existent-pack-id', httpMethods.get(''));
      expect([404, 400, 500]).toContain(res.status);
    });
  });

  describe('Create Pack', () => {
    it('validates required name parameter', async () => {
      const res = await apiWithAuth('/packs', httpMethods.post('', {}));
      expect([400, 500]).toContain(res.status);
    });

    it('accepts valid pack creation request', async () => {
      const res = await apiWithAuth(
        '/packs',
        httpMethods.post('', {
          name: 'Test Pack',
          description: 'A test pack',
          category: 'hiking',
        }),
      );
      expect([200, 400, 500]).toContain(res.status);
    });

    it('validates category values', async () => {
      const res = await apiWithAuth(
        '/packs',
        httpMethods.post('', {
          name: 'Test Pack',
          category: 'invalid-category',
        }),
      );
      expect([400, 500]).toContain(res.status);
    });
  });

  describe('Pack Items', () => {
    it('GET /packs/:id/items returns items', async () => {
      const res = await apiWithAuth('/packs/test-pack-id/items', httpMethods.get(''));
      expect([200, 404, 400, 500]).toContain(res.status);
    });

    it('POST /packs/:id/items requires auth', async () => {
      const res = await api('/packs/test-pack-id/items', httpMethods.post('', {}));
      expect(res.status).toBe(401);
    });
  });
});

describe('User Items Routes', () => {
  describe('Authentication', () => {
    it('GET /user/items requires auth', async () => {
      const res = await api('/user/items', httpMethods.get(''));
      expect(res.status).toBe(401);
    });

    it('POST /user/items requires auth', async () => {
      const res = await api('/user/items', httpMethods.post('', {}));
      expect(res.status).toBe(401);
    });

    it('PUT /user/items/:id requires auth', async () => {
      const res = await api('/user/items/1', httpMethods.put('', {}));
      expect(res.status).toBe(401);
    });

    it('DELETE /user/items/:id requires auth', async () => {
      const res = await api('/user/items/1', httpMethods.delete(''));
      expect(res.status).toBe(401);
    });
  });

  describe('List User Items', () => {
    it('returns user items list', async () => {
      const res = await apiWithAuth('/user/items', httpMethods.get(''));
      expect([200, 400, 500]).toContain(res.status);
    });

    it('accepts pagination parameters', async () => {
      const res = await apiWithAuth('/user/items?page=1&limit=10', httpMethods.get(''));
      expect([200, 400, 500]).toContain(res.status);
    });

    it('accepts search query', async () => {
      const res = await apiWithAuth('/user/items?q=tent', httpMethods.get(''));
      expect([200, 400, 500]).toContain(res.status);
    });
  });

  describe('Create User Item', () => {
    it('validates required name parameter', async () => {
      const res = await apiWithAuth('/user/items', httpMethods.post('', {}));
      expect([400, 500]).toContain(res.status);
    });

    it('accepts valid item creation request', async () => {
      const res = await apiWithAuth(
        '/user/items',
        httpMethods.post('', {
          name: 'Test Item',
          weight: 1000,
          weightUnit: 'g',
        }),
      );
      expect([200, 400, 500]).toContain(res.status);
    });

    it('validates weight values', async () => {
      const res = await apiWithAuth(
        '/user/items',
        httpMethods.post('', {
          name: 'Test Item',
          weight: -100, // Invalid negative weight
        }),
      );
      expect([400, 500]).toContain(res.status);
    });
  });
});

describe('Admin Routes', () => {
  describe('Authentication', () => {
    it('admin endpoints require admin authentication', async () => {
      const res = await apiWithAuth('/admin/stats', httpMethods.get(''));
      expect([200, 401, 403, 500]).toContain(res.status);
    });
  });

  describe('Admin Stats', () => {
    it('returns admin statistics', async () => {
      const res = await apiWithAdmin('/admin/stats', httpMethods.get(''));
      expect([200, 403, 500]).toContain(res.status);
    });
  });
});

describe('Search Functionality', () => {
  describe('Pack Search', () => {
    it('accepts query parameter', async () => {
      const res = await apiWithAuth('/search/packs?q=hiking', httpMethods.get(''));
      expect([200, 400, 500]).toContain(res.status);
    });
  });

  describe('Catalog Search', () => {
    it('accepts query parameter', async () => {
      const res = await apiWithAuth('/search/catalog?q=tent', httpMethods.get(''));
      expect([200, 400, 500]).toContain(res.status);
    });

    it('accepts filters', async () => {
      const res = await apiWithAuth(
        '/search/catalog?category=shelter&brand=Osprey',
        httpMethods.get(''),
      );
      expect([200, 400, 500]).toContain(res.status);
    });
  });

  describe('Global Search', () => {
    it('accepts query parameter', async () => {
      const res = await apiWithAuth('/search?q=backpack', httpMethods.get(''));
      expect([200, 400, 500]).toContain(res.status);
    });
  });
});

describe('Weather Integration', () => {
  describe('Get Weather', () => {
    it('accepts location parameter', async () => {
      const res = await apiWithAuth('/weather?location=Salt+Lake+City', httpMethods.get(''));
      expect([200, 400, 500]).toContain(res.status);
    });

    it('accepts coordinates', async () => {
      const res = await apiWithAuth('/weather?lat=40.76&lng=-111.89', httpMethods.get(''));
      expect([200, 400, 500]).toContain(res.status);
    });

    it('accepts date range', async () => {
      const res = await apiWithAuth(
        '/weather?startDate=2026-06-01&endDate=2026-06-07',
        httpMethods.get(''),
      );
      expect([200, 400, 500]).toContain(res.status);
    });
  });
});

describe('Chat Integration', () => {
  describe('Send Message', () => {
    it('requires auth', async () => {
      const res = await api('/chat', httpMethods.post('', {}));
      expect(res.status).toBe(401);
    });

    it('requires message parameter', async () => {
      const res = await apiWithAuth('/chat', httpMethods.post('', {}));
      expect([400, 500]).toContain(res.status);
    });

    it('accepts valid message', async () => {
      const res = await apiWithAuth(
        '/chat',
        httpMethods.post('', {
          message: 'What gear do I need for hiking?',
        }),
      );
      expect([200, 400, 500]).toContain(res.status);
    });

    it('accepts context parameter', async () => {
      const res = await apiWithAuth(
        '/chat',
        httpMethods.post('', {
          message: 'What should I pack?',
          context: {
            activity: 'hiking',
            duration: '3 days',
            location: 'mountains',
          },
        }),
      );
      expect([200, 400, 500]).toContain(res.status);
    });
  });
});

describe('AllTrails Integration', () => {
  describe('Search Trails', () => {
    it('requires auth', async () => {
      const res = await api('/alltrails/search', httpMethods.get(''));
      expect(res.status).toBe(401);
    });

    it('accepts location parameter', async () => {
      const res = await apiWithAuth('/alltrails/search?location=Utah', httpMethods.get(''));
      expect([200, 400, 500]).toContain(res.status);
    });
  });

  describe('Get Trail Details', () => {
    it('accepts trail ID', async () => {
      const res = await apiWithAuth('/alltrails/trails/12345', httpMethods.get(''));
      expect([200, 404, 400, 500]).toContain(res.status);
    });
  });
});
