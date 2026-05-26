import { useColorScheme } from '@packrat/ui/nativewindui';
import { Icon } from 'expo-app/components/Icon';
import { getWebImageContainmentStyle } from 'expo-app/lib/utils/imageStyles';
import { Image, type ImageProps, Platform, View } from 'react-native';

interface PackItemImageProps extends Omit<ImageProps, 'source'> {
  imageUrl?: string | null;
}

export function CatalogItemImage({ imageUrl, ...imageProps }: PackItemImageProps) {
  const { colors } = useColorScheme();
  const webContainmentStyle = getWebImageContainmentStyle(imageProps.resizeMode ?? 'cover');

  if (!imageUrl)
    return (
      <View
        style={Platform.OS === 'web' ? { maxWidth: '100%', maxHeight: '100%' } : undefined}
        className={`items-center justify-center bg-neutral-300 dark:bg-neutral-600 ${imageProps.className}`}
      >
        <Icon name="image" size={24} color={colors.grey} />
      </View>
    );

  return (
    <Image
      source={{
        uri: imageUrl,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
          Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
        },
      }}
      {...imageProps}
      style={[webContainmentStyle, imageProps.style]}
      className={`bg-muted ${imageProps.className}`}
    />
  );
}
