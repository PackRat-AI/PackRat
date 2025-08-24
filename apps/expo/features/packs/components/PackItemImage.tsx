import { Text } from '@packrat-ai/nativewindui';
import { buildPackItemImageUrl } from 'expo-app/lib/utils/buildPackItemImageUrl';
import { Image, type ImageProps, View } from 'react-native';
import { usePackItemOwnershipCheck } from '../hooks';
import type { PackItem } from '../types';
import { CachedImage } from './CachedImage';

interface PackItemImageProps extends Omit<ImageProps, 'source'> {
  item: PackItem;
}

export function PackItemImage({ item, ...imageProps }: PackItemImageProps) {
  const isItemOwnedByUser = usePackItemOwnershipCheck(item.id);

  if (!item.image)
    return (
      <View className={`items-center justify-center bg-muted px-2 ${imageProps.className}`}>
        <Text className="text-muted-foreground">No image</Text>
      </View>
    );

  const imageUrl = buildPackItemImageUrl(item);

  if (isItemOwnedByUser) {
    return <CachedImage imageObjectKey={item.image} imageRemoteUrl={imageUrl} {...imageProps} />;
  } else {
    return <Image source={{ uri: imageUrl }} {...imageProps} />;
  }
}
