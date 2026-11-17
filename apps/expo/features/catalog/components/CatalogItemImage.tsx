import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { Image, type ImageProps, View } from 'react-native';

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
        headers: {
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
          Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
        },
      }}
      // Decode at the view's size, not the source's: retailer photos run to several thousand
      // pixels and full-size bitmaps exhaust memory on Android.
      resizeMethod="resize"
      {...imageProps}
      className={`bg-muted ${imageProps.className}`}
    />
  );
}
