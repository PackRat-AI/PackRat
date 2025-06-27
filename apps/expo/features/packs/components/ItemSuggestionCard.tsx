import { Icon } from '@roninoss/icons';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/useColorScheme';
import ImageCacheManager from 'expo-app/lib/utils/ImageCacheManager';
import { getImageExtension } from 'expo-app/lib/utils/imageUtils';
import type { CatalogItem } from 'expo-app/types';
import { nanoid } from 'nanoid/non-secure';
import { ActivityIndicator } from 'nativewindui/ActivityIndicator';
import { Button } from 'nativewindui/Button';
import { Text } from 'nativewindui/Text';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { useCreatePackItem } from '../hooks';
import type { PackItemInput } from '../types';

interface ItemSuggestionCardProps {
  packId: string;
  item: CatalogItem;
}

export function ItemSuggestionCard({ packId, item }: ItemSuggestionCardProps) {
  const [isAdding, setIsAdding] = useState(false);

  const createItem = useCreatePackItem();
  const { colors } = useColorScheme();

  const handleAddItem = async (item: Omit<CatalogItem, 'image'> & { image: string | null }) => {
    setIsAdding(true);
    if (item.image) {
      try {
        const extension = await getImageExtension(item.image);
        const fileName = `${nanoid()}.${extension}`;
        console.log('item.image', item.image);
        await ImageCacheManager.cacheRemoteImage(fileName, item.image);
        item.image = fileName;
      } catch (err) {
        console.log('caching remote image failed', err);
        item.image = null;
      }
    } else {
      item.image = null;
    }
    // Create a new pack item from the catalog item
    const newItem: PackItemInput = {
      name: item.name,
      description: item.description || '',
      weight: item.defaultWeight || 0,
      weightUnit: item.defaultWeightUnit || 'oz',
      quantity: 1,
      category: item.category || 'Uncategorized',
      consumable: false,
      worn: false,
      image: item.image,
      notes: 'Suggested by PackRat AI',
      catalogItemId: item.id,
    };

    createItem({
      packId,
      itemData: newItem,
    });
    setIsAdding(false);
  };

  return (
    <View
      className={cn(
        'mr-2 flex-col justify-between rounded-lg border border-border p-3',
        'w-40 bg-card',
      )}
    >
      <View>
        <Text className="mb-1 font-medium text-foreground" numberOfLines={1}>
          {item.name}
        </Text>
        <Text className="mb-2 text-xs text-muted-foreground" numberOfLines={2}>
          {item.description}
        </Text>
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-muted-foreground">
          {item.defaultWeight}
          {item.weightUnit}
        </Text>
        <Button disabled={isAdding} onPress={() => handleAddItem(item)} variant="tonal" size="icon">
          {isAdding ? (
            <ActivityIndicator />
          ) : (
            <Icon
              name="plus"
              color={Platform.OS === 'ios' ? colors.primary : colors.foreground}
              size={21}
            />
          )}
        </Button>
      </View>
    </View>
  );
}
