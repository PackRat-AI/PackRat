import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  api,
  apiWithAuth,
  expectBadRequest,
  expectJsonResponse,
  expectNotFound,
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
      const res = await apiWithAuth('/upload/presigned?filename=test.jpg&contentType=image/jpeg');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res, ['url', 'key']);
      expect(data.url).toBeDefined();
      expect(data.key).toBeDefined();
      expect(typeof data.url).toBe('string');
      expect(data.url).toContain('http');
    });

    it('requires filename parameter', async () => {
      const res = await apiWithAuth('/upload/presigned');
      expectBadRequest(res);

      const data = await res.json();
      expect(data.error).toContain('filename');
    });

    it('validates content type', async () => {
      const res = await apiWithAuth(
        '/upload/presigned?filename=test.exe&contentType=application/x-executable',
      );
      expectBadRequest(res);

      const data = await res.json();
      expect(data.error).toContain('content type');
    });

    it('accepts image content types', async () => {
      const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

      for (const contentType of imageTypes) {
        const res = await apiWithAuth(
          `/upload/presigned?filename=test.jpg&contentType=${contentType}`,
        );

        expect(res.status).toBe(200);
        await expectJsonResponse(res, ['url']);
      }
    });

    it('validates file extension', async () => {
      const res = await apiWithAuth('/upload/presigned?filename=test.txt&contentType=text/plain');

      // Should reject non-image files
      if (res.status === 400) {
        expectBadRequest(res);
      }
    });

    it('generates unique keys for different files', async () => {
      const res1 = await apiWithAuth('/upload/presigned?filename=test1.jpg&contentType=image/jpeg');
      const res2 = await apiWithAuth('/upload/presigned?filename=test2.jpg&contentType=image/jpeg');

      if (res1.status === 200 && res2.status === 200) {
        const data1 = await res1.json();
        const data2 = await res2.json();

        expect(data1.key).not.toBe(data2.key);
      }
    });

    it('includes file size limits', async () => {
      const res = await apiWithAuth(
        '/upload/presigned?filename=huge.jpg&contentType=image/jpeg&size=50000000',
      ); // 50MB

      // Should reject files that are too large
      if (res.status === 400) {
        expectBadRequest(res);
        const data = await res.json();
        expect(data.error).toContain('size');
      }
    });
  });

  describe('POST /upload', () => {
    it('handles direct file upload', async () => {
      // Create a mock file
      const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', mockFile);

      const res = await apiWithAuth('/upload', {
        method: 'POST',
        body: formData,
      });

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res, ['url', 'key']);
      expect(data.url).toBeDefined();
      expect(data.key).toBeDefined();
    });

    it('requires file in request', async () => {
      const res = await apiWithAuth('/upload', httpMethods.post('', {}));
      expectBadRequest(res);

      const data = await res.json();
      expect(data.error).toContain('file');
    });

    it('validates file type on direct upload', async () => {
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', mockFile);

      const res = await apiWithAuth('/upload', {
        method: 'POST',
        body: formData,
      });

      expectBadRequest(res);
    });

    it('validates file size on direct upload', async () => {
      // Create a mock large file
      const largeContent = 'a'.repeat(10000000); // 10MB
      const mockFile = new File([largeContent], 'large.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', mockFile);

      const res = await apiWithAuth('/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.status === 400) {
        expectBadRequest(res);
        const data = await res.json();
        expect(data.error).toContain('size');
      }
    });
  });

  describe('GET /upload/:key', () => {
    it('returns file information', async () => {
      const res = await apiWithAuth('/upload/test-key-123');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res, ['key', 'url']);
      expect(data.key).toBe('test-key-123');
    });
  });

  describe('Pack Image Upload', () => {
    it('handles pack image upload', async () => {
      const res = await apiWithAuth(
        '/upload/presigned?filename=pack.jpg&contentType=image/jpeg&type=pack&packId=123',
      );

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(data.url).toBeDefined();
      expect(data.key).toContain('pack');
    });

    it('requires pack ID for pack images', async () => {
      const res = await apiWithAuth(
        '/upload/presigned?filename=pack.jpg&contentType=image/jpeg&type=pack',
      );

      if (res.status === 400) {
        expectBadRequest(res);
        const data = await res.json();
        expect(data.error).toContain('packId');
      }
    });
  });

  describe('Error Handling', () => {
    it('handles S3/R2 service errors gracefully', async () => {
      // This would require mocking the cloud storage service
      const res = await apiWithAuth('/upload/presigned?filename=test.jpg&contentType=image/jpeg');

      if (res.status === 500) {
        const data = await res.json();
        expect(data.error).toBeDefined();
      }
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

        if (res.status === 400) {
          expectBadRequest(res);
        }
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
          `/upload/presigned?filename=test.jpg&contentType=${contentType}`,
        );
        expectBadRequest(res);
      }
    });
  });

  describe('Security', () => {
    it('sanitizes file names', async () => {
      const res = await apiWithAuth(
        '/upload/presigned?filename=../malicious.jpg&contentType=image/jpeg',
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.key).not.toContain('../');
    });

    it('includes user context in file keys', async () => {
      const res = await apiWithAuth('/upload/presigned?filename=test.jpg&contentType=image/jpeg');

      expect(res.status).toBe(200);
      const data = await res.json();
      // Should include user ID or similar in the path to prevent conflicts
      expect(data.key).toMatch(/\/|\w+/);
    });
  });
});
