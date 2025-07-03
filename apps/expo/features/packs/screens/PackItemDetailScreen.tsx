import { Icon } from '@roninoss/icons';
import { Chip } from 'expo-app/components/initial/Chip';
import { WeightBadge } from 'expo-app/components/initial/WeightBadge';
import { ActivityIndicator } from 'expo-app/components/nativewindui/ActivityIndicator';
import { Button } from 'expo-app/components/nativewindui/Button';
import { isAuthed } from 'expo-app/features/auth/store';
import { CachedImage } from 'expo-app/features/packs/components/CachedImage';
import {
  calculateTotalWeight,
  getNotes,
  getQuantity,
  hasNotes,
  isConsumable,
  isWorn,
  shouldShowQuantity,
} from 'expo-app/lib/utils/itemCalculations';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import {
  usePackItemDetailsFromApi,
  usePackItemDetailsFromStore,
  usePackItemOwnershipCheck,
} from '../hooks';
import type { PackItem } from '../types';

export function ItemDetailScreen() {
  const { id } = useLocalSearchParams();
  const isOwnedByUser = usePackItemOwnershipCheck(id as string);

  const itemFromStore = usePackItemDetailsFromStore(id as string); // Using user owned item from store to ensure component updates when user modifies it
  const {
    item: itemFromApi,
    isLoading,
    isError,
    error,
    refetch,
  } = usePackItemDetailsFromApi({
    id: id as string,
    enabled: !isOwnedByUser,
  }); // Fetch non user owned items from api

  const item = (isOwnedByUser ? itemFromStore : itemFromApi) as PackItem;

  // Loading state for non-owned items
  if (!isOwnedByUser && isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-4">
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  // Error state for non-owned packs
  if (!isOwnedByUser && isError) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-8">
          <View className="bg-destructive/10 mb-4 rounded-full p-4">
            <Icon name="exclamation" size={32} color="text-destructive" />
          </View>
          <Text className="mb-2 text-lg font-medium text-foreground">
            Failed to load item details
          </Text>
          <Text className="mb-6 text-center text-muted-foreground">
            {error?.message || 'Something went wrong. Please try again.'}
          </Text>
          <View className="flex-row justify-center gap-2">
            <Button variant="primary" onPress={() => refetch()}>
              <Text>Try Again</Text>
            </Button>
            <Button variant="secondary" onPress={router.back}>
              <Text>Go Back</Text>
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Get weight unit
  const weightUnit = item?.weightUnit;

  // Use the utility functions
  const totalWeight = calculateTotalWeight(item);
  const quantity = getQuantity(item);
  const isItemConsumable = isConsumable(item);
  const showQuantity = shouldShowQuantity(item);
  const isItemWorn = isWorn(item);
  const itemHasNotes = hasNotes(item);
  const itemNotes = getNotes(item);

  const navigateToChat = () => {
    if (!isAuthed.peek()) {
      return router.push({
        pathname: '/auth',
        params: {
          redirectTo: JSON.stringify({
            pathname: '/ai-chat',
            params: {
              itemId: item.id,
              itemName: item.name,
              contextType: 'item',
            },
          }),
          showSignInCopy: 'true',
        },
      });
    }
    router.push({
      pathname: '/ai-chat',
      params: {
        itemId: item.id,
        itemName: item.name,
        contextType: 'item',
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView>
        <CachedImage localFileName={item.image} className="h-64 w-full" resizeMode="cover" />

        <View className="mb-4 bg-card p-4">
          <Text className="mb-1 text-2xl font-bold text-foreground">{item.name}</Text>
          <Text className="mb-3 text-muted-foreground">{item.category}</Text>

          {item.description && (
            <Text className="mb-4 text-muted-foreground">{item.description}</Text>
          )}

          <View className="mb-4 flex-row justify-between">
            <View>
              <Text className="mb-1 text-xs uppercase text-muted-foreground">WEIGHT (EACH)</Text>
              <WeightBadge weight={item.weight} unit={item.weightUnit} />
            </View>

            {showQuantity && (
              <View>
                <Text className="mb-1 text-xs uppercase text-muted-foreground">QUANTITY</Text>
                <Chip textClassName="text-center text-xs" variant="secondary">
                  {quantity}
                </Chip>
              </View>
            )}

            {showQuantity && (
              <View>
                <Text className="mb-1 text-xs uppercase text-muted-foreground">TOTAL WEIGHT</Text>
                <WeightBadge weight={totalWeight} unit={weightUnit} />
              </View>
            )}
          </View>

          <View className="mb-4 flex-row gap-3">
            {isItemConsumable && (
              <View className="flex-row items-center">
                <Chip textClassName="text-center text-xs" variant="consumable">
                  Consumable
                </Chip>
              </View>
            )}

            {isItemWorn && (
              <View className="flex-row items-center">
                <Chip textClassName="text-center text-xs" variant="worn">
                  Worn
                </Chip>
              </View>
            )}
          </View>

          {itemHasNotes && (
            <View className="mt-2">
              <Text className="mb-1 text-xs text-muted-foreground">NOTES</Text>
              <Text className="text-foreground">{itemNotes}</Text>
            </View>
          )}
        </View>
        {isOwnedByUser && (
          <View className="mb-8 mt-6 px-4">
            <Button
              variant="primary"
              onPress={navigateToChat}
              className="flex-row items-center justify-center rounded-full bg-primary px-4 py-3"
            >
              <Icon name="message" size={20} color="white" />
              <Text className="font-semibold text-white">Ask AI About This Item</Text>
            </Button>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
