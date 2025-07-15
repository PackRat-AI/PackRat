import { Icon, type MaterialIconName } from '@roninoss/icons';
import { CategoryBadge } from 'expo-app/components/initial/CategoryBadge';
import { WeightBadge } from 'expo-app/components/initial/WeightBadge';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import type { PackItem } from 'expo-app/features/packs';
import { cn } from 'expo-app/lib/cn';
import {
  calculateTotalWeight,
  getQuantity,
  isConsumable,
  isCatalogItem,
  isWorn,
  shouldShowQuantity,
} from 'expo-app/lib/utils/itemCalculations';
import { Image, Pressable, Text, View } from 'react-native';

type ItemCardProps = {
  item: CatalogItem | PackItem;
  onPress: (item: CatalogItem | PackItem) => void;
};

export function ItemCard({ item, onPress }: ItemCardProps) {
  // Get weight unit
  const weightUnit = (item as PackItem).weightUnit || (item as CatalogItem).defaultWeightUnit;

  // Use the utility functions
  const totalWeight = calculateTotalWeight(item);
  const quantity = getQuantity(item);
  const isItemConsumable = isConsumable(item);
  const showQuantity = shouldShowQuantity(item);
  const isItemWorn = isWorn(item);

  return (
    <Pressable
      className="mb-4 overflow-hidden rounded-xl bg-card shadow-sm"
      onPress={() => onPress(item)}
    >
      <View className="flex-row">
        {item.image ? (
          <Image source={{ uri: item.image }} className="h-24 w-24" resizeMode="cover" />
        ) : (
          <View className="h-24 w-24 items-center justify-center bg-muted">
            <Icon
              name={getCategoryIcon(item.category) as MaterialIconName}
              size={32}
              color="text-muted-foreground"
            />
          </View>
        )}

        <View className="flex-1 p-4">
          <View className="mb-1 flex-row flex-wrap items-center justify-between">
            <Text className="text-base font-semibold text-foreground">{item.name}</Text>
            <View
              className={cn(
                'rounded-full px-2 py-0.5',
                isCatalogItem(item) ? 'bg-primary/20' : 'bg-secondary/20',
              )}
            >
              <Text className="text-xs text-primary">
                {isCatalogItem(item) ? 'Pack Item' : 'Catalog Item'}
              </Text>
            </View>
          </View>

          <View className="mb-2 flex-row items-center">
            <CategoryBadge category={item.category} />
            {isItemConsumable && (
              <View className="ml-2 rounded-full bg-amber-100 px-2 py-0.5">
                <Text className="text-xs text-amber-800">Consumable</Text>
              </View>
            )}
            {isItemWorn && (
              <View className="ml-2 rounded-full bg-blue-100 px-2 py-0.5">
                <Text className="text-xs text-blue-800">Worn</Text>
              </View>
            )}
          </View>

          <View className="flex-row items-center justify-between">
            <WeightBadge weight={totalWeight} unit={weightUnit} type="total" />
            {showQuantity && <Text className="text-xs text-foreground">Qty: {quantity}</Text>}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// Helper function to get icon based on category
function getCategoryIcon(category: string): MaterialIconName {
  switch (category) {
    case 'clothing':
      return 'account-voice';
    case 'shelter':
      return 'home';
    case 'sleep':
      return 'sleep';
    case 'kitchen':
      return 'silverware-fork-knife';
    case 'water':
      return 'water';
    case 'electronics':
      return 'cellphone';
    case 'first-aid':
      return 'bandage';
    case 'navigation':
      return 'map';
    case 'tools':
      return 'wrench';
    case 'consumables':
      return 'apple';
    default:
      return 'square-outline';
  }
}
