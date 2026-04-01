import { describe, expect, it, vi } from 'vitest';
import { buildPackTemplateItemImageUrl } from '../buildPackTemplateItemImageUrl';

// Mock the clientEnvs module
vi.mock('expo-app/env/clientEnvs', () => ({
  clientEnvs: {
    EXPO_PUBLIC_R2_PUBLIC_URL: 'https://cdn.example.com',
  },
}));

describe('buildPackTemplateItemImageUrl', () => {
  describe('with null or undefined input', () => {
    it('should return null for null input', () => {
      expect(buildPackTemplateItemImageUrl(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(buildPackTemplateItemImageUrl(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(buildPackTemplateItemImageUrl('')).toBeNull();
    });
  });

  describe('with full URL input', () => {
    it('should return the same URL if it starts with http', () => {
      const url = 'http://example.com/image.jpg';
      expect(buildPackTemplateItemImageUrl(url)).toBe(url);
    });

    it('should return the same URL if it starts with https', () => {
      const url = 'https://example.com/image.jpg';
      expect(buildPackTemplateItemImageUrl(url)).toBe(url);
    });

    it('should handle CDN URLs', () => {
      const url = 'https://cdn.cloudinary.com/image.png';
      expect(buildPackTemplateItemImageUrl(url)).toBe(url);
    });

    it('should handle S3 URLs', () => {
      const url = 'https://bucket.s3.amazonaws.com/image.jpg';
      expect(buildPackTemplateItemImageUrl(url)).toBe(url);
    });
  });

  describe('with relative path input', () => {
    it('should build URL for simple filename', () => {
      expect(buildPackTemplateItemImageUrl('tent.jpg')).toBe('https://cdn.example.com/tent.jpg');
    });

    it('should build URL for filename with path', () => {
      expect(buildPackTemplateItemImageUrl('items/backpack.png')).toBe(
        'https://cdn.example.com/items/backpack.png',
      );
    });

    it('should build URL for filename with multiple path segments', () => {
      expect(buildPackTemplateItemImageUrl('users/123/items/sleeping-bag.webp')).toBe(
        'https://cdn.example.com/users/123/items/sleeping-bag.webp',
      );
    });

    it('should handle filenames with special characters', () => {
      expect(buildPackTemplateItemImageUrl('item_with-special.chars.jpg')).toBe(
        'https://cdn.example.com/item_with-special.chars.jpg',
      );
    });

    it('should handle filenames with spaces (URL encoded)', () => {
      expect(buildPackTemplateItemImageUrl('my image.jpg')).toBe(
        'https://cdn.example.com/my image.jpg',
      );
    });
  });

  describe('URL structure', () => {
    it('should construct well-formed URLs', () => {
      const result = buildPackTemplateItemImageUrl('test.jpg');
      expect(result).toMatch(/^https:\/\/[^/]+\/.+$/);
      expect(result).not.toContain('com//');
    });

    it('should preserve file extensions', () => {
      const extensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];
      for (const ext of extensions) {
        const result = buildPackTemplateItemImageUrl(`image.${ext}`);
        expect(result).toBe(`https://cdn.example.com/image.${ext}`);
      }
    });
  });
});
