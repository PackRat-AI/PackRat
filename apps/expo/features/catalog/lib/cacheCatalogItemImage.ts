import ImageCacheManager from 'expo-app/lib/utils/ImageCacheManager';

export async function cacheCatalogItemImage(imageUrl?: string): Promise<string | null> {
  if (!imageUrl) {
    return null;
  }

  try {
    // Generate a filename from the URL
    const fileName = imageUrl.split('/').pop() || `image_${Date.now()}.jpg`;
    const filename = await ImageCacheManager.cacheRemoteImage(fileName, imageUrl);
    return filename;
  } catch (err) {
    console.log('caching remote image failed', err);
    return null;
  }
}
