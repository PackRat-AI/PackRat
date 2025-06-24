import type React from 'react';
import { useState, useEffect } from 'react';
import { Image, type ImageProps, ActivityIndicator, View, StyleSheet } from 'react-native';
import { Text } from 'nativewindui/Text';
import { useUser } from 'expo-app/features/auth/hooks/useUser';
import ImageCacheManager from 'expo-app/lib/utils/ImageCacheManager';

interface CachedImageProps extends Omit<ImageProps, 'source'> {
  localFileName?: string;
  placeholderColor?: string;
}

export const CachedImage: React.FC<CachedImageProps> = ({
  localFileName,
  className,
  placeholderColor = '#e1e1e1',
  ...props
}) => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const user = useUser();

  const remoteFileName = `${user?.id}-${localFileName}`;
  const remoteUrl = `${process.env.EXPO_PUBLIC_R2_PUBLIC_URL}/${remoteFileName}`;

  useEffect(() => {
    if (!localFileName) return;
    const loadImage = async () => {
      try {
        setLoading(true);

        const localUri = await ImageCacheManager.getCachedImageUri(localFileName);
        if (localUri) {
          setImageUri(localUri);
        } else {
          const localUri = await ImageCacheManager.cacheRemoteImage(localFileName, remoteUrl);
          setImageUri(localUri);
        }
      } catch (error) {
        console.error('Error loading image:', error);
        // Fallback to remote URL on error
        setImageUri(remoteUrl);
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  }, [localFileName, remoteUrl]);

  if (!localFileName)
    return (
      <View className={`items-center justify-center bg-muted px-2 ${className}`}>
        <Text className="text-muted-foreground">No image</Text>
      </View>
    );

  if (loading) {
    return (
      <View
        className={`items-center justify-center bg-muted px-2 ${className}`}
        style={[{ backgroundColor: placeholderColor }]}>
        <ActivityIndicator size="small" color="#999" />
      </View>
    );
  }

  return <Image source={{ uri: imageUri || remoteUrl }} {...props} className={className} />;
};
