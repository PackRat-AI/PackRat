import * as Sentry from '@sentry/react-native';
import { Icon } from 'expo-app/components/Icon';
import ImageCacheManager from 'expo-app/lib/utils/ImageCacheManager';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, type ImageProps, Pressable, View } from 'react-native';

interface CachedImageProps extends Omit<ImageProps, 'source'> {
  imageObjectKey: string;
  imageRemoteUrl: string;
  placeholderColor?: string;
}

const CLIENT_ERROR_STATUS_RE = /^Failed to download image: 4\d\d/;

// Errors caused by bad content (wrong content-type, 4xx) are permanent — retrying won't help.
// Network timeouts and 5xx are transient and worth retrying.
function isPermanentDownloadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.startsWith('Invalid content type') || CLIENT_ERROR_STATUS_RE.test(error.message)
  );
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
  const [isPermanentError, setIsPermanentError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const hasClearedCorruptedCache = useRef(false);

  useEffect(() => {
    hasClearedCorruptedCache.current = false;
  }, [imageObjectKey]);

  const handleImageError = useCallback(async () => {
    if (!hasClearedCorruptedCache.current) {
      hasClearedCorruptedCache.current = true;
      Sentry.addBreadcrumb({
        category: 'cachedImage',
        message: 'Cached image failed to render — clearing corrupted cache entry',
        level: 'warning',
        data: { imageObjectKey },
      });
      try {
        await ImageCacheManager.clearImage(imageObjectKey);
      } catch (error) {
        Sentry.captureException(error, {
          tags: { feature: 'cachedImage', action: 'clearCorruptedCache' },
          extra: { imageObjectKey },
        });
      }
      setRetryCount((c) => c + 1);
    } else {
      // Second failure after auto-heal attempt — the image content itself is broken.
      setIsPermanentError(true);
      setHasError(true);
    }
  }, [imageObjectKey]);

  useEffect(() => {
    if (!imageObjectKey || !imageRemoteUrl) return;
    let cancelled = false;

    const loadImage = async () => {
      setLoading(true);
      setHasError(false);
      setIsPermanentError(false);
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
        if (!cancelled) {
          setIsPermanentError(isPermanentDownloadError(error));
          setHasError(true);
        }
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
    if (isPermanentError) {
      return (
        <View
          className={placeholderClass}
          style={placeholderStyle}
          accessibilityLabel="Image unavailable"
        >
          <Icon name="image-off" size={20} color="#999" />
        </View>
      );
    }
    return (
      <Pressable
        className={placeholderClass}
        style={placeholderStyle}
        onPress={() => {
          hasClearedCorruptedCache.current = false;
          setRetryCount((c) => c + 1);
        }}
        accessibilityLabel="Tap to retry loading image"
        accessibilityRole="button"
      >
        <Icon name="refresh" size={20} color="#999" />
      </Pressable>
    );
  }

  return (
    <Image source={{ uri: imageLocalUri ?? undefined }} onError={handleImageError} {...props} />
  );
};
