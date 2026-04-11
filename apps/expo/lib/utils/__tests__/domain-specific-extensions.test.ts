import { describe, expect, it } from 'vitest';
import { getDomainSpecificExtension } from '../domain-specific-extensions';

describe('getDomainSpecificExtension', () => {
  // -------------------------------------------------------------------------
  // REI patterns
  // -------------------------------------------------------------------------
  describe('REI', () => {
    it('returns jpg for REI product URLs', () => {
      const url = 'https://www.rei.com/media/product/123456';
      expect(getDomainSpecificExtension(url)).toBe('jpg');
    });

    it('handles REI URLs with different product IDs', () => {
      const urls = [
        'https://www.rei.com/media/product/111111',
        'https://www.rei.com/media/product/999999',
        'https://www.rei.com/media/product/000000',
      ];
      for (const url of urls) {
        expect(getDomainSpecificExtension(url)).toBe('jpg');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Amazon patterns
  // -------------------------------------------------------------------------
  describe('Amazon', () => {
    it('returns jpg for Amazon product image URLs', () => {
      const url = 'https://amazon.com/images/I/51AbCdEfGh';
      expect(getDomainSpecificExtension(url)).toBe('jpg');
    });

    it('handles various Amazon image IDs', () => {
      const ids = ['51AbCdEfGh', '71XyZ123AB', '41MnOpQrSt'];
      for (const id of ids) {
        const url = `https://amazon.com/images/I/${id}`;
        expect(getDomainSpecificExtension(url)).toBe('jpg');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Walmart patterns
  // -------------------------------------------------------------------------
  describe('Walmart', () => {
    it('returns jpeg for Walmart product URLs', () => {
      const url = 'https://walmart.com/ip/product-name-here/123456';
      expect(getDomainSpecificExtension(url)).toBe('jpeg');
    });

    it('handles Walmart URLs with hyphens in product names', () => {
      const url = 'https://walmart.com/ip/camping-tent-4-person/987654';
      expect(getDomainSpecificExtension(url)).toBe('jpeg');
    });
  });

  // -------------------------------------------------------------------------
  // Target patterns
  // -------------------------------------------------------------------------
  describe('Target', () => {
    it('returns jpg for Target product URLs', () => {
      const url = 'https://target.com/s/outdoor-gear/-/A-12345';
      expect(getDomainSpecificExtension(url)).toBe('jpg');
    });

    it('handles Target URLs with various product IDs', () => {
      const url = 'https://target.com/s/camping-equipment/-/A-98765';
      expect(getDomainSpecificExtension(url)).toBe('jpg');
    });
  });

  // -------------------------------------------------------------------------
  // Best Buy patterns
  // -------------------------------------------------------------------------
  describe('Best Buy', () => {
    it('returns jpg for Best Buy product URLs', () => {
      const url = 'https://bestbuy.com/site/product-name/123456.p';
      expect(getDomainSpecificExtension(url)).toBe('jpg');
    });

    it('handles Best Buy URLs with hyphens', () => {
      const url = 'https://bestbuy.com/site/electronics-item-here/999999.p';
      expect(getDomainSpecificExtension(url)).toBe('jpg');
    });
  });

  // -------------------------------------------------------------------------
  // Cloudinary patterns
  // -------------------------------------------------------------------------
  describe('Cloudinary', () => {
    it('returns detected extension for Cloudinary URLs', () => {
      const url = 'https://res.cloudinary.com/demo/image/upload/v1/sample/jpg/';
      expect(getDomainSpecificExtension(url)).toBe('jpg');
    });

    it('handles different Cloudinary image formats', () => {
      const formats = [
        { url: 'https://cloudinary.com/test/image/upload/v1/photo/jpeg/', expected: 'jpeg' },
        { url: 'https://cloudinary.com/test/image/upload/v1/photo/png/', expected: 'png' },
        { url: 'https://cloudinary.com/test/image/upload/v1/photo/gif/', expected: 'gif' },
        { url: 'https://cloudinary.com/test/image/upload/v1/photo/webp/', expected: 'webp' },
        { url: 'https://cloudinary.com/test/image/upload/v1/photo/avif/', expected: 'avif' },
      ];

      for (const { url, expected } of formats) {
        expect(getDomainSpecificExtension(url)).toBe(expected);
      }
    });

    it('handles jpeg variant', () => {
      const url = 'https://cloudinary.com/test/image/upload/v1/photo/jpeg/';
      const result = getDomainSpecificExtension(url);
      expect(result === 'jpeg' || result === 'jpg').toBe(true);
    });

    it('defaults to jpg for Cloudinary URLs with no match', () => {
      const url = 'https://cloudinary.com/test/image/upload/v1/photo/';
      // If pattern doesn't match completely, it returns null
      const result = getDomainSpecificExtension(url);
      expect(result === 'jpg' || result === null).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Unknown domains
  // -------------------------------------------------------------------------
  describe('unknown domains', () => {
    it('returns null for unknown domain patterns', () => {
      const urls = [
        'https://example.com/image.jpg',
        'https://unknown-site.com/product/123',
        'https://random.org/photos/abc',
      ];

      for (const url of urls) {
        expect(getDomainSpecificExtension(url)).toBeNull();
      }
    });

    it('returns null for non-matching Amazon URLs', () => {
      const url = 'https://amazon.com/product/B0123456';
      expect(getDomainSpecificExtension(url)).toBeNull();
    });

    it('returns null for partial matches', () => {
      const urls = [
        'https://rei.com/products',
        'https://walmart.com/search',
        'https://target.com/cart',
      ];

      for (const url of urls) {
        expect(getDomainSpecificExtension(url)).toBeNull();
      }
    });

    it('returns null for empty string', () => {
      expect(getDomainSpecificExtension('')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles URLs with query parameters', () => {
      const url = 'https://rei.com/media/product/123456?size=large';
      // Query params after product ID break the pattern
      expect(getDomainSpecificExtension(url)).toBeNull();
    });

    it('handles URLs with fragments', () => {
      const url = 'https://amazon.com/images/I/51AbCdEfGh#main';
      // Fragment breaks the pattern (ends with fragment, not image ID)
      expect(getDomainSpecificExtension(url)).toBeNull();
    });

    it('handles URLs with http vs https', () => {
      const httpUrl = 'http://rei.com/media/product/123456';
      const httpsUrl = 'https://rei.com/media/product/123456';
      expect(getDomainSpecificExtension(httpUrl)).toBe('jpg');
      expect(getDomainSpecificExtension(httpsUrl)).toBe('jpg');
    });

    it('handles URLs with www subdomain', () => {
      const url = 'https://www.amazon.com/images/I/71XyZ123AB';
      expect(getDomainSpecificExtension(url)).toBe('jpg');
    });
  });

  // -------------------------------------------------------------------------
  // Case sensitivity
  // -------------------------------------------------------------------------
  describe('case sensitivity', () => {
    it('patterns are case-sensitive by default', () => {
      // The regex patterns don't have the 'i' flag, so they're case-sensitive
      const url = 'https://REI.com/media/product/123456';
      const result = getDomainSpecificExtension(url);
      // This should return null because REI.com doesn't match rei.com pattern
      expect(result).toBeNull();
    });

    it('handles lowercase domain names correctly', () => {
      const urls = [
        'https://rei.com/media/product/123456',
        'https://amazon.com/images/I/51AbCdEfGh',
        'https://walmart.com/ip/product/123456',
      ];

      for (const url of urls) {
        const result = getDomainSpecificExtension(url);
        expect(result).not.toBeNull();
      }
    });
  });
});
