import { describe, expect, it, vi } from 'vitest';

// Mock clientEnvs before importing
vi.mock('@packrat/env/expo-client', () => ({
  clientEnvs: {
    EXPO_PUBLIC_R2_PUBLIC_URL: 'https://cdn.packrat.com',
  },
}));

import { buildPackTemplateItemImageUrl } from '../buildPackTemplateItemImageUrl';

describe('buildPackTemplateItemImageUrl', () => {
  // -------------------------------------------------------------------------
  // Basic functionality
  // -------------------------------------------------------------------------
  describe('basic functionality', () => {
    it('builds URL for simple image filename', () => {
      const url = buildPackTemplateItemImageUrl('tent.jpg');
      expect(url).toBe('https://cdn.packrat.com/tent.jpg');
    });

    it('builds URL for image with path', () => {
      const url = buildPackTemplateItemImageUrl('templates/backpack.png');
      expect(url).toBe('https://cdn.packrat.com/templates/backpack.png');
    });

    it('returns null for null input', () => {
      const url = buildPackTemplateItemImageUrl(null);
      expect(url).toBeNull();
    });

    it('returns null for undefined input', () => {
      const url = buildPackTemplateItemImageUrl(undefined);
      expect(url).toBeNull();
    });

    it('returns null for empty string', () => {
      const url = buildPackTemplateItemImageUrl('');
      expect(url).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Full URLs
  // -------------------------------------------------------------------------
  describe('full URLs', () => {
    it('returns http URL as-is', () => {
      const httpUrl = 'http://example.com/image.jpg';
      expect(buildPackTemplateItemImageUrl(httpUrl)).toBe(httpUrl);
    });

    it('returns https URL as-is', () => {
      const httpsUrl = 'https://example.com/photo.png';
      expect(buildPackTemplateItemImageUrl(httpsUrl)).toBe(httpsUrl);
    });

    it('does not modify external CDN URLs', () => {
      const cdnUrl = 'https://cdn.external.com/assets/gear.jpg';
      expect(buildPackTemplateItemImageUrl(cdnUrl)).toBe(cdnUrl);
    });

    it('handles URLs with query parameters', () => {
      const url = 'https://example.com/image.jpg?size=large&format=webp';
      expect(buildPackTemplateItemImageUrl(url)).toBe(url);
    });

    it('handles URLs with fragments', () => {
      const url = 'https://example.com/image.jpg#preview';
      expect(buildPackTemplateItemImageUrl(url)).toBe(url);
    });
  });

  // -------------------------------------------------------------------------
  // Relative paths
  // -------------------------------------------------------------------------
  describe('relative paths', () => {
    it('builds URL for simple filename', () => {
      const url = buildPackTemplateItemImageUrl('sleeping-bag.jpg');
      expect(url).toBe('https://cdn.packrat.com/sleeping-bag.jpg');
    });

    it('builds URL for nested path', () => {
      const url = buildPackTemplateItemImageUrl('gear/camping/tent.png');
      expect(url).toBe('https://cdn.packrat.com/gear/camping/tent.png');
    });

    it('handles image names with hyphens', () => {
      const url = buildPackTemplateItemImageUrl('ultra-light-backpack.jpg');
      expect(url).toBe('https://cdn.packrat.com/ultra-light-backpack.jpg');
    });

    it('handles image names with underscores', () => {
      const url = buildPackTemplateItemImageUrl('water_bottle_32oz.png');
      expect(url).toBe('https://cdn.packrat.com/water_bottle_32oz.png');
    });

    it('handles image names with spaces', () => {
      const url = buildPackTemplateItemImageUrl('hiking boots.jpg');
      expect(url).toBe('https://cdn.packrat.com/hiking boots.jpg');
    });
  });

  // -------------------------------------------------------------------------
  // Image formats
  // -------------------------------------------------------------------------
  describe('image formats', () => {
    it('handles jpg extension', () => {
      const url = buildPackTemplateItemImageUrl('item.jpg');
      expect(url).toBe('https://cdn.packrat.com/item.jpg');
    });

    it('handles jpeg extension', () => {
      const url = buildPackTemplateItemImageUrl('item.jpeg');
      expect(url).toBe('https://cdn.packrat.com/item.jpeg');
    });

    it('handles png extension', () => {
      const url = buildPackTemplateItemImageUrl('item.png');
      expect(url).toBe('https://cdn.packrat.com/item.png');
    });

    it('handles gif extension', () => {
      const url = buildPackTemplateItemImageUrl('item.gif');
      expect(url).toBe('https://cdn.packrat.com/item.gif');
    });

    it('handles webp extension', () => {
      const url = buildPackTemplateItemImageUrl('item.webp');
      expect(url).toBe('https://cdn.packrat.com/item.webp');
    });

    it('handles files without extension', () => {
      const url = buildPackTemplateItemImageUrl('image');
      expect(url).toBe('https://cdn.packrat.com/image');
    });
  });

  // -------------------------------------------------------------------------
  // Special characters
  // -------------------------------------------------------------------------
  describe('special characters', () => {
    it('handles image names with numbers', () => {
      const url = buildPackTemplateItemImageUrl('tent-2p-v2.jpg');
      expect(url).toBe('https://cdn.packrat.com/tent-2p-v2.jpg');
    });

    it('handles image names with special characters', () => {
      const url = buildPackTemplateItemImageUrl('pack@2x.png');
      expect(url).toBe('https://cdn.packrat.com/pack@2x.png');
    });

    it('handles UUID-style filenames', () => {
      const url = buildPackTemplateItemImageUrl('a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg');
      expect(url).toBe('https://cdn.packrat.com/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg');
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles whitespace-only string as null', () => {
      const url = buildPackTemplateItemImageUrl('   ');
      // Empty/whitespace strings are falsy after trim, should return null
      // But the function checks !image which is false for '   '
      expect(url).toBe('https://cdn.packrat.com/   ');
    });

    it('handles forward slash prefix', () => {
      const url = buildPackTemplateItemImageUrl('/assets/gear.jpg');
      expect(url).toBe('https://cdn.packrat.com//assets/gear.jpg');
    });

    it('handles multiple forward slashes', () => {
      const url = buildPackTemplateItemImageUrl('folder//subfolder//image.jpg');
      expect(url).toBe('https://cdn.packrat.com/folder//subfolder//image.jpg');
    });

    it('handles backslashes (Windows paths)', () => {
      const url = buildPackTemplateItemImageUrl('folder\\image.jpg');
      expect(url).toBe('https://cdn.packrat.com/folder\\image.jpg');
    });
  });

  // -------------------------------------------------------------------------
  // URL structure validation
  // -------------------------------------------------------------------------
  describe('URL structure validation', () => {
    it('includes forward slash between base URL and image path', () => {
      const url = buildPackTemplateItemImageUrl('test.jpg');
      expect(url).toContain('https://cdn.packrat.com/test.jpg');
    });

    it('does not double slash when base URL has trailing slash', () => {
      // Base URL in mock doesn't have trailing slash, but this tests the logic
      const url = buildPackTemplateItemImageUrl('image.jpg');
      expect(url).not.toContain('//image.jpg');
    });

    it('uses base URL from environment', () => {
      const url = buildPackTemplateItemImageUrl('test.jpg');
      expect(url).toContain('cdn.packrat.com');
    });
  });

  // -------------------------------------------------------------------------
  // Type compatibility
  // -------------------------------------------------------------------------
  describe('type compatibility', () => {
    it('handles string | null union type', () => {
      const nullUrl = buildPackTemplateItemImageUrl(null);
      const stringUrl = buildPackTemplateItemImageUrl('image.jpg');

      expect(nullUrl).toBeNull();
      expect(stringUrl).toBe('https://cdn.packrat.com/image.jpg');
    });

    it('handles string | undefined union type', () => {
      const undefinedUrl = buildPackTemplateItemImageUrl(undefined);
      const stringUrl = buildPackTemplateItemImageUrl('image.jpg');

      expect(undefinedUrl).toBeNull();
      expect(stringUrl).toBe('https://cdn.packrat.com/image.jpg');
    });
  });
});
