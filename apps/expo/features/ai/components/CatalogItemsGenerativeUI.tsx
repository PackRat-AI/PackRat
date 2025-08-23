import { Button, Text } from '@packrat/ui/nativewindui';
import { Icon, type MaterialIconName } from '@roninoss/icons';
import type { CatalogItem as BaseCatalogItem } from 'expo-app/features/catalog/types';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, View } from 'react-native';

// Extend the base type to handle both API response formats
interface CatalogItem extends Omit<BaseCatalogItem, 'createdAt' | 'updatedAt'> {
  // Support both field names for backward compatibility
  defaultWeight?: number;
  defaultWeightUnit?: string;
  category?: string;
  // These are optional overrides
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

interface CatalogItemsGenerativeUIProps {
  items: CatalogItem[];
  total: number;
  limit: number;
}

const getCategoryIcon = (category: string): MaterialIconName => {
  const categoryMap: Record<string, MaterialIconName> = {
    // Cooking: 'flame',
    // Water: 'droplet',
    // 'Sleep System': 'moon',
    Shelter: 'home',
    Backpack: 'backpack',
    // Clothing: 'shirt',
    // Navigation: 'compass',
    // Safety: 'shield',
    // Tools: 'wrench',
  };
  return categoryMap[category] || 'archive';
};

const formatWeight = (weight: number | undefined, unit: string | undefined): string => {
  if (!weight || !unit) return 'N/A';
  if (unit === 'kg' && weight < 1) {
    return `${(weight * 1000).toFixed(0)}g`;
  }
  return `${weight}${unit}`;
};

const formatPrice = (
  price: number | null | undefined,
  currency: string | null | undefined,
): string => {
  if (!price) return 'N/A';
  const currencyCode = currency || 'USD';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
  }).format(price);
};

export function CatalogItemsGenerativeUI({ items }: CatalogItemsGenerativeUIProps) {
  const { colors } = useColorScheme();
  const router = useRouter();

  const handleItemPress = (catalogItem: CatalogItem) => {
    // Handle both field name formats
    const weight = catalogItem.defaultWeight ?? catalogItem.weight;
    const weightUnit = catalogItem.defaultWeightUnit ?? catalogItem.weightUnit;
    const weightStr = formatWeight(weight, weightUnit);
    const priceStr = formatPrice(catalogItem.price, catalogItem.currency);

    Alert.alert(
      catalogItem.name,
      `${catalogItem.description || 'No description'}\n\nPrice: ${priceStr}\nWeight: ${weightStr}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'View Details',
          onPress: () =>
            router.push({
              pathname: '/catalog/[id]',
              params: { id: catalogItem.id },
            }),
        },
        {
          text: 'Add to Pack',
          onPress: () => handleAddToPack(catalogItem),
        },
      ],
    );
  };

  const handleAddToPack = (item: CatalogItem) => {
    router.push({
      pathname: '/catalog/add-to-pack',
      params: { catalogItemId: item.id },
    });
  };

  return (
    <View className="my-2 overflow-hidden rounded-2xl border border-border bg-card">
      {/* Header */}
      <View className="bg-muted/30 border-b border-border px-4 py-3">
        <View className="flex-row items-center gap-2">
          <Icon name="clipboard-list" size={16} color={colors.foreground} />
          <Text className="text-sm text-foreground" color="secondary">
            Catalog Gears
          </Text>
        </View>
      </View>

      {/* Items List */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
        className="max-h-80"
      >
        <View className="flex-row gap-3">
          {items.map((item, _index) => (
            <Pressable
              key={item.id}
              onPress={() => handleItemPress(item)}
              className="w-72 rounded-xl border border-border bg-background p-4 active:opacity-70"
            >
              {/* Item Header */}
              <View className="mb-3 flex-row items-start justify-between">
                <View className="mr-3 flex-1">
                  <View className="mb-1 flex-row items-center gap-2">
                    <Icon
                      name={getCategoryIcon(item.category || item.categories?.[0] || '')}
                      size={16}
                      color={colors.primary}
                    />
                    <Text className="text-xs font-medium uppercase tracking-wide text-primary">
                      {item.category || item.categories?.[0] || 'General'}
                    </Text>
                  </View>
                  <Text className="text-base font-semibold leading-tight text-foreground">
                    {item.name}
                  </Text>
                  <Text className="mt-1 text-sm text-muted-foreground">
                    {item.brand} {item.model}
                  </Text>
                </View>

                {/* Rating */}
                <View className="bg-muted/50 flex-row items-center gap-1 rounded-full px-2 py-1">
                  <Icon name="star" size={12} color="#FFD700" />
                  <Text className="text-xs font-medium text-foreground">
                    {item.ratingValue || 'N/A'}
                  </Text>
                </View>
              </View>

              {/* Description */}
              <Text className="mb-3 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </Text>

              {/* Specs */}
              <View className="mb-4">
                <View className="flex-row flex-wrap gap-2">
                  <View className="bg-muted/30 rounded-md px-2 py-1">
                    <Text className="text-xs text-foreground">
                      {formatWeight(
                        item.defaultWeight ?? item.weight,
                        item.defaultWeightUnit ?? item.weightUnit,
                      )}
                    </Text>
                  </View>
                  {item.material && (
                    <View className="bg-muted/30 rounded-md px-2 py-1">
                      <Text className="text-xs text-foreground">{item.material}</Text>
                    </View>
                  )}
                  {item.techs &&
                    Object.entries(item.techs)
                      .slice(0, 2)
                      .map(([key, value]) => (
                        <View key={key} className="bg-muted/30 rounded-md px-2 py-1">
                          <Text className="text-xs text-foreground">
                            {key}: {value}
                          </Text>
                        </View>
                      ))}
                </View>
              </View>

              {/* Price and Actions */}
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-bold text-foreground">
                  {formatPrice(item.price, item.currency)}
                </Text>

                <Button size="sm" onPress={() => handleAddToPack(item)} className="ml-auto px-3">
                  <Icon name="plus" size={14} color="white" />
                </Button>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
