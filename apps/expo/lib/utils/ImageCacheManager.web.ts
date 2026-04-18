/**
 * Web stub for ImageCacheManager.
 * The browser handles HTTP caching natively; no local file cache is needed on web.
 * All methods are safe no-ops so that callers compile and run without changes.
 */
class WebImageCacheManager {
  public cacheDirectory = '';

  public async initCacheDirectory(): Promise<void> {}

  public async getCachedImageUri(_fileName: string): Promise<string | null> {
    return null;
  }

  public async cacheRemoteImage(_fileName: string, remoteUrl: string): Promise<string> {
    return remoteUrl;
  }

  public async cacheLocalTempImage(_tempImageUri: string, _fileName: string): Promise<void> {}

  public async clearImage(_fileName: string): Promise<void> {}

  public async clearCache(): Promise<void> {}

  public async getCacheInfo(): Promise<{ size: number; count: number }> {
    return { size: 0, count: 0 };
  }
}

export { WebImageCacheManager as ImageCacheManager };
export default new WebImageCacheManager();
