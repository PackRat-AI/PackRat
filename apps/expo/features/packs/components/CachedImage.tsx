import { Text } from '@packrat/ui/nativewindui';
import { clientEnvs } from 'expo-app/env/clientEnvs';
import { useUser } from 'expo-app/features/auth/hooks/useUser';
import ImageCacheManager from 'expo-app/lib/utils/ImageCacheManager';
import type React from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, type ImageProps, View } from 'react-native';

interface CachedImageProps extends Omit<ImageProps, 'source'> {
  localFileName?: string | null;
  remoteUrl?: string | null;
  placeholderColor?: string;
}

export const CachedImage: React.FC<CachedImageProps> = ({
  localFileName,
  remoteUrl,
  className,
  placeholderColor = '#e1e1e1',
  ...props
}) => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const user = useUser();

  const isRemoteUrl = localFileName?.startsWith('http://') || localFileName?.startsWith('https://');

  const actualRemoteUrl = remoteUrl || (isRemoteUrl ? localFileName : null);

  const remoteFileName =
    localFileName && !isRemoteUrl && user?.id ? `${user?.id}-${localFileName}` : null;
  const cloudStorageUrl = remoteFileName
    ? `${clientEnvs.EXPO_PUBLIC_R2_PUBLIC_URL}/${remoteFileName}`
    : null;

  useEffect(() => {
    const loadImage = async () => {
      try {
        setLoading(true);

        if (!localFileName && !actualRemoteUrl) {
          setLoading(false);
          return;
        }

        if (localFileName && !isRemoteUrl) {
          const localUri = await ImageCacheManager.getCachedImageUri(localFileName);
          if (localUri) {
            setImageUri(localUri);
            setLoading(false);
            return;
          }
        }

        if (actualRemoteUrl) {
          try {
            const cachedFileName = await ImageCacheManager.cacheRemoteImage(actualRemoteUrl);
            const localUri = await ImageCacheManager.getCachedImageUri(cachedFileName);
            setImageUri(localUri);
          } catch (err) {
            console.error('Failed to cache remote image:', err);
            setImageUri(actualRemoteUrl);
          }
        } else if (cloudStorageUrl) {
          setImageUri(cloudStorageUrl);
        }
      } catch (error) {
        console.error('Error loading image:', error);
        if (actualRemoteUrl) {
          setImageUri(actualRemoteUrl);
        } else if (cloudStorageUrl) {
          setImageUri(cloudStorageUrl);
        }
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  }, [localFileName, actualRemoteUrl, cloudStorageUrl, isRemoteUrl]);

  if (!localFileName && !actualRemoteUrl)
    return (
      <View className={`items-center justify-center bg-muted px-2 ${className}`}>
        <Text className="text-muted-foreground">No image</Text>
      </View>
    );

  if (loading) {
    return (
      <View
        className={`items-center justify-center bg-muted px-2 ${className}`}
        style={[{ backgroundColor: placeholderColor }]}
      >
        <ActivityIndicator size="small" color="#999" />
      </View>
    );
  }

  return imageUri ? (
    <Image source={{ uri: imageUri }} {...props} className={className} />
  ) : (
    <View className={`items-center justify-center bg-muted px-2 ${className}`}>
      <Text className="text-muted-foreground">Failed to load</Text>
    </View>
  );
};
