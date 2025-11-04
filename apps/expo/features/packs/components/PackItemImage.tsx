import { useColorScheme } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { CatalogItemImage } from 'expo-app/features/catalog/components/CatalogItemImage';
import { buildImageUrl } from 'expo-app/lib/utils/buildImageUrl';
import { Image, type ImageProps, View } from 'react-native';
import { usePackItemOwnershipCheck } from '../hooks';
import type { PackItem } from '../types';
import { CachedImage } from './CachedImage';

interface PackItemImageProps extends Omit<ImageProps, 'source'> {
  item: PackItem;
}

export function PackItemImage({ item, ...imageProps }: PackItemImageProps) {
  const isItemOwnedByUser = usePackItemOwnershipCheck(item.id);
  const { colors } = useColorScheme();

  if (item.isAIGenerated) {
    return <CatalogItemImage imageUrl={item.image} {...imageProps} />;
  }

  if (!item.image)
    return (
      <View
        className={`items-center justify-center bg-neutral-300 dark:bg-neutral-600 ${imageProps.className}`}
      >
        <Icon name="image" size={24} color={colors.grey} />
      </View>
    );

  const imageUrl = buildImageUrl(item);

  if (isItemOwnedByUser) {
    return <CachedImage imageObjectKey={item.image} imageRemoteUrl={imageUrl} {...imageProps} />;
  } else {
    return <Image source={{ uri: imageUrl }} {...imageProps} />;
  }
}
