import { describe, expect, it, vi } from 'vitest';

// Mock clientEnvs before importing
vi.mock('@packrat/env/expo-client', () => ({
  clientEnvs: {
    EXPO_PUBLIC_R2_PUBLIC_URL: 'https://cdn.example.com',
  },
}));

import { buildImageUrl } from '../buildImageUrl';

const mockEnv = {
  EXPO_PUBLIC_R2_PUBLIC_URL: 'https://cdn.example.com',
};

describe('buildImageUrl', () => {
  // -------------------------------------------------------------------------
  // Basic functionality
  // -------------------------------------------------------------------------
  describe('basic functionality', () => {
    it('builds URL with userId and image', () => {
      const item = { userId: 123, image: 'tent.jpg' };
      const url = buildImageUrl(item as any);
      expect(url).toBe('https://cdn.example.com/123-tent.jpg');
    });

    it('handles string userId', () => {
      const item = { userId: '456', image: 'backpack.png' };
      const url = buildImageUrl(item as any);
      expect(url).toBe('https://cdn.example.com/456-backpack.png');
    });

    it('handles different image extensions', () => {
      const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      for (const ext of extensions) {
        const item = { userId: 1, image: `photo.${ext}` };
        const url = buildImageUrl(item as any);
        expect(url).toBe(`https://cdn.example.com/1-photo.${ext}`);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles image names with hyphens', () => {
      const item = { userId: 100, image: 'my-cool-tent.jpg' };
      const url = buildImageUrl(item as any);
      expect(url).toBe('https://cdn.example.com/100-my-cool-tent.jpg');
    });

    it('handles image names with underscores', () => {
      const item = { userId: 200, image: 'sleeping_bag.png' };
      const url = buildImageUrl(item as any);
      expect(url).toBe('https://cdn.example.com/200-sleeping_bag.png');
    });

    it('handles image names with spaces', () => {
      const item = { userId: 300, image: 'water bottle.jpg' };
      const url = buildImageUrl(item as any);
      expect(url).toBe('https://cdn.example.com/300-water bottle.jpg');
    });

    it('handles image names with special characters', () => {
      const item = { userId: 400, image: 'item@2x.png' };
      const url = buildImageUrl(item as any);
      expect(url).toBe('https://cdn.example.com/400-item@2x.png');
    });

    it('handles empty image name', () => {
      const item = { userId: 500, image: '' };
      const url = buildImageUrl(item as any);
      expect(url).toBe('https://cdn.example.com/500-');
    });
  });

  // -------------------------------------------------------------------------
  // Real-world scenarios
  // -------------------------------------------------------------------------
  describe('real-world scenarios', () => {
    it('builds URL for pack template item', () => {
      const packTemplateItem = {
        userId: 789,
        image: 'ultralight-tent.jpg',
        name: 'Ultralight Tent',
        weight: 900,
      };
      const url = buildImageUrl(packTemplateItem as any);
      expect(url).toBe('https://cdn.example.com/789-ultralight-tent.jpg');
    });

    it('builds URL for pack item', () => {
      const packItem = {
        userId: 321,
        image: 'sleeping-bag-winter.png',
        weight: 1200,
        quantity: 1,
      };
      const url = buildImageUrl(packItem as any);
      expect(url).toBe('https://cdn.example.com/321-sleeping-bag-winter.png');
    });

    it('uses base URL from environment', () => {
      const item = { userId: 999, image: 'test.jpg' };
      const url = buildImageUrl(item as any);
      expect(url).toContain(mockEnv.EXPO_PUBLIC_R2_PUBLIC_URL);
    });
  });

  // -------------------------------------------------------------------------
  // URL structure
  // -------------------------------------------------------------------------
  describe('URL structure', () => {
    it('follows pattern baseUrl/userId-image', () => {
      const item = { userId: 123, image: 'item.jpg' };
      const url = buildImageUrl(item as any);
      const parts = url.split('/');
      const lastPart = parts[parts.length - 1];
      expect(lastPart).toBe('123-item.jpg');
    });

    it('includes forward slash separator', () => {
      const item = { userId: 456, image: 'test.png' };
      const url = buildImageUrl(item as any);
      expect(url).toContain('/');
    });

    it('includes hyphen between userId and image', () => {
      const item = { userId: 789, image: 'photo.jpg' };
      const url = buildImageUrl(item as any);
      expect(url).toContain('-');
    });
  });

  // -------------------------------------------------------------------------
  // Type compatibility
  // -------------------------------------------------------------------------
  describe('type compatibility', () => {
    it('works with PackTemplateItem structure', () => {
      const item = {
        id: 'template-1',
        userId: 111,
        image: 'template.jpg',
        name: 'Template Item',
        description: 'Test',
        category: 'gear',
      };
      const url = buildImageUrl(item as any);
      expect(url).toBe('https://cdn.example.com/111-template.jpg');
    });

    it('works with PackItem structure', () => {
      const item = {
        id: 'pack-1',
        userId: 222,
        image: 'pack.jpg',
        packId: 'pack-123',
        weight: 500,
        quantity: 2,
      };
      const url = buildImageUrl(item as any);
      expect(url).toBe('https://cdn.example.com/222-pack.jpg');
    });
  });
});
