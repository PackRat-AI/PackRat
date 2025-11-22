import { ActivityIndicator, Button, Text, useColorScheme } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { Chip } from 'expo-app/components/initial/Chip';
import { WeightBadge } from 'expo-app/components/initial/WeightBadge';
import { isAuthed } from 'expo-app/features/auth/store';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
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
import { SafeAreaView, ScrollView, View } from 'react-native';
import { PackItemImage } from '../components/PackItemImage';
import { SimilarItemsForPackItem } from '../components/SimilarItemsForPackItem';
import {
  usePackItemDetailsFromApi,
  usePackItemDetailsFromStore,
  usePackItemOwnershipCheck,
} from '../hooks';
import type { PackItem } from '../types';

export function ItemDetailScreen() {
  const { t } = useTranslation();
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

  const { colors } = useColorScheme();

  const item = (isOwnedByUser ? itemFromStore : itemFromApi) as PackItem;

  // Loading state for non-owned items
  if (!isOwnedByUser && isLoading) {
    return (
      <SafeAreaView className="flex-1">
        <View className="flex-1 items-center justify-center p-4">
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  // Error state for non-owned packs
  if (!isOwnedByUser && isError) {
    return (
      <SafeAreaView className="flex-1">
        <View className="flex-1 items-center justify-center p-8">
          <View className="mb-4 rounded-full bg-destructive/10 p-4">
            <Icon name="exclamation" size={32} color="text-destructive" />
          </View>
          <Text className="mb-2 text-lg font-medium text-foreground">
            {t('packs.failedToLoadItemDetails')}
          </Text>
          <Text className="mb-6 text-center text-muted-foreground">
            {error?.message || t('packs.pleaseTryAgain')}
          </Text>
          <View className="flex-row justify-center gap-2">
            <Button variant="primary" onPress={() => refetch()}>
              <Text>{t('packs.tryAgain')}</Text>
            </Button>
            <Button variant="secondary" onPress={router.back}>
              <Text>{t('packs.goBack')}</Text>
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
    <SafeAreaView className="flex-1">
      <ScrollView>
        <PackItemImage item={item} className="h-64 w-full" resizeMode="contain" />

        <View className="p-4">
          <Text className="mb-1 text-2xl font-bold text-foreground">{item.name}</Text>
          <Text className="mb-3 text-muted-foreground">{item.category}</Text>

          {item.description && (
            <Text className="mb-4 text-muted-foreground">{item.description}</Text>
          )}

          <View className="mb-4 flex-row justify-between">
            <View>
              <Text className="mb-1 text-xs uppercase text-muted-foreground">
                {t('packs.weightEach')}
              </Text>
              <WeightBadge weight={item.weight} unit={item.weightUnit} />
            </View>

            {showQuantity && (
              <View>
                <Text className="mb-1 text-xs uppercase text-muted-foreground">
                  {t('packs.quantityLabel')}
                </Text>
                <Chip textClassName="text-center text-xs" variant="secondary">
                  {quantity}
                </Chip>
              </View>
            )}

            {showQuantity && (
              <View>
                <Text className="mb-1 text-xs uppercase text-muted-foreground">
                  {t('packs.totalWeight')}
                </Text>
                <WeightBadge weight={totalWeight} unit={weightUnit} />
              </View>
            )}
          </View>

          <View className="mb-4 flex-row gap-3">
            {isItemConsumable && (
              <View className="flex-row items-center">
                <Chip textClassName="text-center text-xs" variant="consumable">
                  {t('packs.consumable')}
                </Chip>
              </View>
            )}

            {isItemWorn && (
              <View className="flex-row items-center">
                <Chip textClassName="text-center text-xs" variant="worn">
                  {t('packs.worn')}
                </Chip>
              </View>
            )}
          </View>

          {itemHasNotes && itemNotes && (
            <View className="mt-2">
              <Text className="mb-1 text-xs text-muted-foreground">{t('packs.notes')}</Text>
              <Text style={{ color: colors.foreground }}>{itemNotes}</Text>
            </View>
          )}
        </View>

        {isOwnedByUser && (
          <View className="mt-2 px-4">
            <Button
              variant="secondary"
              onPress={navigateToChat}
              className="flex-row items-center justify-center rounded-full  px-4 py-3"
            >
              <Icon name="message-outline" size={20} color={colors.foreground} />
              <Text style={{ color: colors.foreground }}>{t('packs.askAIAboutItem')}</Text>
            </Button>
          </View>
        )}

        {/* Similar Items Section */}
        <SimilarItemsForPackItem
          packId={item.packId}
          itemId={item.id}
          itemName={item.name}
          limit={5}
          threshold={0.1}
        />

        <View className="mt-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
