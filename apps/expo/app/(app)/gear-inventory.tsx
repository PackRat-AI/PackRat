import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, View } from 'react-native'; // 👈 import ActivityIndicator

import { LargeTitleHeader } from 'nativewindui/LargeTitleHeader';
import { Text } from 'nativewindui/Text';
import { PackItemCard } from '~/features/packs/components/PackItemCard';
import { useUserPackItems } from '~/features/packs/hooks/useUserPackItems';
import type { PackItem } from '~/features/packs/types';
import { cn } from '~/lib/cn';

function CategorySection({ category, items }: { category: string; items: PackItem[] }) {
  return (
    <View className="mb-4">
      <View className="bg-primary/10 px-4 py-2">
        <Text variant="subhead" className="font-semibold">
          {category} ({items.length})
        </Text>
      </View>
      <View className="mt-3">
        {items.map((item) => (
          <PackItemCard key={item.id} item={item} onPress={() => {}} />
        ))}
      </View>
    </View>
  );
}

export default function GearInventoryScreen() {
  const [viewMode, setViewMode] = useState<'all' | 'category'>('all');
  const items = useUserPackItems();

  const groupByCategory = (items: PackItem[]) => {
    return items.reduce(
      (acc, item) => {
        const category = item.category || 'Other';

        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(item);
        return acc;
      },
      {} as Record<string, PackItem[]>
    );
  };

  const itemsByCategory = groupByCategory(items);

  return (
    <SafeAreaView className="flex-1">
      <LargeTitleHeader title="Gear Inventory" />
      <ScrollView className="flex-1">
        <View className="flex-row items-center justify-between p-4">
          <Text variant="subhead" className="text-muted-foreground">
            {items?.length} items in your inventory
          </Text>
          <View className="flex-row overflow-hidden rounded-lg bg-card">
            <Pressable
              className={cn('px-3 py-1.5', viewMode === 'all' ? 'bg-primary' : 'bg-transparent')}
              onPress={() => setViewMode('all')}
            >
              <Text
                variant="subhead"
                className={viewMode === 'all' ? 'text-primary-foreground' : 'text-muted-foreground'}
              >
                All
              </Text>
            </Pressable>
            <Pressable
              className={cn(
                'px-3 py-1.5',
                viewMode === 'category' ? 'bg-primary' : 'bg-transparent'
              )}
              onPress={() => setViewMode('category')}
            >
              <Text
                variant="subhead"
                className={
                  viewMode === 'category' ? 'text-primary-foreground' : 'text-muted-foreground'
                }
              >
                By Category
              </Text>
            </Pressable>
          </View>
        </View>

        {viewMode === 'all' ? (
          <View className=" flex-1 pb-20">
            {items.map((item) => (
              <PackItemCard key={item.id} item={item} onPress={() => {}} />
            ))}
          </View>
        ) : (
          <View className="pb-4">
            {Object.entries(itemsByCategory).map(([category, groupedItems]) => (
              <CategorySection key={category} category={category} items={groupedItems} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
