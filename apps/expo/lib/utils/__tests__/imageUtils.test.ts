import { beforeEach, describe, expect, it, type MockedFunction, vi } from 'vitest';

// Mock Sentry
vi.mock('@sentry/react-native', () => ({
  captureException: vi.fn(),
}));

// Mock domain-specific-extensions
vi.mock('../domain-specific-extensions', () => ({
  getDomainSpecificExtension: vi.fn(),
}));

import { getDomainSpecificExtension } from '../domain-specific-extensions';
import { fetchImageExtension, getImageExtension, inferImageExtension } from '../imageUtils';

describe('imageUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset global fetch mock
    global.fetch = vi.fn() as unknown as typeof fetch;
  });

  describe('inferImageExtension', () => {
    it('should extract extension from URL with standard extension', () => {
      expect(inferImageExtension('https://example.com/image.jpg')).toBe('jpg');
      expect(inferImageExtension('https://example.com/image.jpeg')).toBe('jpeg');
      expect(inferImageExtension('https://example.com/image.png')).toBe('png');
      expect(inferImageExtension('https://example.com/image.gif')).toBe('gif');
      expect(inferImageExtension('https://example.com/image.webp')).toBe('webp');
      expect(inferImageExtension('https://example.com/image.avif')).toBe('avif');
      expect(inferImageExtension('https://example.com/image.svg')).toBe('svg');
    });

    it('should extract extension from URL with query parameters', () => {
      expect(inferImageExtension('https://example.com/image.jpg?width=100')).toBe('jpg');
      expect(inferImageExtension('https://example.com/image.png?v=123&cache=false')).toBe('png');
    });

    it('should handle case insensitive extensions', () => {
      expect(inferImageExtension('https://example.com/image.JPG')).toBe('jpg');
      expect(inferImageExtension('https://example.com/image.PNG')).toBe('png');
      expect(inferImageExtension('https://example.com/image.JPEG')).toBe('jpeg');
    });

    it('should return domain-specific extension when available', () => {
      const mockGetDomainExtension = getDomainSpecificExtension as MockedFunction<
        typeof getDomainSpecificExtension
      >;
      mockGetDomainExtension.mockReturnValue('jpg');

      expect(inferImageExtension('https://cdn.example.com/abc123')).toBe('jpg');
      expect(mockGetDomainExtension).toHaveBeenCalledWith('https://cdn.example.com/abc123');
    });

    it('should return null when no extension can be inferred', () => {
      const mockGetDomainExtension = getDomainSpecificExtension as MockedFunction<
        typeof getDomainSpecificExtension
      >;
      mockGetDomainExtension.mockReturnValue(null);

      expect(inferImageExtension('https://example.com/123456')).toBe(null);
    });
  });

  describe('fetchImageExtension', () => {
    it('should return inferred extension if available', async () => {
      const mockGetDomainExtension = getDomainSpecificExtension as MockedFunction<
        typeof getDomainSpecificExtension
      >;
      mockGetDomainExtension.mockReturnValue('png');

      const result = await fetchImageExtension('https://cdn.example.com/abc123');
      expect(result).toBe('png');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should make HEAD request and return extension from content-type', async () => {
      const mockGetDomainExtension = getDomainSpecificExtension as MockedFunction<
        typeof getDomainSpecificExtension
      >;
      mockGetDomainExtension.mockReturnValue(null);

      const mockFetch = global.fetch as MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('image/jpeg'),
        },
      } as unknown as Response);

      const result = await fetchImageExtension('https://example.com/image');
      expect(result).toBe('jpg');
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/image', {
        method: 'HEAD',
        signal: expect.any(AbortSignal),
      });
    });

    it('should map various content-types correctly', async () => {
      const mockGetDomainExtension = getDomainSpecificExtension as MockedFunction<
        typeof getDomainSpecificExtension
      >;
      mockGetDomainExtension.mockReturnValue(null);

      const mockFetch = global.fetch as MockedFunction<typeof fetch>;

      const testCases = [
        { contentType: 'image/jpeg', expectedExt: 'jpg' },
        { contentType: 'image/jpg', expectedExt: 'jpg' },
        { contentType: 'image/png', expectedExt: 'png' },
        { contentType: 'image/gif', expectedExt: 'gif' },
        { contentType: 'image/webp', expectedExt: 'webp' },
        { contentType: 'image/avif', expectedExt: 'avif' },
        { contentType: 'image/svg+xml', expectedExt: 'svg' },
      ];

      for (const { contentType, expectedExt } of testCases) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: {
            get: vi.fn().mockReturnValue(contentType),
          },
        } as unknown as Response);

        const result = await fetchImageExtension('https://example.com/image');
        expect(result).toBe(expectedExt);
        mockFetch.mockClear();
      }
    });

    it('should fallback to range GET request if HEAD fails', async () => {
      const mockGetDomainExtension = getDomainSpecificExtension as MockedFunction<
        typeof getDomainSpecificExtension
      >;
      mockGetDomainExtension.mockReturnValue(null);

      const mockFetch = global.fetch as MockedFunction<typeof fetch>;

      // First call (HEAD) fails
      mockFetch.mockRejectedValueOnce(new Error('HEAD failed'));

      // Second call (Range GET) succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 206,
        headers: {
          get: vi.fn().mockReturnValue('image/png'),
        },
      } as unknown as Response);

      const result = await fetchImageExtension('https://example.com/image');
      expect(result).toBe('png');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith('https://example.com/image', {
        headers: { Range: 'bytes=0-1023' },
        signal: expect.any(AbortSignal),
      });
    });

    it('should return null when both HEAD and Range GET fail', async () => {
      const mockGetDomainExtension = getDomainSpecificExtension as MockedFunction<
        typeof getDomainSpecificExtension
      >;
      mockGetDomainExtension.mockReturnValue(null);

      const mockFetch = global.fetch as MockedFunction<typeof fetch>;
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchImageExtension('https://example.com/image');
      expect(result).toBe(null);
    });

    it('should return null when content-type is not recognized', async () => {
      const mockGetDomainExtension = getDomainSpecificExtension as MockedFunction<
        typeof getDomainSpecificExtension
      >;
      mockGetDomainExtension.mockReturnValue(null);

      const mockFetch = global.fetch as MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('application/octet-stream'),
        },
      } as unknown as Response);

      const result = await fetchImageExtension('https://example.com/image');
      expect(result).toBe(null);
    });

    it('should return null when no content-type header is present', async () => {
      const mockGetDomainExtension = getDomainSpecificExtension as MockedFunction<
        typeof getDomainSpecificExtension
      >;
      mockGetDomainExtension.mockReturnValue(null);

      const mockFetch = global.fetch as MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
      } as unknown as Response);

      const result = await fetchImageExtension('https://example.com/image');
      expect(result).toBe(null);
    });

    it('should handle timeout scenarios', async () => {
      const mockGetDomainExtension = getDomainSpecificExtension as MockedFunction<
        typeof getDomainSpecificExtension
      >;
      mockGetDomainExtension.mockReturnValue(null);

      const mockFetch = global.fetch as MockedFunction<typeof fetch>;

      // Mock a long-running fetch that gets aborted
      mockFetch.mockImplementation((_, options) => {
        return new Promise((_resolve, reject) => {
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              reject(new Error('Aborted'));
            });
          }
          // Simulate immediate timeout for testing
          setTimeout(() => {
            reject(new Error('Timeout'));
          }, 10);
        });
      });

      const result = await fetchImageExtension('https://example.com/slow-image');
      expect(result).toBe(null);
    }, 10000);
  });

  describe('getImageExtension', () => {
    it('should return inferred extension immediately if available', async () => {
      const result = await getImageExtension('https://example.com/image.jpg');
      expect(result).toBe('jpg');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch extension when not inferable from URL', async () => {
      const mockGetDomainExtension = getDomainSpecificExtension as MockedFunction<
        typeof getDomainSpecificExtension
      >;
      mockGetDomainExtension.mockReturnValue(null);

      const mockFetch = global.fetch as MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('image/jpeg'),
        },
      } as unknown as Response);

      const result = await getImageExtension('https://example.com/image');
      expect(result).toBe('jpg');
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should return default extension when fetching fails', async () => {
      const mockGetDomainExtension = getDomainSpecificExtension as MockedFunction<
        typeof getDomainSpecificExtension
      >;
      mockGetDomainExtension.mockReturnValue(null);

      const mockFetch = global.fetch as MockedFunction<typeof fetch>;
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await getImageExtension('https://example.com/image', 'png');
      expect(result).toBe('png');
    });

    it('should use provided default extension', async () => {
      const mockGetDomainExtension = getDomainSpecificExtension as MockedFunction<
        typeof getDomainSpecificExtension
      >;
      mockGetDomainExtension.mockReturnValue(null);

      const mockFetch = global.fetch as MockedFunction<typeof fetch>;
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await getImageExtension('https://example.com/image', 'webp');
      expect(result).toBe('webp');
    });

    it('should handle timeout and return default extension', async () => {
      const mockGetDomainExtension = getDomainSpecificExtension as MockedFunction<
        typeof getDomainSpecificExtension
      >;
      mockGetDomainExtension.mockReturnValue(null);

      const mockFetch = global.fetch as MockedFunction<typeof fetch>;
      mockFetch.mockImplementation(() => {
        return new Promise((_resolve, reject) => {
          // Simulate timeout by rejecting quickly
          setTimeout(() => reject(new Error('Timeout')), 10);
        });
      });

      const result = await getImageExtension('https://example.com/image', 'gif');
      expect(result).toBe('gif');
    }, 10000);

    it('should return fetched extension when successful', async () => {
      const mockGetDomainExtension = getDomainSpecificExtension as MockedFunction<
        typeof getDomainSpecificExtension
      >;
      mockGetDomainExtension.mockReturnValue(null);

      const mockFetch = global.fetch as MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('image/webp'),
        },
      } as unknown as Response);

      const result = await getImageExtension('https://example.com/image', 'jpg');
      expect(result).toBe('webp'); // Should return fetched, not default
    });
  });
});
