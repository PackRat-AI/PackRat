import ImageCacheManager from 'expo-app/lib/utils/ImageCacheManager';

export async function cacheCatalogItemImage(imageUrl?: string): Promise<string | null> {
  if (!imageUrl) {
    return null;
  }

  try {
    const filename = await ImageCacheManager.cacheRemoteImage(imageUrl);
    return filename;
  } catch (err) {
    console.log('caching remote image failed', err);
    return null;
  }
}
