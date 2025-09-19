import { useColorScheme } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { Image, type ImageProps, Platform, View } from 'react-native';

interface PackItemImageProps extends Omit<ImageProps, 'source'> {
  imageUrl?: string | null;
}

export function CatalogItemImage({ imageUrl, ...imageProps }: PackItemImageProps) {
  const { colors } = useColorScheme();
  if (!imageUrl)
    return (
      <View
        className={`items-center justify-center bg-neutral-300 dark:bg-neutral-600 ${imageProps.className}`}
      >
        <Icon name="image" size={24} color={colors.grey} />
      </View>
    );

  return (
    <Image
      source={{
        uri: imageUrl,
        ...(Platform.OS === 'android'
          ? {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
                Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
              },
            }
          : {}),
      }}
      {...imageProps}
    />
  );
}
