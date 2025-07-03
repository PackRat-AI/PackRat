import { Icon } from '@roninoss/icons';
import { ScrollView, Text, View } from 'react-native';
import { cn } from '~/lib/cn';
import { useColorScheme } from '~/lib/hooks/useColorScheme';
import type { WeightUnit } from '~/types';
import { CachedImage } from './CachedImage';

export interface PackTemplateItem {
  id: string;
  packTemplateId: string;
  name: string;
  description?: string;
  weight: number;
  weightUnit: WeightUnit;
  quantity: number;
  category?: string;
  consumable: boolean;
  worn: boolean;
  image?: string | null;
  notes?: string;
  catalogItemId?: number;
  userId?: number;
  deleted: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface TemplateItemsSectionProps {
  templateItems: PackTemplateItem[];
  templateName?: string;
}

// Helper function to format weight
const formatWeight = (weight: number, unit: string) => {
  if (weight < 1 && unit === 'kg') {
    return `${(weight * 1000).toFixed(0)}g`;
  }
  if (weight < 1 && unit === 'lb') {
    return `${(weight * 16).toFixed(1)}oz`;
  }
  return `${weight}${unit}`;
};

// Template Item Card Component
const TemplateItemCard = ({ item }: { item: PackTemplateItem }) => {
  const { colors } = useColorScheme();

  return (
    <View className="mr-3 w-48 rounded-xl border border-border bg-card p-4 shadow-sm">
      <View className="mb-3 h-20 w-full overflow-hidden rounded-lg bg-muted">
        <CachedImage localFileName={item.image} className="h-full w-full" resizeMode="cover" />
      </View>

      {/* Item name */}
      <Text className="mb-2 text-sm font-semibold text-foreground" numberOfLines={2}>
        {item.name}
      </Text>

      {/* Description */}
      <Text
        className={cn('mb-3 text-xs text-muted-foreground', !item.description && 'italic')}
        numberOfLines={2}
      >
        {item.description || 'No description'}
      </Text>

      {/* Weight and quantity */}
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Icon name="dumbbell" size={12} color={colors.grey2} />
          <Text className="ml-1 text-xs font-medium text-foreground">
            {formatWeight(item.weight, item.weightUnit)}
          </Text>
        </View>
        <View className="flex-row items-center">
          <Icon name="format-list-bulleted" size={12} color={colors.grey2} />
          <Text className="ml-1 text-xs font-medium text-foreground">{item.quantity}</Text>
        </View>
      </View>
      <View className="flex-row">
        {item.worn && (
          <View className="mr-1 rounded-full bg-blue-100 px-2 py-0.5">
            <Text className="text-xs font-medium text-blue-700">Worn</Text>
          </View>
        )}
        {item.consumable && (
          <View className="rounded-full bg-orange-100 px-2 py-0.5">
            <Text className="text-xs font-medium text-orange-700">Consumable</Text>
          </View>
        )}
      </View>
    </View>
  );
};

export const TemplateItemsSection = ({
  templateItems,
  templateName,
}: TemplateItemsSectionProps) => {
  // Calculate total weight and item count for template
  const templateStats = templateItems.reduce(
    (acc, item) => ({
      totalWeight: acc.totalWeight + item.weight * item.quantity,
      totalItems: acc.totalItems + item.quantity,
      categories: acc.categories.add(item.category || 'uncategorized'),
    }),
    { totalWeight: 0, totalItems: 0, categories: new Set<string>() },
  );

  if (templateItems.length === 0) {
    return null;
  }

  return (
    <View className="my-6">
      <View className="mb-4">
        <Text className="text-lg font-bold text-foreground">Items</Text>
        <Text className="text-sm text-muted-foreground">
          {templateStats.totalItems} items • {formatWeight(templateStats.totalWeight, 'kg')} •{' '}
          {templateStats.categories.size} categories
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 32 }}
        className="mb-4"
      >
        {templateItems.map((item) => (
          <TemplateItemCard key={item.id} item={item} />
        ))}
      </ScrollView>
    </View>
  );
};
