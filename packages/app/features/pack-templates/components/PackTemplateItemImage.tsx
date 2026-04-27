import { useColorScheme } from '@packrat/ui/nativewindui';
import { Icon } from 'app/components/Icon';
import { CatalogItemImage } from 'app/features/catalog/components/CatalogItemImage';
import { CachedImage } from 'app/features/packs/components/CachedImage';
import { buildImageUrl } from 'app/lib/utils/buildImageUrl';
import { type ImageProps, View } from 'react-native';
import type { PackTemplateItem } from '../types';

interface PackTemplateItemImageProps extends Omit<ImageProps, 'source'> {
  item: PackTemplateItem;
}

export function PackTemplateItemImage({ item, ...imageProps }: PackTemplateItemImageProps) {
  const { colors } = useColorScheme();

  if (!item.image)
    return (
      <View
        className={`items-center justify-center bg-neutral-300 dark:bg-neutral-600 ${imageProps.className}`}
      >
        <Icon name="image" size={24} color={colors.grey} />
      </View>
    );

  if (item.catalogItemId) {
    return <CatalogItemImage imageUrl={item.image} {...imageProps} />;
  }

  const imageUrl = buildImageUrl(item);

  return <CachedImage imageObjectKey={item.image} imageRemoteUrl={imageUrl} {...imageProps} />;
}
