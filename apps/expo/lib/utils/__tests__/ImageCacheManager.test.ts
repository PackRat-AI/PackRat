import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock expo-file-system - must export both default and named exports
vi.mock('expo-file-system/legacy', () => {
  const mocks = {
    getInfoAsync: vi.fn(),
    makeDirectoryAsync: vi.fn(),
    downloadAsync: vi.fn(),
    moveAsync: vi.fn(),
    deleteAsync: vi.fn(),
    readDirectoryAsync: vi.fn(),
  };
  return {
    default: mocks,
    ...mocks,
    documentDirectory: '/mock/documents/',
  };
});

// Mock IMAGES_DIR constant
vi.mock('../constants', () => ({
  IMAGES_DIR: '/mock/documents/images/',
}));

import * as FileSystem from 'expo-file-system/legacy';
import { ImageCacheManager } from '../ImageCacheManager';

describe('ImageCacheManager', () => {
  let manager: ImageCacheManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = ImageCacheManager.getInstance();
  });

  // -------------------------------------------------------------------------
  // Singleton pattern
  // -------------------------------------------------------------------------
  describe('singleton pattern', () => {
    it('returns same instance on multiple getInstance calls', () => {
      const instance1 = ImageCacheManager.getInstance();
      const instance2 = ImageCacheManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('has cache directory set', () => {
      expect(manager.cacheDirectory).toBe('/mock/documents/images/');
    });
  });

  // -------------------------------------------------------------------------
  // initCacheDirectory
  // -------------------------------------------------------------------------
  describe('initCacheDirectory', () => {
    it('creates directory if it does not exist', async () => {
      vi.mocked(FileSystem.getInfoAsync).mockResolvedValue({ exists: false } as any);

      await manager.initCacheDirectory();

      expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith('/mock/documents/images/', {
        intermediates: true,
      });
    });

    it('does not create directory if it already exists', async () => {
      vi.mocked(FileSystem.getInfoAsync).mockResolvedValue({ exists: true } as any);

      await manager.initCacheDirectory();

      expect(FileSystem.makeDirectoryAsync).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // getCachedImageUri
  // -------------------------------------------------------------------------
  describe('getCachedImageUri', () => {
    it('returns local URI if file exists', async () => {
      vi.mocked(FileSystem.getInfoAsync).mockResolvedValue({ exists: true } as any);

      const result = await manager.getCachedImageUri('test.jpg');

      expect(result).toBe('/mock/documents/images/test.jpg');
    });

    it('returns null if file does not exist', async () => {
      vi.mocked(FileSystem.getInfoAsync).mockResolvedValue({ exists: false } as any);

      const result = await manager.getCachedImageUri('missing.jpg');

      expect(result).toBeNull();
    });

    it('checks correct file path', async () => {
      vi.mocked(FileSystem.getInfoAsync).mockResolvedValue({ exists: true } as any);

      await manager.getCachedImageUri('image.png');

      expect(FileSystem.getInfoAsync).toHaveBeenCalledWith('/mock/documents/images/image.png');
    });
  });

  // -------------------------------------------------------------------------
  // cacheRemoteImage
  // -------------------------------------------------------------------------
  describe('cacheRemoteImage', () => {
    it('downloads image if not cached', async () => {
      vi.mocked(FileSystem.getInfoAsync)
        .mockResolvedValueOnce({ exists: false } as any) // initCacheDirectory check
        .mockResolvedValueOnce({ exists: false } as any); // file exists check
      vi.mocked(FileSystem.downloadAsync).mockResolvedValue({ status: 200 } as any);

      const result = await manager.cacheRemoteImage('test.jpg', 'https://example.com/test.jpg');

      expect(FileSystem.downloadAsync).toHaveBeenCalledWith(
        'https://example.com/test.jpg',
        '/mock/documents/images/test.jpg',
        {
          headers: {
            'User-Agent': expect.any(String),
            Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
          },
        },
      );
      expect(result).toBe('/mock/documents/images/test.jpg');
    });

    it('skips download if file already cached', async () => {
      vi.mocked(FileSystem.getInfoAsync)
        .mockResolvedValueOnce({ exists: true } as any) // initCacheDirectory check
        .mockResolvedValueOnce({ exists: true } as any); // file exists check

      const result = await manager.cacheRemoteImage('cached.jpg', 'https://example.com/cached.jpg');

      expect(FileSystem.downloadAsync).not.toHaveBeenCalled();
      expect(result).toBe('/mock/documents/images/cached.jpg');
    });

    it('throws error on failed download', async () => {
      vi.mocked(FileSystem.getInfoAsync)
        .mockResolvedValueOnce({ exists: true } as any)
        .mockResolvedValueOnce({ exists: false } as any);
      vi.mocked(FileSystem.downloadAsync).mockResolvedValue({ status: 404 } as any);

      await expect(
        manager.cacheRemoteImage('fail.jpg', 'https://example.com/fail.jpg'),
      ).rejects.toThrow('Failed to download image: 404');
    });

    it('initializes cache directory before download', async () => {
      vi.mocked(FileSystem.getInfoAsync)
        .mockResolvedValueOnce({ exists: false } as any)
        .mockResolvedValueOnce({ exists: false } as any);
      vi.mocked(FileSystem.downloadAsync).mockResolvedValue({ status: 200 } as any);

      await manager.cacheRemoteImage('test.jpg', 'https://example.com/test.jpg');

      expect(FileSystem.makeDirectoryAsync).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // cacheLocalTempImage
  // -------------------------------------------------------------------------
  describe('cacheLocalTempImage', () => {
    it('moves temp image to cache', async () => {
      vi.mocked(FileSystem.getInfoAsync).mockResolvedValue({ exists: true } as any);

      await manager.cacheLocalTempImage('/tmp/temp.jpg', 'final.jpg');

      expect(FileSystem.moveAsync).toHaveBeenCalledWith({
        from: '/tmp/temp.jpg',
        to: '/mock/documents/images/final.jpg',
      });
    });

    it('initializes cache directory before move', async () => {
      vi.mocked(FileSystem.getInfoAsync).mockResolvedValue({ exists: false } as any);

      await manager.cacheLocalTempImage('/tmp/temp.jpg', 'final.jpg');

      expect(FileSystem.makeDirectoryAsync).toHaveBeenCalled();
      expect(FileSystem.moveAsync).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // clearImage
  // -------------------------------------------------------------------------
  describe('clearImage', () => {
    it('deletes existing image', async () => {
      vi.mocked(FileSystem.getInfoAsync).mockResolvedValue({ exists: true } as any);

      await manager.clearImage('test.jpg');

      expect(FileSystem.deleteAsync).toHaveBeenCalledWith('/mock/documents/images/test.jpg');
    });

    it('does not attempt delete if image does not exist', async () => {
      vi.mocked(FileSystem.getInfoAsync).mockResolvedValue({ exists: false } as any);

      await manager.clearImage('missing.jpg');

      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // clearCache
  // -------------------------------------------------------------------------
  describe('clearCache', () => {
    it('deletes cache directory and recreates it', async () => {
      vi.mocked(FileSystem.getInfoAsync)
        .mockResolvedValueOnce({ exists: true } as any) // clearCache check
        .mockResolvedValueOnce({ exists: false } as any); // initCacheDirectory check

      await manager.clearCache();

      expect(FileSystem.deleteAsync).toHaveBeenCalledWith('/mock/documents/images/');
      expect(FileSystem.makeDirectoryAsync).toHaveBeenCalled();
    });

    it('does nothing if cache does not exist', async () => {
      vi.mocked(FileSystem.getInfoAsync).mockResolvedValue({ exists: false } as any);

      await manager.clearCache();

      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // getCacheInfo
  // -------------------------------------------------------------------------
  describe('getCacheInfo', () => {
    it('returns zero size and count if directory does not exist', async () => {
      vi.mocked(FileSystem.getInfoAsync).mockResolvedValue({ exists: false } as any);

      const info = await manager.getCacheInfo();

      expect(info).toEqual({ size: 0, count: 0 });
    });

    it('calculates total size and count of cached files', async () => {
      vi.mocked(FileSystem.getInfoAsync)
        .mockResolvedValueOnce({ exists: true } as any) // directory check
        .mockResolvedValueOnce({ exists: true, size: 1024 } as any) // file1
        .mockResolvedValueOnce({ exists: true, size: 2048 } as any); // file2
      vi.mocked(FileSystem.readDirectoryAsync).mockResolvedValue(['file1.jpg', 'file2.png']);

      const info = await manager.getCacheInfo();

      expect(info).toEqual({ size: 3072, count: 2 });
    });

    it('handles files without size property', async () => {
      vi.mocked(FileSystem.getInfoAsync)
        .mockResolvedValueOnce({ exists: true } as any)
        .mockResolvedValueOnce({ exists: true, size: 1024 } as any)
        .mockResolvedValueOnce({ exists: true } as any); // no size
      vi.mocked(FileSystem.readDirectoryAsync).mockResolvedValue(['file1.jpg', 'file2.jpg']);

      const info = await manager.getCacheInfo();

      expect(info).toEqual({ size: 1024, count: 2 });
    });

    it('handles non-existent files in directory', async () => {
      vi.mocked(FileSystem.getInfoAsync)
        .mockResolvedValueOnce({ exists: true } as any)
        .mockResolvedValueOnce({ exists: true, size: 1024 } as any)
        .mockResolvedValueOnce({ exists: false } as any);
      vi.mocked(FileSystem.readDirectoryAsync).mockResolvedValue(['file1.jpg', 'missing.jpg']);

      const info = await manager.getCacheInfo();

      expect(info).toEqual({ size: 1024, count: 2 });
    });
  });
});
