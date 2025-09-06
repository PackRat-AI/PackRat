import { ActivityIndicator, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { CatalogItemImage } from 'expo-app/features/catalog/components/CatalogItemImage';
import { cacheCatalogItemImage } from 'expo-app/features/catalog/lib/cacheCatalogItemImage';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useCreatePackItem } from '../hooks';
import type { Pack, PackItemInput } from '../types';

interface ItemSuggestionCardProps {
  pack: Pack;
  item: CatalogItem;
}

export function ItemSuggestionCard({ pack, item }: ItemSuggestionCardProps) {
  const [isAdding, setIsAdding] = useState(false);

  const isAdded = pack.items.some((packItem) => packItem.catalogItemId === item.id);

  const createItem = useCreatePackItem();
  const { colors } = useColorScheme();

  const handleAddItem = async (item: CatalogItem) => {
    setIsAdding(true);
    const cachedImageFilename = await cacheCatalogItemImage(item.images?.[0]);

    // Create a new pack item from the catalog item
    const newItem: PackItemInput = {
      name: item.name,
      description: item.description || '',
      weight: item.weight || 0,
      weightUnit: item.weightUnit || 'oz',
      quantity: 1,
      consumable: false,
      worn: false,
      image: cachedImageFilename,
      notes: 'Suggested by PackRat AI',
      catalogItemId: item.id,
    };

    createItem({
      packId: pack.id,
      itemData: newItem,
    });
    setIsAdding(false);
  };

  return (
    <View className="flex-row gap-2 rounded-lg border border-border p-2 w-80 bg-card">
      <CatalogItemImage
        imageUrl={item.images?.[0]}
        className="w-20 h-16 rounded-lg border border-neutral-200 dark:border-neutral-700"
        resizeMode="cover"
      />
      <View className="flex-1">
        <Text className="text-foreground text-base mb-1" variant="title3" numberOfLines={1}>
          {item.name}
        </Text>
        <View className="flex-row items-center justify-between px-2">
          <View className="flex-row items-center gap-1">
            <View className="flex-row items-center">
              <Icon name="dumbbell" size={14} color={colors.grey} />
              <Text className="ml-1 text-xs text-muted-foreground">
                {item.weight ?? 0} {item.weightUnit ?? 'g'}
              </Text>
            </View>
            {item.categories && item.categories.length > 0 && (
              <>
                <Text variant="callout" className="font-extrabold text-xl">
                  ·
                </Text>
                <Text variant="callout" className="text-muted-foreground">
                  {item.categories[item.categories.length - 1]}
                </Text>
              </>
            )}
          </View>
          <Pressable
            disabled={isAdded || isAdding}
            className={cn(
              'rounded-full px-2 py-1',
              isAdding ? 'bg-muted' : isAdded ? 'border border-border' : 'bg-secondary',
            )}
            onPress={() => handleAddItem(item)}
          >
            {isAdded ? (
              <Text variant="footnote" className="text-xs">
                Added
              </Text>
            ) : isAdding ? (
              <ActivityIndicator size={16} color={colors.grey3} />
            ) : (
              <Text variant="footnote" className="text-xs">
                Add
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
