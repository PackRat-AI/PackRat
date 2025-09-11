import { ActivityIndicator, Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { Chip } from 'expo-app/components/initial/Chip';
import { WeightBadge } from 'expo-app/components/initial/WeightBadge';
import { isAuthed } from 'expo-app/features/auth/store';
import { CatalogBrowserModal } from 'expo-app/features/catalog/components';
import { useBulkAddCatalogItems } from 'expo-app/features/catalog/hooks';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import { GapAnalysisModal } from 'expo-app/features/packs/components/GapAnalysisModal';
import { PackItemCard } from 'expo-app/features/packs/components/PackItemCard';
import { PackItemSuggestions } from 'expo-app/features/packs/components/PackItemSuggestions';
import { useActiveLocation } from 'expo-app/features/weather/hooks';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, SafeAreaView, ScrollView, TouchableOpacity, View } from 'react-native';
import { usePackDetailsFromApi, usePackDetailsFromStore, usePackGapAnalysis } from '../hooks';
import { usePackOwnershipCheck } from '../hooks/usePackOwnershipCheck';
import type { Pack, PackItem } from '../types';

export function PackDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const isOwnedByUser = usePackOwnershipCheck(id as string);

  const [activeTab, setActiveTab] = useState('all');
  const [isCatalogModalVisible, setIsCatalogModalVisible] = useState(false);
  const [isGapAnalysisModalVisible, setIsGapAnalysisModalVisible] = useState(false);
  const { activeLocation } = useActiveLocation();

  const { addItemsToPack, isLoading: isAddingItems } = useBulkAddCatalogItems();
  const {
    mutate: analyzeGaps,
    data: gapAnalysis,
    isPending: isAnalyzing,
    reset: resetAnalysis,
  } = usePackGapAnalysis();

  const packFromStore = usePackDetailsFromStore(id as string); // Using user owned pack from store to ensure component updates when user modifies it
  const {
    pack: packFromApi,
    isLoading,
    isError,
    error,
    refetch,
  } = usePackDetailsFromApi({
    id: id as string,
    enabled: !isOwnedByUser,
  }); // Fetch non user owned packs from api

  const pack = (isOwnedByUser ? packFromStore : packFromApi) as Pack;

  const { colors } = useColorScheme();

  const handleItemPress = (item: PackItem) => {
    if (!item.id) return;
    router.push({
      pathname: `/item/[id]`,
      params: { id: item.id, packId: item.packId },
    });
  };

  const handleCatalogItemsSelected = async (catalogItems: CatalogItem[]) => {
    if (catalogItems.length > 0) {
      await addItemsToPack(id as string, catalogItems);
    }
  };

  const handleAnalyzeGaps = () => {
    if (!isAuthed.peek()) {
      return router.push({
        pathname: '/auth',
        params: {
          redirectTo: `/pack/${pack.id}`,
          showSignInCopy: 'true',
        },
      });
    }

    resetAnalysis();
    setIsGapAnalysisModalVisible(true);
    analyzeGaps({
      packId: id as string,
      context: {
        destination: activeLocation?.name,
        tripType: pack.category,
        startDate: new Date().toISOString().split('T')[0],
      },
    });
  };

  const handleRetryAnalysis = () => {
    resetAnalysis();
    analyzeGaps({
      packId: id as string,
      context: {},
    });
  };

  const getFilteredItems = () => {
    if (!pack?.items) return [];

    switch (activeTab) {
      case 'worn':
        return pack.items.filter((item) => item.worn);
      case 'consumable':
        return pack.items.filter((item) => item.consumable);
      default:
        return pack.items;
    }
  };

  const filteredItems = getFilteredItems();

  const getTabStyle = (tab: string) =>
    cn('flex-1 items-center py-4', activeTab === tab ? 'border-b-2 border-primary' : '');

  const getTabTextStyle = (tab: string) =>
    cn(activeTab === tab ? 'text-primary' : 'text-muted-foreground');

  // Loading state for non-owned packs
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
            Failed to load pack details
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

  return (
    <SafeAreaView className="flex-1">
      <ScrollView>
        {pack.image && (
          <Image source={{ uri: pack.image }} className="h-48 w-full" resizeMode="cover" />
        )}

        <View className="mb-4 p-4">
          <View className="mb-2">
            <Text className="text-2xl font-bold text-foreground">{pack.name}</Text>
            {pack.category && <Text variant="footnote">{pack.category}</Text>}
          </View>

          {pack.description && (
            <Text className="mb-4 text-muted-foreground">{pack.description}</Text>
          )}

          <View className="mb-4 flex-row justify-between">
            <View>
              <Text className="mb-1 text-xs uppercase text-muted-foreground">BASE WEIGHT</Text>
              <WeightBadge weight={pack.baseWeight || 0} unit="g" type="base" />
            </View>
            <View>
              <Text className="mb-1 text-xs uppercase text-muted-foreground">TOTAL WEIGHT</Text>
              <WeightBadge weight={pack.totalWeight || 0} unit="g" type="total" />
            </View>
            <View>
              <Text className="mb-1 text-xs uppercase text-muted-foreground">ITEMS</Text>
              <Chip textClassName="text-center text-xs" variant="secondary">
                {pack.items?.length || 0}
              </Chip>
            </View>
          </View>

          {pack.tags && pack.tags.length > 0 && (
            <View className="flex-row flex-wrap">
              {pack.tags.map((tag) => (
                <Chip
                  key={tag}
                  className="mb-1 mr-2"
                  textClassName="text-xs text-center"
                  variant="outline"
                >
                  #{tag}
                </Chip>
              ))}
            </View>
          )}
        </View>

        <View>
          <View className="p-4">
            <View className="gap-3">
              <Button
                variant="secondary"
                onPress={() => {
                  if (!isAuthed.peek()) {
                    return router.push({
                      pathname: '/auth',
                      params: {
                        redirectTo: JSON.stringify({
                          pathname: '/ai-chat',
                          params: {
                            packId: id,
                            packName: pack.name,
                            contextType: 'pack',
                          },
                        }),
                        showSignInCopy: 'true',
                      },
                    });
                  }

                  router.push({
                    pathname: '/ai-chat',
                    params: {
                      packId: id,
                      packName: pack.name,
                      contextType: 'pack',
                    },
                  });
                }}
              >
                <Icon name="message-outline" color={colors.foreground} />
                <Text>Ask AI</Text>
              </Button>

              {isOwnedByUser && (
                <Button variant="secondary" onPress={handleAnalyzeGaps} disabled={isAnalyzing}>
                  <Icon name="magnify-scan" color={colors.foreground} />
                  <Text>{isAnalyzing ? 'Analyzing...' : 'Analyze Gaps'}</Text>
                </Button>
              )}
            </View>
          </View>

          <View className="flex-row border-b border-border">
            <TouchableOpacity className={getTabStyle('all')} onPress={() => setActiveTab('all')}>
              <Text className={getTabTextStyle('all')}>All Items</Text>
            </TouchableOpacity>
            <TouchableOpacity className={getTabStyle('worn')} onPress={() => setActiveTab('worn')}>
              <Text className={getTabTextStyle('worn')}>Worn</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={getTabStyle('consumable')}
              onPress={() => setActiveTab('consumable')}
            >
              <Text className={getTabTextStyle('consumable')}>Consumable</Text>
            </TouchableOpacity>
          </View>

          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <View key={item.id} className="px-4 pt-3">
                <PackItemCard item={item} onPress={handleItemPress} />
              </View>
            ))
          ) : (
            <View className="items-center justify-center p-4">
              <Text className="text-muted-foreground">No items found</Text>
            </View>
          )}

          {/* AI Suggestions Section */}
          {isOwnedByUser && !!filteredItems.length && <PackItemSuggestions pack={pack} />}

          {isOwnedByUser && (
            <View className="gap-3 p-4">
              <Button
                variant="secondary"
                onPress={() => setIsCatalogModalVisible(true)}
                disabled={isAddingItems}
              >
                <Icon name="magnify" color={colors.foreground} />
                <Text>Browse Catalog</Text>
              </Button>
              <Button
                onPress={() =>
                  router.push({
                    pathname: '/item/new',
                    params: { packId: pack.id },
                  })
                }
                disabled={isAddingItems}
              >
                <Icon name="plus" color={colors.foreground} />
                <Text>Add New Item</Text>
              </Button>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Catalog Browser Modal */}
      <CatalogBrowserModal
        visible={isCatalogModalVisible}
        onClose={() => setIsCatalogModalVisible(false)}
        onItemsSelected={handleCatalogItemsSelected}
      />

      {/* Gap Analysis Modal */}
      <GapAnalysisModal
        visible={isGapAnalysisModalVisible}
        onClose={() => setIsGapAnalysisModalVisible(false)}
        pack={pack}
        analysis={gapAnalysis || null}
        isLoading={isAnalyzing}
        onRetry={handleRetryAnalysis}
      />
    </SafeAreaView>
  );
}
