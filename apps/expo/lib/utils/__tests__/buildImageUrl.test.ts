import { describe, expect, it, vi, beforeEach } from 'vitest';
import { buildImageUrl } from '../buildImageUrl';
import type { PackTemplateItem } from 'expo-app/features/pack-templates';
import type { PackItem } from 'expo-app/features/packs';

// Mock the clientEnvs module
vi.mock('expo-app/env/clientEnvs', () => ({
  clientEnvs: {
    EXPO_PUBLIC_R2_PUBLIC_URL: 'https://cdn.example.com',
  },
}));

describe('buildImageUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PackItem', () => {
    it('should build URL with userId and image', () => {
      const packItem: PackItem = {
        id: '123',
        userId: 'user-456',
        image: 'tent.jpg',
        weight: 1000,
        quantity: 1,
        weightUnit: 'g',
        name: 'Tent',
      } as PackItem;

      const url = buildImageUrl(packItem);

      expect(url).toBe('https://cdn.example.com/user-456-tent.jpg');
    });

    it('should handle different image filenames', () => {
      const packItem: PackItem = {
        id: '123',
        userId: 'user-789',
        image: 'backpack-large.png',
        weight: 2000,
        quantity: 1,
        weightUnit: 'g',
        name: 'Backpack',
      } as PackItem;

      const url = buildImageUrl(packItem);

      expect(url).toBe('https://cdn.example.com/user-789-backpack-large.png');
    });
  });

  describe('PackTemplateItem', () => {
    it('should build URL for pack template item', () => {
      const templateItem: PackTemplateItem = {
        id: '456',
        userId: 'user-123',
        image: 'sleeping-bag.jpg',
        weight: 1500,
        quantity: 1,
        weightUnit: 'g',
        name: 'Sleeping Bag',
      } as PackTemplateItem;

      const url = buildImageUrl(templateItem);

      expect(url).toBe('https://cdn.example.com/user-123-sleeping-bag.jpg');
    });

    it('should handle UUID-style userIds', () => {
      const templateItem: PackTemplateItem = {
        id: '789',
        userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        image: 'stove.webp',
        weight: 500,
        quantity: 1,
        weightUnit: 'g',
        name: 'Camp Stove',
      } as PackTemplateItem;

      const url = buildImageUrl(templateItem);

      expect(url).toBe('https://cdn.example.com/a1b2c3d4-e5f6-7890-abcd-ef1234567890-stove.webp');
    });
  });

  describe('edge cases', () => {
    it('should handle image names with special characters', () => {
      const packItem: PackItem = {
        id: '123',
        userId: 'user-456',
        image: 'item_with-special.chars.jpg',
        weight: 1000,
        quantity: 1,
        weightUnit: 'g',
        name: 'Item',
      } as PackItem;

      const url = buildImageUrl(packItem);

      expect(url).toBe('https://cdn.example.com/user-456-item_with-special.chars.jpg');
    });

    it('should handle numeric userIds', () => {
      const packItem: PackItem = {
        id: '123',
        userId: '12345',
        image: 'item.jpg',
        weight: 1000,
        quantity: 1,
        weightUnit: 'g',
        name: 'Item',
      } as PackItem;

      const url = buildImageUrl(packItem);

      expect(url).toBe('https://cdn.example.com/12345-item.jpg');
    });

    it('should preserve image extensions', () => {
      const extensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];

      for (const ext of extensions) {
        const packItem: PackItem = {
          id: '123',
          userId: 'user-456',
          image: `image.${ext}`,
          weight: 1000,
          quantity: 1,
          weightUnit: 'g',
          name: 'Item',
        } as PackItem;

        const url = buildImageUrl(packItem);

        expect(url).toBe(`https://cdn.example.com/user-456-image.${ext}`);
      }
    });
  });

  describe('URL structure', () => {
    it('should follow the pattern: baseUrl/userId-image', () => {
      const packItem: PackItem = {
        id: '123',
        userId: 'user-abc',
        image: 'photo.jpg',
        weight: 1000,
        quantity: 1,
        weightUnit: 'g',
        name: 'Item',
      } as PackItem;

      const url = buildImageUrl(packItem);
      const parts = url.split('/');

      expect(parts[0]).toBe('https:');
      expect(parts[1]).toBe('');
      expect(parts[2]).toBe('cdn.example.com');
      expect(parts[3]).toBe('user-abc-photo.jpg');
    });

    it('should construct well-formed URLs', () => {
      const packItem: PackItem = {
        id: '123',
        userId: 'user-123',
        image: 'test.jpg',
        weight: 1000,
        quantity: 1,
        weightUnit: 'g',
        name: 'Item',
      } as PackItem;

      const url = buildImageUrl(packItem);

      // Check that URL is well-formed
      expect(url).toMatch(/^https:\/\/[^/]+\/.+$/);
      expect(url).not.toContain('com//');
    });
  });
});
