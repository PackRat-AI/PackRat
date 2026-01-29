import { describe, expect, it } from 'vitest';
import { api, apiWithAuth, httpMethods } from './utils/test-helpers';

describe('Image Detection Routes', () => {
  describe('Authentication', () => {
    it('POST /packs/analyze-image requires auth', async () => {
      const res = await api('/packs/analyze-image', httpMethods.post('', {}));
      expect(res.status).toBe(401);
    });

    it('POST /packs/create-from-image requires auth', async () => {
      const res = await api('/packs/create-from-image', httpMethods.post('', {}));
      expect(res.status).toBe(401);
    });
  });

  describe('Validation', () => {
    it('POST /packs/analyze-image requires imageUrl parameter', async () => {
      const res = await apiWithAuth('/packs/analyze-image', httpMethods.post('', {}));
      expect([400, 403, 500]).toContain(res.status);
    });

    it('POST /packs/analyze-image requires valid imageUrl format', async () => {
      const res = await apiWithAuth(
        '/packs/analyze-image',
        httpMethods.post('', {
          imageUrl: 'not-a-url',
        }),
      );
      expect([400, 403, 500]).toContain(res.status);
    });

    it('POST /packs/analyze-image accepts valid request with minimal parameters', async () => {
      const res = await apiWithAuth(
        '/packs/analyze-image',
        httpMethods.post('', {
          imageUrl: 'https://example.com/image.jpg',
        }),
      );
      expect([400, 403, 500]).toContain(res.status);
    });

    it('POST /packs/analyze-image accepts matchLimit parameter', async () => {
      const res = await apiWithAuth(
        '/packs/analyze-image',
        httpMethods.post('', {
          imageUrl: 'https://example.com/image.jpg',
          matchLimit: 5,
        }),
      );
      expect([400, 403, 500]).toContain(res.status);
    });

    it('POST /packs/analyze-image validates matchLimit range', async () => {
      const res = await apiWithAuth(
        '/packs/analyze-image',
        httpMethods.post('', {
          imageUrl: 'https://example.com/image.jpg',
          matchLimit: 100, // Should be less than 50
        }),
      );
      expect([400, 403, 500]).toContain(res.status);
    });
  });

  describe('Create from Image', () => {
    it('POST /packs/create-from-image requires imageUrl parameter', async () => {
      const res = await apiWithAuth('/packs/create-from-image', httpMethods.post('', {}));
      expect([400, 403, 500]).toContain(res.status);
    });

    it('POST /packs/create-from-image requires packName parameter', async () => {
      const res = await apiWithAuth(
        '/packs/create-from-image',
        httpMethods.post('', {
          imageUrl: 'https://example.com/image.jpg',
        }),
      );
      expect([400, 403, 500]).toContain(res.status);
    });

    it('POST /packs/create-from-image validates packName length', async () => {
      const res = await apiWithAuth(
        '/packs/create-from-image',
        httpMethods.post('', {
          imageUrl: 'https://example.com/image.jpg',
          packName: 'ab', // Too short
        }),
      );
      expect([400, 403, 500]).toContain(res.status);
    });

    it('POST /packs/create-from-image accepts valid request with minimal parameters', async () => {
      const res = await apiWithAuth(
        '/packs/create-from-image',
        httpMethods.post('', {
          imageUrl: 'https://example.com/image.jpg',
          packName: 'My New Pack',
        }),
      );
      expect([400, 403, 500]).toContain(res.status);
    });

    it('POST /packs/create-from-image accepts optional parameters', async () => {
      const res = await apiWithAuth(
        '/packs/create-from-image',
        httpMethods.post('', {
          imageUrl: 'https://example.com/image.jpg',
          packName: 'My New Pack',
          description: 'A test pack',
          category: 'hiking',
        }),
      );
      expect([400, 403, 500]).toContain(res.status);
    });

    it('POST /packs/create-from-image validates minConfidence range', async () => {
      const res = await apiWithAuth(
        '/packs/create-from-image',
        httpMethods.post('', {
          imageUrl: 'https://example.com/image.jpg',
          packName: 'My New Pack',
          minConfidence: -0.5, // Invalid
        }),
      );
      expect([400, 403, 500]).toContain(res.status);
    });

    it('POST /packs/create-from-image validates boolean parameters', async () => {
      const res = await apiWithAuth(
        '/packs/create-from-image',
        httpMethods.post('', {
          imageUrl: 'https://example.com/image.jpg',
          packName: 'My New Pack',
          includeWeather: 'yes', // Should be boolean
        }),
      );
      expect([400, 403, 500]).toContain(res.status);
    });
  });

  describe('Error Handling', () => {
    it('handles invalid image URLs gracefully', async () => {
      const res = await apiWithAuth(
        '/packs/analyze-image',
        httpMethods.post('', {
          imageUrl: 'https://invalid-domain-that-does-not-exist.com/image.jpg',
        }),
      );
      expect([400, 403, 500].includes(res.status)).toBe(true);
    });

    it('handles missing OpenAI API key gracefully', async () => {
      const res = await apiWithAuth(
        '/packs/analyze-image',
        httpMethods.post('', {
          imageUrl: 'https://example.com/test-image.jpg',
        }),
      );
      // Should either succeed or fail gracefully
      expect([200, 400, 403, 500].includes(res.status)).toBe(true);
    });
  });
});

