import { ActivityIndicator, Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { cacheCatalogItemImage } from 'expo-app/features/catalog/lib/cacheCatalogItemImage';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
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
          {item.weight}
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
