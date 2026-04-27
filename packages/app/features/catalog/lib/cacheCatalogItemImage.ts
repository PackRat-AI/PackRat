import ImageCacheManager from 'app/lib/utils/ImageCacheManager';
import { getImageExtension } from 'app/lib/utils/imageUtils';
import { nanoid } from 'nanoid';

export async function cacheCatalogItemImage(imageUrl?: string): Promise<string | null> {
  if (!imageUrl) {
    return null;
  }

  try {
    const extension = await getImageExtension(imageUrl);
    const filename = `${nanoid()}.${extension}`;
    await ImageCacheManager.cacheRemoteImage(filename, imageUrl);
    return filename;
  } catch (err) {
    console.log('caching remote image failed', err);
    return null;
  }
}
