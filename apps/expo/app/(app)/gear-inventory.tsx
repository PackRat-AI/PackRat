import { assertDefined } from '@packrat/guards';
import { LargeTitleHeader, Text } from '@packrat/ui/nativewindui';
import { PackItemCard } from 'expo-app/features/packs/components/PackItemCard';
import { useUserPackItems } from 'expo-app/features/packs/hooks/useUserPackItems';
import type { PackItem } from 'expo-app/features/packs/types';
import { cn } from 'expo-app/lib/cn';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function CategorySection({
  category,
  items,
  onItemPress,
}: {
  category: string;
  items: PackItem[];
  onItemPress: (item: PackItem) => void;
}) {
  return (
    <View className="mb-4">
      <View className="bg-primary/10 px-4 py-2">
        <Text variant="subhead" className="font-semibold">
          {category} ({items.length})
        </Text>
      </View>
      <View className="mt-3">
        {items.map((item) => (
          <PackItemCard key={item.id} item={item} onPress={onItemPress} />
        ))}
      </View>
    </View>
  );
}

export default function GearInventoryScreen() {
  const [viewMode, setViewMode] = useState<'all' | 'category'>('all');
  const items = useUserPackItems();
  const router = useRouter();

  const handleItemPress = (item: PackItem) => {
    router.push({
      pathname: '/item/[id]',
      params: { id: item.id, packId: item.packId },
    });
  };
  const { t } = useTranslation();

  const groupByCategory = (items: PackItem[]) => {
    return items.reduce<Record<string, PackItem[]>>((acc, item) => {
      const category = item.category || 'Other';

      if (!acc[category]) {
        acc[category] = [];
      }
      assertDefined(acc[category]);
      acc[category].push(item);
      return acc;
    }, {});
  };

  const itemsByCategory = groupByCategory(items);

  return (
    <SafeAreaView className="flex-1" edges={['bottom']}>
      <LargeTitleHeader title={t('packs.gearInventory')} />
      <ScrollView className="flex-1 px-4" contentInsetAdjustmentBehavior="automatic">
        <View className="flex-row items-center justify-between p-4">
          <Text variant="subhead" className="text-muted-foreground">
            {t('packs.itemsInInventory', { count: items?.length })}
          </Text>
          <View className="flex-row rounded-lg bg-card">
            <Pressable
              className={cn(
                'rounded-l-lg px-3 py-1.5',
                viewMode === 'all' ? 'bg-primary' : 'bg-transparent',
              )}
              onPress={() => setViewMode('all')}
            >
              <Text
                variant="subhead"
                className={viewMode === 'all' ? 'text-primary-foreground' : 'text-muted-foreground'}
              >
                {t('packs.all')}
              </Text>
            </Pressable>
            <Pressable
              className={cn(
                'rounded-r-lg px-3 py-1.5',
                viewMode === 'category' ? 'bg-primary' : 'bg-transparent',
              )}
              onPress={() => setViewMode('category')}
            >
              <Text
                variant="subhead"
                className={
                  viewMode === 'category' ? 'text-primary-foreground' : 'text-muted-foreground'
                }
              >
                {t('packs.byCategory')}
              </Text>
            </Pressable>
          </View>
        </View>

        {viewMode === 'all' ? (
          <View className=" flex-1 pb-20">
            {items.map((item) => (
              <PackItemCard key={item.id} item={item} onPress={handleItemPress} />
            ))}
          </View>
        ) : (
          <View className="pb-4">
            {Object.entries(itemsByCategory).map(([category, groupedItems]) => (
              <CategorySection
                key={category}
                category={category}
                items={groupedItems}
                onItemPress={handleItemPress}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
