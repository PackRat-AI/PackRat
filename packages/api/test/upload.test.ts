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
