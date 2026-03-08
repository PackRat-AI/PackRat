import { describe, expect, it } from 'vitest';
import {
  api,
  apiWithAuth,
  expectJsonResponse,
  expectUnauthorized,
  httpMethods,
  TEST_USER,
} from './utils/test-helpers';

describe('Image Detection Routes', () => {
  describe('Authentication', () => {
    it('POST /packs/analyze-image requires auth', async () => {
      const res = await api('/packs/analyze-image', httpMethods.post('', {}));
      expectUnauthorized(res);
    });
  });

  describe('POST /packs/analyze-image', () => {
    it('requires image parameter', async () => {
      const res = await apiWithAuth('/packs/analyze-image', httpMethods.post('', {}));
      expect(res.status).toBe(400);
    });

    it('requires valid image key format', async () => {
      const res = await apiWithAuth(
        '/packs/analyze-image',
        httpMethods.post('', {
          image: 'not-a-valid-url',
        }),
      );
      expect(res.status).toBe(403);
    });

    it('accepts valid request with minimal parameters', async () => {
      const res = await apiWithAuth(
        '/packs/analyze-image',
        httpMethods.post('', {
          image: `${TEST_USER.id}-Ly81kadKndZ1pH2miQu8A.jpg`,
        }),
      );

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res, ['detectedItems', 'summary']);
      expect(Array.isArray(data.detectedItems)).toBe(true);
      expect(typeof data.summary).toBe('string');
    });

    it('accepts matchLimit parameter', async () => {
      const res = await apiWithAuth(
        '/packs/analyze-image',
        httpMethods.post('', {
          image: `${TEST_USER.id}-Ly81kadKndZ1pH2miQu8A.jpg`,
          matchLimit: 5,
        }),
      );

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res, ['detectedItems', 'summary']);
      expect(Array.isArray(data.detectedItems)).toBe(true);
    });
  });
});
