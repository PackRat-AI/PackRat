import ImageCacheManager from 'expo-app/lib/utils/ImageCacheManager';
import { getImageExtension } from 'expo-app/lib/utils/imageUtils';
import { nanoid } from 'nanoid';
import { Platform } from 'react-native';

export async function cacheCatalogItemImage(imageUrl?: string): Promise<string | null> {
  if (!imageUrl) {
    return null;
  }

  try {
    const extension = await getImageExtension(imageUrl);
    const filename = `${nanoid()}.${extension}`;
    const cachedImage = await ImageCacheManager.cacheRemoteImage(filename, imageUrl);
    if (Platform.OS === 'web') return cachedImage;
    return filename;
  } catch (err) {
    console.log('caching remote image failed', err);
    return null;
  }
}
