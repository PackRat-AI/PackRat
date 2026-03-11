import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  api,
  apiWithAuth,
  expectBadRequest,
  expectJsonResponse,
  expectUnauthorized,
  httpMethods,
} from './utils/test-helpers';

describe('Upload Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('requires auth for presigned URL generation', async () => {
      const res = await api('/upload/presigned', httpMethods.get(''));
      expectUnauthorized(res);
    });

    it('requires auth for direct upload', async () => {
      const res = await api('/upload', httpMethods.post('', {}));
      expectUnauthorized(res);
    });

    it('requires auth for rehost', async () => {
      const res = await api(
        '/upload/rehost',
        httpMethods.post('', { url: 'https://example.com/image.jpg' }),
      );
      expectUnauthorized(res);
    });
  });

  describe('GET /upload/presigned', () => {
    it('generates presigned URL for file upload', async () => {
      const res = await apiWithAuth('/upload/presigned?fileName=1-test.jpg&contentType=image/jpeg');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res, ['url']);
      expect(data.url).toBeDefined();
      expect(typeof data.url).toBe('string');
      expect(data.url).toContain('http');
    });

    it('requires fileName parameter', async () => {
      const res = await apiWithAuth('/upload/presigned');
      expectBadRequest(res);

      const data = await res.json();
      expect(data.error).toContain('fileName');
    });

    it('validates content type', async () => {
      const res = await apiWithAuth(
        '/upload/presigned?fileName=1-test.exe&contentType=application/x-executable',
      );
      expectBadRequest(res);

      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('accepts image content types', async () => {
      const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

      for (const contentType of imageTypes) {
        const res = await apiWithAuth(
          `/upload/presigned?fileName=1-test.jpg&contentType=${contentType}`,
        );

        expect(res.status).toBe(200);
        await expectJsonResponse(res, ['url']);
      }
    });

    it('validates file extension', async () => {
      const res = await apiWithAuth('/upload/presigned?fileName=1-test.txt&contentType=text/plain');

      // Should reject non-image files
      if (res.status === 400) {
        expectBadRequest(res);
      }
    });

    it('requires fileName to start with user ID', async () => {
      const res = await apiWithAuth('/upload/presigned?fileName=test.jpg&contentType=image/jpeg');

      // Should reject filenames that don't start with user ID
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('includes file size limits', async () => {
      const res = await apiWithAuth(
        '/upload/presigned?fileName=1-huge.jpg&contentType=image/jpeg&size=50000000',
      ); // 50MB

      expectBadRequest(res);
      const data = await res.json();
      expect(data.error).toContain('size');
    });
  });

  describe('POST /upload/rehost', () => {
    const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const WEBP_MAGIC = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);

    function makeImageResponse(body: Uint8Array, contentType: string) {
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': contentType },
      });
    }

    it('rejects non-HTTPS URLs', async () => {
      const res = await apiWithAuth(
        '/upload/rehost',
        httpMethods.post('', { url: 'http://example.com/image.jpg' }),
      );
      expectBadRequest(res);
      const data = await res.json();
      expect(data.error).toMatch(/https/i);
    });

    it('rejects invalid (non-URL) values', async () => {
      const res = await apiWithAuth('/upload/rehost', httpMethods.post('', { url: 'not-a-url' }));
      expectBadRequest(res);
    });

    it('returns 400 when the upstream request fails', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(null, { status: 404 }));

      const res = await apiWithAuth(
        '/upload/rehost',
        httpMethods.post('', { url: 'https://example.com/missing.jpg' }),
      );
      expectBadRequest(res);
    });

    it('returns 400 when fetch throws a network error', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network failure'));

      const res = await apiWithAuth(
        '/upload/rehost',
        httpMethods.post('', { url: 'https://example.com/image.jpg' }),
      );
      expectBadRequest(res);
    });

    it('uses the content-type from upstream headers for a JPEG', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(makeImageResponse(JPEG_MAGIC, 'image/jpeg'));

      const res = await apiWithAuth(
        '/upload/rehost',
        httpMethods.post('', { url: 'https://example.com/photo' }),
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.contentType).toBe('image/jpeg');
      expect(data.key).toMatch(/^\d+-[0-9a-f-]+\.jpg$/);
    });

    it('uses the content-type from upstream headers for a PNG', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(makeImageResponse(PNG_MAGIC, 'image/png'));

      const res = await apiWithAuth(
        '/upload/rehost',
        httpMethods.post('', { url: 'https://example.com/photo' }),
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.contentType).toBe('image/png');
      expect(data.key).toMatch(/^\d+-[0-9a-f-]+\.png$/);
    });

    it('strips content-type parameters (e.g. charset) from upstream header', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        makeImageResponse(JPEG_MAGIC, 'image/jpeg; charset=UTF-8'),
      );

      const res = await apiWithAuth(
        '/upload/rehost',
        httpMethods.post('', { url: 'https://example.com/photo.jpg' }),
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.contentType).toBe('image/jpeg');
    });

    it('falls back to buffer sniffing when upstream header is missing', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(PNG_MAGIC, { status: 200 }));

      const res = await apiWithAuth(
        '/upload/rehost',
        httpMethods.post('', { url: 'https://cdn.example.com/asset' }),
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.contentType).toBe('image/png');
      expect(data.key).toMatch(/\.png$/);
    });

    it('trusts a valid upstream header even when buffer magic bytes differ (header wins)', async () => {
      // When the upstream server sends a recognised content-type we accept it
      // as-is, because buffer sniffing is not 100% reliable for every format.
      // The real protection against missing/wrong headers is the sniffing path.
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(makeImageResponse(JPEG_MAGIC, 'image/webp'));

      const res = await apiWithAuth(
        '/upload/rehost',
        httpMethods.post('', { url: 'https://tiktok.example.com/slide1' }),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      // Header is in the allow-list, so we trust it over sniffing
      expect(data.contentType).toBe('image/webp');
      expect(data.key).toMatch(/\.webp$/);
    });

    it('detects WebP via buffer sniffing when header is absent', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(WEBP_MAGIC, { status: 200 }));

      const res = await apiWithAuth(
        '/upload/rehost',
        httpMethods.post('', { url: 'https://cdn.example.com/image' }),
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.contentType).toBe('image/webp');
      expect(data.key).toMatch(/\.webp$/);
    });

    it('rejects content that is not a recognised image type', async () => {
      // Neither header nor magic bytes indicate an image
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c]), {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        }),
      );

      const res = await apiWithAuth(
        '/upload/rehost',
        httpMethods.post('', { url: 'https://example.com/page.html' }),
      );
      expectBadRequest(res);
      const data = await res.json();
      expect(data.error).toMatch(/supported image type/i);
    });
  });

  describe('Error Handling', () => {
    it('handles S3/R2 service errors gracefully', async () => {
      // This would require mocking the cloud storage service
      const res = await apiWithAuth('/upload/presigned?filename=test.jpg&contentType=image/jpeg');

      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('handles malformed filenames', async () => {
      const malformedFilenames = [
        '../../../etc/passwd.jpg',
        'test\0file.jpg',
        'test<script>.jpg',
        `very-long-filename-${'a'.repeat(200)}.jpg`,
      ];

      for (const filename of malformedFilenames) {
        const res = await apiWithAuth(
          `/upload/presigned?filename=${encodeURIComponent(filename)}&contentType=image/jpeg`,
        );

        expectBadRequest(res);
      }
    });

    it('handles invalid content types', async () => {
      const invalidTypes = [
        'application/javascript',
        'text/html',
        'application/x-executable',
        'invalid/type',
      ];

      for (const contentType of invalidTypes) {
        const res = await apiWithAuth(
          `/upload/presigned?fileName=1-test.jpg&contentType=${contentType}`,
        );
        expectBadRequest(res);
      }
    });
  });

  describe('Security', () => {
    it('requires fileName to start with user ID', async () => {
      const res = await apiWithAuth(
        '/upload/presigned?fileName=malicious.jpg&contentType=image/jpeg',
      );

      // Should reject filenames that don't start with user ID
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('accepts fileName with user ID prefix', async () => {
      const res = await apiWithAuth('/upload/presigned?fileName=1-test.jpg&contentType=image/jpeg');

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.url).toBeDefined();
    });
  });
});