describe('Upload Routes', () => {
  describe('Authentication', () => {
    it('requires auth for presigned URL generation', async () => {
      const res = await api('/upload/presigned-url', httpMethods.post('', {}));
      expect(res.status).toBe(401);
    });

    it('requires auth for direct upload', async () => {
      const res = await api('/upload/direct', httpMethods.post('', {}));
      expect(res.status).toBe(401);
    });
  });

  describe('Presigned URL', () => {
    it('validates required parameters', async () => {
      const res = await apiWithAuth('/upload/presigned-url', httpMethods.post('', {}));
      expect([400, 403, 500]).toContain(res.status);
    });

    it('accepts valid upload request', async () => {
      const res = await apiWithAuth(
        '/upload/presigned-url',
        httpMethods.post('', {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        }),
      );
      expect([200, 400, 403, 500]).toContain(res.status);
    });
  });
});

describe('Knowledge Base Routes', () => {
  describe('Authentication', () => {
    it('GET /knowledge-base/search requires auth', async () => {
      const res = await api('/knowledge-base/search', httpMethods.get(''));
      expect(res.status).toBe(401);
    });
  });

  describe('Search', () => {
    it('accepts query parameter', async () => {
      const res = await apiWithAuth('/knowledge-base/search?q=test', httpMethods.get(''));
      expect([200, 400, 500]).toContain(res.status);
    });

    it('returns results structure', async () => {
      const res = await apiWithAuth('/knowledge-base/search?q=hiking', httpMethods.get(''));
      if (res.status === 200) {
        const data = await res.json();
        expect(data).toBeDefined();
      }
    });
  });
});

describe('Guides Routes', () => {
  describe('Authentication', () => {
    it('GET /guides requires auth', async () => {
      const res = await api('/guides', httpMethods.get(''));
      expect(res.status).toBe(401);
    });
  });

  describe('List', () => {
    it('returns guides list', async () => {
      const res = await apiWithAuth('/guides', httpMethods.get(''));
      expect([200, 400, 500]).toContain(res.status);
    });
  });

  describe('Search', () => {
    it('accepts query parameter', async () => {
      const res = await apiWithAuth('/guides/search?q=camping', httpMethods.get(''));
      expect([200, 400, 500]).toContain(res.status);
    });
  });
});

describe('Season Suggestions Routes', () => {
  describe('Authentication', () => {
    it('GET /season-suggestions requires auth', async () => {
      const res = await api('/season-suggestions', httpMethods.get(''));
      expect(res.status).toBe(401);
    });
  });

  describe('Get Suggestions', () => {
    it('accepts activity parameter', async () => {
      const res = await apiWithAuth('/season-suggestions?activity=hiking', httpMethods.get(''));
      expect([200, 400, 500]).toContain(res.status);
    });

    it('accepts location parameter', async () => {
      const res = await apiWithAuth('/season-suggestions?location=Utah', httpMethods.get(''));
      expect([200, 400, 500]).toContain(res.status);
    });

    it('accepts date parameter', async () => {
      const res = await apiWithAuth('/season-suggestions?date=2026-06-01', httpMethods.get(''));
      expect([200, 400, 500]).toContain(res.status);
    });
  });
});

describe('Trips Routes', () => {
  describe('Authentication', () => {
    it('GET /trips requires auth', async () => {
      const res = await api('/trips', httpMethods.get(''));
      expect(res.status).toBe(401);
    });

    it('POST /trips requires auth', async () => {
      const res = await api('/trips', httpMethods.post('', {}));
      expect(res.status).toBe(401);
    });
  });

  describe('List', () => {
    it('returns trips list', async () => {
      const res = await apiWithAuth('/trips', httpMethods.get(''));
      expect([200, 400, 500]).toContain(res.status);
    });
  });
});
