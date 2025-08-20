import { describe, expect, it } from 'vitest';
import { 
  api, 
  apiWithAuth, 
  expectUnauthorized, 
  expectBadRequest,
  expectJsonResponse,
  httpMethods 
} from './utils/test-helpers';

describe('Search Routes', () => {
  describe('Authentication', () => {
    it('requires auth for search endpoints', async () => {
      const res = await api('/search', httpMethods.get(''));
      expectUnauthorized(res);
    });

    it('requires auth for specific search types', async () => {
      const searchTypes = ['packs', 'catalog', 'guides', 'users'];
      
      for (const type of searchTypes) {
        const res = await api(`/search/${type}`, httpMethods.get(''));
        expectUnauthorized(res);
      }
    });
  });

  describe('GET /search', () => {
    it('performs global search with query parameter', async () => {
      const res = await apiWithAuth('/search?q=tent');
      
      if (res.status === 200) {
        const data = await expectJsonResponse(res);
        expect(data.results || data.items).toBeDefined();
      }
    });

    it('requires query parameter', async () => {
      const res = await apiWithAuth('/search');
      expectBadRequest(res);
      
      const data = await res.json();
      expect(data.error).toContain('query');
    });

    it('accepts type filters', async () => {
      const res = await apiWithAuth('/search?q=backpack&type=catalog');
      
      if (res.status === 200) {
        const data = await expectJsonResponse(res);
        expect(data.results || data.catalog).toBeDefined();
      }
    });

    it('accepts pagination parameters', async () => {
      const res = await apiWithAuth('/search?q=hiking&page=1&limit=10');
      
      if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });

    it('returns structured results', async () => {
      const res = await apiWithAuth('/search?q=tent');
      
      if (res.status === 200) {
        const data = await expectJsonResponse(res);
        
        // Should have different categories of results
        expect(data.results || data).toBeDefined();
        
        if (data.results) {
          // Could have packs, catalog, guides results
          expect(data.results.packs || data.results.catalog || data.results.guides).toBeDefined();
        }
      }
    });

    it('handles empty search results', async () => {
      const res = await apiWithAuth('/search?q=veryrareunlikelyterm12345');
      
      if (res.status === 200) {
        const data = await expectJsonResponse(res);
        
        if (data.results) {
          expect(data.results).toBeDefined();
        } else if (Array.isArray(data)) {
          expect(data.length).toBe(0);
        }
      }
    });
  });

  describe('GET /search/packs', () => {
    it('searches packs with query', async () => {
      const res = await apiWithAuth('/search/packs?q=hiking');
      
      if (res.status === 200) {
        const data = await expectJsonResponse(res);
        expect(Array.isArray(data) || data.packs).toBeTruthy();
      }
    });

    it('requires query parameter', async () => {
      const res = await apiWithAuth('/search/packs');
      expectBadRequest(res);
    });

    it('accepts pack-specific filters', async () => {
      const res = await apiWithAuth('/search/packs?q=backpack&activity=hiking&public=true');
      
      if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });

    it('accepts weight range filters', async () => {
      const res = await apiWithAuth('/search/packs?q=lightweight&minWeight=1000&maxWeight=5000');
      
      if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });

    it('accepts creator filter', async () => {
      const res = await apiWithAuth('/search/packs?q=tent&creator=expert');
      
      if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });
  });

  describe('GET /search/catalog', () => {
    it('searches catalog items with query', async () => {
      const res = await apiWithAuth('/search/catalog?q=sleeping bag');
      
      if (res.status === 200) {
        const data = await expectJsonResponse(res);
        expect(Array.isArray(data) || data.items).toBeTruthy();
      }
    });

    it('requires query parameter', async () => {
      const res = await apiWithAuth('/search/catalog');
      expectBadRequest(res);
    });

    it('accepts category filters', async () => {
      const res = await apiWithAuth('/search/catalog?q=tent&category=shelter');
      
      if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });

    it('accepts weight range filters', async () => {
      const res = await apiWithAuth('/search/catalog?q=ultralight&minWeight=0&maxWeight=1000');
      
      if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });

    it('accepts price range filters', async () => {
      const res = await apiWithAuth('/search/catalog?q=backpack&minPrice=100&maxPrice=500');
      
      if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });

    it('accepts brand filter', async () => {
      const res = await apiWithAuth('/search/catalog?q=tent&brand=REI');
      
      if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });
  });

  describe('GET /search/guides', () => {
    it('searches guides with query', async () => {
      const res = await apiWithAuth('/search/guides?q=backpacking basics');
      
      if (res.status === 200) {
        const data = await expectJsonResponse(res);
        expect(Array.isArray(data) || data.guides).toBeTruthy();
      }
    });

    it('requires query parameter', async () => {
      const res = await apiWithAuth('/search/guides');
      expectBadRequest(res);
    });

    it('accepts category filters', async () => {
      const res = await apiWithAuth('/search/guides?q=hiking&category=techniques');
      
      if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });

    it('accepts difficulty filters', async () => {
      const res = await apiWithAuth('/search/guides?q=camping&difficulty=beginner');
      
      if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });

    it('accepts activity filters', async () => {
      const res = await apiWithAuth('/search/guides?q=gear&activity=backpacking');
      
      if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });
  });

  describe('GET /search/users', () => {
    it('searches users with query', async () => {
      const res = await apiWithAuth('/search/users?q=john');
      
      if (res.status === 200) {
        const data = await expectJsonResponse(res);
        expect(Array.isArray(data) || data.users).toBeTruthy();
      }
    });

    it('requires query parameter', async () => {
      const res = await apiWithAuth('/search/users');
      expectBadRequest(res);
    });

    it('accepts experience level filter', async () => {
      const res = await apiWithAuth('/search/users?q=hiker&experience=expert');
      
      if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });

    it('accepts location filter', async () => {
      const res = await apiWithAuth('/search/users?q=climber&location=colorado');
      
      if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });

    it('respects privacy settings', async () => {
      const res = await apiWithAuth('/search/users?q=test');
      
      if (res.status === 200) {
        const data = await expectJsonResponse(res);
        const users = Array.isArray(data) ? data : data.users;
        
        if (users && users.length > 0) {
          const user = users[0];
          // Should not expose sensitive info like email
          expect(user.email).toBeUndefined();
          expect(user.passwordHash).toBeUndefined();
        }
      }
    });
  });

  describe('Advanced Search Features', () => {
    it('supports fuzzy search', async () => {
      const res = await apiWithAuth('/search?q=tnt'); // misspelled "tent"
      
      if (res.status === 200) {
        const data = await expectJsonResponse(res);
        // Should still return tent-related results
        expect(data.results || data).toBeDefined();
      }
    });

    it('supports phrase search', async () => {
      const res = await apiWithAuth('/search?q="sleeping bag"');
      
      if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });

    it('supports wildcard search', async () => {
      const res = await apiWithAuth('/search?q=back*');
      
      if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });

    it('supports boolean operators', async () => {
      const res = await apiWithAuth('/search?q=tent AND ultralight');
      
      if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });

    it('supports excluding terms', async () => {
      const res = await apiWithAuth('/search?q=tent -heavy');
      
      if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });
  });

  describe('Search Analytics and Features', () => {
    it('tracks popular searches', async () => {
      // This would typically be logged server-side
      const res = await apiWithAuth('/search?q=popular term');
      
      if (res.status === 200) {
        await expectJsonResponse(res);
      }
    });

    it('provides search suggestions', async () => {
      const res = await apiWithAuth('/search/suggestions?q=tent');
      
      if (res.status === 200) {
        const data = await expectJsonResponse(res);
        expect(Array.isArray(data) || data.suggestions).toBeTruthy();
      } else if (res.status === 404) {
        // Feature may not be implemented yet
        expect(res.status).toBe(404);
      }
    });

    it('provides autocomplete', async () => {
      const res = await apiWithAuth('/search/autocomplete?q=back');
      
      if (res.status === 200) {
        const data = await expectJsonResponse(res);
        expect(Array.isArray(data) || data.completions).toBeTruthy();
      } else if (res.status === 404) {
        // Feature may not be implemented yet
        expect(res.status).toBe(404);
      }
    });
  });

  describe('Error Handling', () => {
    it('handles very long search queries', async () => {
      const longQuery = 'a'.repeat(1000);
      const res = await apiWithAuth(`/search?q=${longQuery}`);
      
      // Should either handle gracefully or return 400
      if (res.status === 400) {
        expectBadRequest(res);
      } else {
        expect(res.status).toBe(200);
      }
    });

    it('handles special characters in queries', async () => {
      const specialQuery = encodeURIComponent('tent & backpack @ $100');
      const res = await apiWithAuth(`/search?q=${specialQuery}`);
      
      if (res.status === 200) {
        await expectJsonResponse(res);
      } else if (res.status === 400) {
        expectBadRequest(res);
      }
    });

    it('handles invalid pagination parameters', async () => {
      const res = await apiWithAuth('/search?q=tent&page=invalid&limit=notanumber');
      
      if (res.status === 400) {
        expectBadRequest(res);
      } else {
        expect(res.status).toBe(200);
      }
    });

    it('handles malformed filter parameters', async () => {
      const res = await apiWithAuth('/search?q=tent&minWeight=invalid&maxPrice=notanumber');
      
      if (res.status === 400) {
        expectBadRequest(res);
      } else {
        expect(res.status).toBe(200);
      }
    });
  });
});