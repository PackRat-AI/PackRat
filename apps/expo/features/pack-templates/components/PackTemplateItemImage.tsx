import { useColorScheme } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { CachedImage } from 'expo-app/features/packs/components/CachedImage';
import { buildImageUrl } from 'expo-app/lib/utils/buildImageUrl';
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

  const imageUrl = buildImageUrl(item);

  return <CachedImage imageObjectKey={item.image} imageRemoteUrl={imageUrl} {...imageProps} />;
}
