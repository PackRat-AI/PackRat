import { Icon, type MaterialIconName } from '@roninoss/icons';
import type { Pack as BasePack, PackItem as BasePackItem } from 'expo-app/features/packs/types';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

// Use the shared types from packs/types with some overrides for compatibility
type PackItem = Pick<BasePackItem, 'id' | 'name' | 'weight' | 'category'>;

interface Pack extends Omit<BasePack, 'items'> {
  items: PackItem[];
}

interface PackDetailsGenerativeUIProps {
  pack: Pack;
}

export function PackDetailsGenerativeUI({ pack }: PackDetailsGenerativeUIProps) {
  const formatWeight = (weight: number) => {
    if (weight === 0) return '0 g';
    if (weight < 1000) return `${weight} g`;
    return `${(weight / 1000).toFixed(1)} kg`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getCategoryIcon = (category: string): MaterialIconName => {
    switch (category.toLowerCase()) {
      case 'camping':
        return 'fire';
      case 'hiking':
        return 'map';
      case 'backpacking':
        return 'backpack';
      default:
        return 'backpack';
    }
  };

  const handlePackPress = () => {
    router.push(`/pack/${pack.id}`);
  };

  return (
    <Pressable
      onPress={handlePackPress}
      className="mx-4 my-2 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"
    >
      {/* Header Section */}
      <View className="border-b border-gray-100 p-4">
        <View className="mb-2 flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center">
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <Icon name={getCategoryIcon(pack.category)} size={20} color="#3B82F6" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-semibold text-gray-900" numberOfLines={1}>
                {pack.name}
              </Text>
              <Text className="text-sm capitalize text-gray-500">{pack.category}</Text>
            </View>
          </View>

          {pack.isPublic && (
            <View className="rounded-full bg-green-100 px-2 py-1">
              <Text className="text-xs font-medium text-green-700">Public</Text>
            </View>
          )}
        </View>

        {pack.description && (
          <Text className="mb-3 text-sm leading-5 text-gray-600">{pack.description}</Text>
        )}

        {/* Tags */}
        {pack.tags && pack.tags.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2 max-h-8">
            <View className="flex-row space-x-2">
              {pack.tags.map((tag) => (
                <View key={tag} className="rounded-full bg-gray-100 px-3 py-1">
                  <Text className="text-xs font-medium text-gray-700">#{tag}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Weight Information */}
      <View className="bg-gray-50 px-4 py-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
              Base Weight
            </Text>
            <Text className="text-lg font-semibold text-gray-900">
              {formatWeight(pack.baseWeight)}
            </Text>
          </View>

          <View className="mx-4 h-8 w-px bg-gray-200" />

          <View className="flex-1">
            <Text className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
              Total Weight
            </Text>
            <Text className="text-lg font-semibold text-gray-900">
              {formatWeight(pack.totalWeight)}
            </Text>
          </View>
        </View>
      </View>

      {/* Items Section */}
      <View className="p-4">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-sm font-medium text-gray-900">Items ({pack.items.length})</Text>
          <Icon name="chevron-right" size={16} color="#9CA3AF" />
        </View>

        {pack.items.length === 0 ? (
          <View className="items-center py-6">
            <Icon name="archive" size={32} color="#D1D5DB" />
            <Text className="mt-2 text-sm text-gray-500">No items added yet</Text>
          </View>
        ) : (
          <View className="space-y-2">
            {pack.items.slice(0, 3).map((item, _index) => (
              <View key={item.id} className="flex-row items-center py-2">
                <View className="mr-3 h-6 w-6 items-center justify-center rounded bg-gray-100">
                  <Icon name="archive" size={12} color="#6B7280" />
                </View>
                <Text className="flex-1 text-sm text-gray-900">{item.name}</Text>
                {item.weight && (
                  <Text className="text-xs text-gray-500">{formatWeight(item.weight)}</Text>
                )}
              </View>
            ))}

            {pack.items.length > 3 && (
              <View className="pt-2">
                <Text className="text-sm font-medium text-blue-600">
                  +{pack.items.length - 3} more items
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Footer with dates */}
      <View className="border-t border-gray-100 bg-gray-50 px-4 py-3">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-xs text-gray-500">Created</Text>
            <Text className="text-xs font-medium text-gray-700">
              {formatDate(pack.createdAt || pack.localCreatedAt)}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-xs text-gray-500">Updated</Text>
            <Text className="text-xs font-medium text-gray-700">
              {formatDate(pack.updatedAt || pack.localUpdatedAt)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
