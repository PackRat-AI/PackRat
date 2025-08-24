import { Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import type { PackItem as BasePackItem } from 'expo-app/features/packs/types';
import { View } from 'react-native';

interface PackItem extends BasePackItem {
  templateItemId?: string | null;
  pack?: {
    id: string;
    name: string;
    description: string;
    category: string;
    userId: number;
    templateId: string | null;
    isPublic: boolean;
    image: string | null;
    tags: string[];
    deleted: boolean;
    localCreatedAt: string;
    localUpdatedAt: string;
    createdAt: string;
    updatedAt: string;
  };
  catalogItem?: CatalogItem | null;
}

interface PackItemDetailsGenerativeUIProps {
  item: PackItem;
}

export function PackItemDetailsGenerativeUI({ item }: PackItemDetailsGenerativeUIProps) {
  const getCategoryIcon = (category: string) => {
    const categoryLower = category.toLowerCase().trim();
    switch (categoryLower) {
      case 'shelter':
        return 'home';

      case 'clothing':
        return 'account-circle';

      case 'cooking':
        return 'fire';

      case 'electronics':
        return 'cellphone';

      case 'first-aid':
        return 'plus';

      case 'tools':
        return 'hammer';

      case 'food':
        return 'apple';

      case 'water':
        return 'circle';

      default:
        return 'archive';
    }
  };

  const formatWeight = (weight: number, unit: string) => {
    if (weight === 0) return 'No weight specified';
    return `${weight}${unit}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <View className="mx-4 my-2 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      {/* Header */}
      <View className="border-b border-gray-100 bg-gray-50 px-4 py-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center">
            <View className="mr-3 h-8 w-8 items-center justify-center rounded-full bg-blue-100">
              <Icon name={getCategoryIcon(item.category)} size={16} color="#3B82F6" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-semibold text-gray-900" numberOfLines={1}>
                {item.name}
              </Text>
              <Text className="text-sm capitalize text-gray-500">{item.category}</Text>
            </View>
          </View>
          <View className="items-end">
            <Text className="text-lg font-bold text-gray-900">
              {formatWeight(item.weight, item.weightUnit)}
            </Text>
            <Text className="text-sm text-gray-500">Qty: {item.quantity}</Text>
          </View>
        </View>
        <View className="mt-2 flex-row items-center gap-2">
          {item.consumable && (
            <View className="rounded-full bg-orange-100 px-2 py-1">
              <Text className="text-xs font-medium text-orange-700">Consumable</Text>
            </View>
          )}
          {item.worn && (
            <View className="rounded-full bg-purple-100 px-2 py-1">
              <Text className="text-xs font-medium text-purple-700">Worn</Text>
            </View>
          )}
        </View>
      </View>

      {/* Content */}
      <View className="space-y-4 p-4">
        {/* Description */}
        {item.description && (
          <View>
            <Text className="text-sm leading-5 text-gray-600" numberOfLines={2}>
              {item.description}
            </Text>
          </View>
        )}

        {/* Notes */}
        {item.notes && (
          <View className="mb-4">
            <Text className="mb-1 text-sm font-medium text-gray-500">Notes</Text>
            <View className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
              <Text className="text-sm text-gray-700" numberOfLines={2}>
                {item.notes}
              </Text>
            </View>
          </View>
        )}

        {/* Metadata */}
        <View className="mt-3 border-t border-gray-100 pt-3">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xs text-gray-400">Created</Text>
              <Text className="text-xs text-gray-600">{formatDate(String(item.createdAt))}</Text>
            </View>
            <View>
              <Text className="text-xs text-gray-400">Updated</Text>
              <Text className="text-xs text-gray-600">{formatDate(String(item.updatedAt))}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
