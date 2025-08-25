import ImageCacheManager from 'expo-app/lib/utils/ImageCacheManager';
import type React from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, type ImageProps, View } from 'react-native';

interface CachedImageProps extends Omit<ImageProps, 'source'> {
  imageObjectKey: string;
  imageRemoteUrl: string;
  placeholderColor?: string;
}

/**
 * CachedImage
 *
 * Responsible for displaying user-owned item images.
 * Loads from local cache if available, otherwise downloads and caches the image
 * before displaying. Shows loading indicator while fetching.
 */
export const CachedImage: React.FC<CachedImageProps> = ({
  imageObjectKey,
  imageRemoteUrl,
  placeholderColor = '#e1e1e1',
  ...props
}) => {
  const [imageLocalUri, setImageLocalUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  console.log(imageLocalUri);

  useEffect(() => {
    if (!imageObjectKey) return;
    const loadImage = async () => {
      try {
        setLoading(true);

        const localUri = await ImageCacheManager.getCachedImageUri(imageObjectKey);
        if (localUri) {
          setImageLocalUri(localUri);
        } else {
          const localUri = await ImageCacheManager.cacheRemoteImage(imageObjectKey, imageRemoteUrl);
          setImageLocalUri(localUri);
        }
      } catch (error) {
        console.error('Error loading image:', error);
        // TODO: Handle error state if needed
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  }, [imageObjectKey, imageRemoteUrl]);

  if (loading) {
    return (
      <View
        className={`items-center justify-center bg-muted px-2 ${props.className}`}
        style={[{ backgroundColor: placeholderColor }]}
      >
        <ActivityIndicator size="small" color="#999" />
      </View>
    );
  }

  return <Image source={{ uri: imageLocalUri ?? undefined }} {...props} />;
};
