import * as Sentry from '@sentry/react-native';
import { Icon } from 'expo-app/components/Icon';
import ImageCacheManager from 'expo-app/lib/utils/ImageCacheManager';
import type React from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, type ImageProps, Pressable, View } from 'react-native';

interface CachedImageProps extends Omit<ImageProps, 'source'> {
  imageObjectKey: string;
  imageRemoteUrl: string;
  placeholderColor?: string;
}

export const CachedImage: React.FC<CachedImageProps> = ({
  imageObjectKey,
  imageRemoteUrl,
  placeholderColor = '#e1e1e1',
  ...props
}) => {
  const [imageLocalUri, setImageLocalUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!imageObjectKey || !imageRemoteUrl) return;
    let cancelled = false;

    const loadImage = async () => {
      setLoading(true);
      setHasError(false);
      setImageLocalUri(null);

      try {
        Sentry.addBreadcrumb({
          category: 'cachedImage',
          message: 'Loading image',
          level: 'info',
          data: { imageObjectKey },
        });

        const cachedUri = await ImageCacheManager.getCachedImageUri(imageObjectKey);
        if (cachedUri) {
          if (!cancelled) setImageLocalUri(cachedUri);
        } else {
          Sentry.addBreadcrumb({
            category: 'cachedImage',
            message: 'Cache miss — downloading',
            level: 'info',
            data: { imageObjectKey },
          });
          const downloadedUri = await ImageCacheManager.cacheRemoteImage({
            fileName: imageObjectKey,
            remoteUrl: imageRemoteUrl,
          });
          if (!cancelled) setImageLocalUri(downloadedUri);
        }
      } catch (error) {
        Sentry.captureException(error, {
          tags: { feature: 'cachedImage', action: 'loadImage' },
          extra: { imageObjectKey },
        });
        if (!cancelled) setHasError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadImage();
    return () => {
      cancelled = true;
    };
  }, [imageObjectKey, imageRemoteUrl, retryCount]);

  const placeholderClass = `items-center justify-center ${props.className ?? ''}`;
  const placeholderStyle = [{ backgroundColor: placeholderColor }];

  if (loading) {
    return (
      <View className={placeholderClass} style={placeholderStyle}>
        <ActivityIndicator size="small" color="#999" />
      </View>
    );
  }

  if (hasError) {
    return (
      <Pressable
        className={placeholderClass}
        style={placeholderStyle}
        onPress={() => setRetryCount((c) => c + 1)}
        accessibilityLabel="Tap to retry loading image"
        accessibilityRole="button"
      >
        <Icon name="refresh" size={20} color="#999" />
      </Pressable>
    );
  }

  return <Image source={{ uri: imageLocalUri ?? undefined }} {...props} />;
};
