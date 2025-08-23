import * as FileSystem from 'expo-file-system';
import { IMAGES_DIR } from '../constants';
import * as Crypto from 'expo-crypto';

export class ImageCacheManager {
  private static instance: ImageCacheManager;
  public cacheDirectory: string;

  private constructor() {
    this.cacheDirectory = IMAGES_DIR;
  }

  public static getInstance(): ImageCacheManager {
    if (!ImageCacheManager.instance) {
      ImageCacheManager.instance = new ImageCacheManager();
    }
    return ImageCacheManager.instance;
  }

  /**
   * Initialize the cache directory
   */
  public async initCacheDirectory(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(this.cacheDirectory);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.cacheDirectory, { intermediates: true });
    }
  }

  /**
   * Get the local URI for an image if it exists
   */
  public async getCachedImageUri(fileName: string): Promise<string | null> {
    if (!fileName) return null;

    // If this is a URL, we need to generate a proper filename from it
    if (this.isRemoteURL(fileName)) {
      const hashedFileName = await this.getHashedFilename(fileName);
      const localUri = `${this.cacheDirectory}${hashedFileName}`;
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      return fileInfo.exists ? localUri : null;
    } else {
      const localUri = `${this.cacheDirectory}${fileName}`;
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      return fileInfo.exists ? localUri : null;
    }
  }

  /**
   * Download and cache an image
   */
  public async cacheRemoteImage(fileNameOrUrl: string): Promise<string> {
    if (!fileNameOrUrl) throw new Error('No filename or URL provided');
    await this.initCacheDirectory();

    let localFileName: string;
    if (this.isRemoteURL(fileNameOrUrl)) {
      localFileName = await this.getHashedFilename(fileNameOrUrl);
    } else {
      return fileNameOrUrl;
    }

    const localUri = `${this.cacheDirectory}${localFileName}`;
    const fileInfo = await FileSystem.getInfoAsync(localUri);

    if (!fileInfo.exists) {
      try {
        const downloadResult = await FileSystem.downloadAsync(fileNameOrUrl, localUri, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
            Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
          },
        });

        if (downloadResult.status !== 200) {
          throw new Error(`Failed to download image: ${downloadResult.status}`);
        }
      } catch (error) {
        console.error('Download error:', error);
        throw error;
      }
    }

    return localFileName;
  }

  public async cacheLocalTempImage(tempImageUri: string, fileName: string): Promise<void> {
    if (!tempImageUri || !fileName) return;
    await this.initCacheDirectory();

    const localUri = `${this.cacheDirectory}${fileName}`;

    await FileSystem.moveAsync({
      from: tempImageUri,
      to: localUri,
    });
  }

  /**
   * Clear a specific cached image
   */
  public async clearImage(fileName: string): Promise<void> {
    if (!fileName) return;

    if (this.isRemoteURL(fileName)) {
      const hashedFileName = await this.getHashedFilename(fileName);
      const localUri = `${this.cacheDirectory}${hashedFileName}`;
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(localUri);
      }
      return;
    }

    const localUri = `${this.cacheDirectory}${fileName}`;
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(localUri);
    }
  }

  /**
   * Clear all cached images
   */
  public async clearCache(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(this.cacheDirectory);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(this.cacheDirectory);
      await this.initCacheDirectory();
    }
  }

  /**
   * Check if a string is a remote URL
   */
  private isRemoteURL(str: string): boolean {
    return str && (str.startsWith('http://') || str.startsWith('https://'));
  }

  /**
   * Generate a hashed filename from a URL to use as a local filename
   */
  private async getHashedFilename(url: string): Promise<string> {
    // Create a hash of the URL to use as filename
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, url);

    // Extract file extension from URL if possible
    let extension = '.jpg';
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const lastDotIndex = pathname.lastIndexOf('.');
      if (lastDotIndex !== -1) {
        extension = pathname.substring(lastDotIndex);
      }
      // URL parsing failed, use default extension
      console.warn('Failed to parse URL for extension:', error);
    }

    return `${hash.substring(0, 16)}${extension}`;
  }

  /**
   * Get cache info including size and file count
   */
  public async getCacheInfo(): Promise<{ size: number; count: number }> {
    const dirInfo = await FileSystem.getInfoAsync(this.cacheDirectory);
    if (!dirInfo.exists) {
      return { size: 0, count: 0 };
    }

    const files = await FileSystem.readDirectoryAsync(this.cacheDirectory);
    let totalSize = 0;

    for (const file of files) {
      const fileInfo = await FileSystem.getInfoAsync(`${this.cacheDirectory}${file}`);
      if (fileInfo.exists && fileInfo.size) {
        totalSize += fileInfo.size;
      }
    }

    return {
      size: totalSize,
      count: files.length,
    };
  }
}

export default ImageCacheManager.getInstance();
