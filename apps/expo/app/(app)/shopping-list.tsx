'use client';

import { Icon } from '@roninoss/icons';
import { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';

import { LargeTitleHeader } from 'nativewindui/LargeTitleHeader';
import { Text } from 'nativewindui/Text';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/useColorScheme';

// Mock data for shopping list
const SHOPPING_LIST = [
  {
    id: '1',
    name: 'Ultralight Rain Pants',
    priority: 'High',
    estimatedCost: '$89',
    notes: 'Need for upcoming trip, looking at Outdoor Research Helium',
    category: 'Clothing',
    purchased: false,
  },
  {
    id: '2',
    name: 'Titanium Stakes (6)',
    priority: 'Medium',
    estimatedCost: '$24',
    notes: 'Replace bent aluminum stakes',
    category: 'Shelter',
    purchased: false,
  },
  {
    id: '3',
    name: 'Fuel Canister',
    priority: 'High',
    estimatedCost: '$8',
    notes: 'Need for next weekend trip',
    category: 'Cooking',
    purchased: false,
  },
  {
    id: '4',
    name: 'Merino Wool Socks',
    priority: 'Medium',
    estimatedCost: '$18',
    notes: 'Darn Tough preferred',
    category: 'Clothing',
    purchased: false,
  },
  {
    id: '5',
    name: 'Trekking Pole Tip Protectors',
    priority: 'Low',
    estimatedCost: '$6',
    notes: 'For travel and storage',
    category: 'Accessories',
    purchased: false,
  },
  {
    id: '6',
    name: 'Backpack Rain Cover',
    priority: 'Medium',
    estimatedCost: '$35',
    notes: 'Size medium for 50L pack',
    category: 'Accessories',
    purchased: true,
  },
  {
    id: '7',
    name: 'Rechargeable Headlamp',
    priority: 'High',
    estimatedCost: '$45',
    notes: 'Black Diamond or Petzl',
    category: 'Electronics',
    purchased: true,
  },
];

function PriorityBadge({ priority }: { priority: string }) {
  const getColor = () => {
    switch (priority) {
      case 'High':
        return 'bg-red-500';
      case 'Medium':
        return 'bg-amber-500';
      case 'Low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <View className={cn('rounded-full px-2 py-1', getColor())}>
      <Text variant="caption2" className="font-medium text-white">
        {priority}
      </Text>
    </View>
  );
}

function ShoppingItemCard({ item }: { item: (typeof SHOPPING_LIST)[0] }) {
  const { colors } = useColorScheme();

  return (
    <View
      className={cn(
        'mx-4 mb-3 overflow-hidden rounded-xl bg-card shadow-sm',
        item.purchased && 'opacity-60',
      )}
    >
      <View className="p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text variant="heading" className="font-semibold">
              {item.name}
            </Text>
            <Text variant="subhead" className="text-muted-foreground">
              {item.category} • {item.estimatedCost}
            </Text>
          </View>
          <PriorityBadge priority={item.priority} />
        </View>

        {item.notes && (
          <View className="mt-3 rounded-md bg-muted p-3 dark:bg-gray-50/10">
            <Text variant="footnote">{item.notes}</Text>
          </View>
        )}

        {item.purchased && (
          <View className="mt-3 flex-row items-center gap-1">
            <Icon name="check-circle" size={16} color={colors.green} />
            <Text variant="footnote" className="text-green-500">
              Purchased
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function ShoppingListScreen() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'purchased'>('pending');

  const filteredItems = SHOPPING_LIST.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return !item.purchased;
    if (filter === 'purchased') return item.purchased;
    return true;
  });

  return (
    <>
      <LargeTitleHeader title="Shopping List" />
      <ScrollView className="flex-1">
        <View className="p-4">
          <View className="mb-4 flex-row items-center justify-between">
            <Text variant="subhead" className="text-muted-foreground">
              {SHOPPING_LIST.filter((item) => !item.purchased).length} items to purchase
            </Text>
            <View className="flex-row overflow-hidden rounded-lg bg-card">
              <Pressable
                className={cn(
                  'px-3 py-1.5',
                  filter === 'pending' ? 'bg-primary' : 'bg-transparent',
                )}
                onPress={() => setFilter('pending')}
              >
                <Text
                  variant="subhead"
                  className={
                    filter === 'pending' ? 'text-primary-foreground' : 'text-muted-foreground'
                  }
                >
                  To Buy
                </Text>
              </Pressable>
              <Pressable
                className={cn(
                  'px-3 py-1.5',
                  filter === 'purchased' ? 'bg-primary' : 'bg-transparent',
                )}
                onPress={() => setFilter('purchased')}
              >
                <Text
                  variant="subhead"
                  className={
                    filter === 'purchased' ? 'text-primary-foreground' : 'text-muted-foreground'
                  }
                >
                  Purchased
                </Text>
              </Pressable>
              <Pressable
                className={cn('px-3 py-1.5', filter === 'all' ? 'bg-primary' : 'bg-transparent')}
                onPress={() => setFilter('all')}
              >
                <Text
                  variant="subhead"
                  className={filter === 'all' ? 'text-primary-foreground' : 'text-muted-foreground'}
                >
                  All
                </Text>
              </Pressable>
            </View>
          </View>

          <View className="mb-4 rounded-lg bg-card">
            <Text variant="heading" className="p-4 font-semibold">
              Estimated Total: $225
            </Text>
          </View>
        </View>

        <View className="pb-4">
          {filteredItems.map((item) => (
            <ShoppingItemCard key={item.id} item={item} />
          ))}
        </View>

        <View className="mx-4 my-2 mb-6 rounded-lg bg-card p-4">
          <Text variant="heading" className="mb-2 font-semibold">
            Shopping Tips
          </Text>
          <Text variant="body" className="mb-2">
            • Check for seasonal sales at REI, Backcountry, and other outdoor retailers
          </Text>
          <Text variant="body" className="mb-2">
            • Consider used gear from r/ULgeartrade or Gear Trade for better deals
          </Text>
          <Text variant="body">• Compare prices across multiple retailers before purchasing</Text>
        </View>
      </ScrollView>
    </>
  );
}
