import { useActionSheet } from '@expo/react-native-action-sheet';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { ActivityIndicator, Button, Sheet, Text, useSheetRef } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { appAlert } from 'expo-app/app/_layout';
import { Chip } from 'expo-app/components/initial/Chip';
import { WeightBadge } from 'expo-app/components/initial/WeightBadge';
import { isAuthed } from 'expo-app/features/auth/store';
import { CatalogBrowserModal } from 'expo-app/features/catalog/components';
import { useBulkAddCatalogItems } from 'expo-app/features/catalog/hooks';
import type { CatalogItem, CatalogItemWithPackItemFields } from 'expo-app/features/catalog/types';
import { GapAnalysisModal } from 'expo-app/features/packs/components/GapAnalysisModal';
import { PackItemCard } from 'expo-app/features/packs/components/PackItemCard';
import { LocationPicker } from 'expo-app/features/weather/components';
import type { WeatherLocation } from 'expo-app/features/weather/types';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, SafeAreaView, ScrollView, TouchableOpacity, View } from 'react-native';
import {
  useImagePicker,
  usePackDetailsFromApi,
  usePackDetailsFromStore,
  usePackGapAnalysis,
} from '../hooks';
import { usePackOwnershipCheck } from '../hooks/usePackOwnershipCheck';
import type { Pack, PackItem } from '../types';

export function PackDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const isOwnedByUser = usePackOwnershipCheck(id as string);

  const DEFAULT_TAB = 'all';
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB);
  const [isCatalogModalVisible, setIsCatalogModalVisible] = useState(false);
  const [isPackingMode, setIsPackingMode] = useState(false);
  const [packedItems, setPackedItems] = useState<Record<string, boolean>>({});

  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [isGapAnalysisModalVisible, setIsGapAnalysisModalVisible] = useState(false);

  const [location, setLocation] = useState<WeatherLocation>();

  const { addItemsToPack, isLoading: isAddingItems } = useBulkAddCatalogItems();
  const {
    mutate: analyzeGaps,
    data: gapAnalysis,
    isPending: isAnalyzing,
    reset: resetAnalysis,
  } = usePackGapAnalysis();

  const { pickImage, takePhoto } = useImagePicker();
  const { showActionSheetWithOptions } = useActionSheet();

  const packFromStore = usePackDetailsFromStore(id as string);
  const {
    pack: packFromApi,
    isLoading,
    isError,
    error,
    refetch,
  } = usePackDetailsFromApi({
    id: id as string,
    enabled: !isOwnedByUser,
  });

  const pack = (isOwnedByUser ? packFromStore : packFromApi) as Pack;

  const { colors } = useColorScheme();

  const bottomSheetRef = useSheetRef();

  const handleItemPress = (item: PackItem) => {
    if (!item.id) return;
    router.push({
      pathname: `/item/[id]`,
      params: { id: item.id, packId: item.packId },
    });
  };

  const handleItemSelect = (item: PackItem) => {
    if (!item.id) return;
    setPackedItems((prev) => ({
      ...prev,
      [item.id]: !prev[item.id],
    }));
  };

  const handleResetPackingMode = () => {
    setPackedItems({});
  };

  const handleSavePackingMode = () => {
    // TODO: Implement save to API/storage
    // Placeholder for future implementation
  };

  const packingProgress = useMemo(() => {
    const totalItems = pack?.items?.length || 0;
    const packedCount = Object.values(packedItems).filter(Boolean).length;
    return { packed: packedCount, total: totalItems };
  }, [pack?.items?.length, packedItems]);

  const handleCatalogItemsSelected = async (catalogItems: CatalogItem[]) => {
    if (catalogItems.length > 0) {
      await addItemsToPack(id as string, catalogItems as CatalogItemWithPackItemFields[]);
    }
  };

  const handleAnalyzeGapsPress = () => {
    if (!isAuthed.peek()) {
      return router.push({
        pathname: '/auth',
        params: {
          redirectTo: `/pack/${pack.id}`,
          showSignInCopy: 'true',
        },
      });
    }

    setIsLocationPickerOpen(true);
  };

  const handleLocationSelect = (location?: WeatherLocation) => {
    setLocation(location);
    setIsLocationPickerOpen(false);
    resetAnalysis();
    setIsGapAnalysisModalVisible(true);
    analyzeGaps({
      packId: id as string,
      context: {
        destination: location?.name,
        tripType: pack.category,
        startDate: new Date().toISOString().split('T')[0],
      },
    });
  };

  const handleRetryAnalysis = () => {
    resetAnalysis();
    analyzeGaps({
      packId: id as string,
      context: {
        destination: location?.name,
        tripType: pack.category,
        startDate: new Date().toISOString().split('T')[0],
      },
    });
  };

  const getFilteredItems = () => {
    if (!pack?.items) return [];

    if (isPackingMode) {
      // In packing mode, filter by packing status
      switch (activeTab) {
        case 'unpacked':
          return pack.items.filter((item) => !packedItems[item.id]);
        case 'packed':
          return pack.items.filter((item) => packedItems[item.id]);
        default:
          return pack.items;
      }
    } else {
      // Regular mode, filter by item properties
      switch (activeTab) {
        case 'worn':
          return pack.items.filter((item) => item.worn);
        case 'consumable':
          return pack.items.filter((item) => item.consumable);
        default:
          return pack.items;
      }
    }
  };

  const handleMoreActionsPress = () => {
    bottomSheetRef.current?.present();
  };

  const filteredItems = getFilteredItems();

  const getTabStyle = (tab: string) =>
    cn('flex-1 items-center py-4', activeTab === tab ? 'border-b-2 border-primary' : '');

  const getTabTextStyle = (tab: string) =>
    cn(activeTab === tab ? 'text-primary' : 'text-muted-foreground');

  // New unified handler to avoid duplicate Ask AI logic
  const handleAskAI = () => {
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
  };

  const handleAddFromPhoto = () => {
    if (!isAuthed.peek()) {
      return router.push({
        pathname: '/auth',
        params: {
          redirectTo: `/pack/${pack.id}`,
          showSignInCopy: 'true',
        },
      });
    }
    const options = ['Take Photo', 'Choose from Library', 'Cancel'];
    const cancelButtonIndex = 2;

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        containerStyle: {
          backgroundColor: colors.card,
        },
        textStyle: {
          color: colors.foreground,
        },
      },
      async (selectedIndex) => {
        try {
          switch (selectedIndex) {
            case 0: {
              // Take Photo
              const fileInfo = await takePhoto();
              if (fileInfo)
                router.push({
                  pathname: '/pack/items-scan',
                  params: { packId: pack.id, ...fileInfo },
                });
              break;
            }
            case 1: {
              // Choose from Library
              const fileInfo = await pickImage();
              if (fileInfo)
                router.push({
                  pathname: '/pack/items-scan',
                  params: { packId: pack.id, ...fileInfo },
                });
              break;
            }
            case cancelButtonIndex:
              // Canceled
              return;
          }
        } catch (err) {
          console.error('Error handling image:', err);
          appAlert.current?.alert({
            title: 'Error',
            message: 'Failed to process image. Please try again.',
            buttons: [{ text: 'OK', style: 'default' }],
          });
        }
      },
    );
  };

  // Prepare bottom sheet actions with consistent structure
  const actions = [
    {
      key: 'ask-ai',
      label: 'Ask AI',
      icon: <Icon size={20} name="message-outline" color={colors.foreground} />,
      onPress: handleAskAI,
      show: true,
      variant: 'secondary' as const,
      disabled: false,
    },
    {
      key: 'packing',
      label: isPackingMode ? 'Done Packing' : 'Start Packing',
      icon: <Icon size={20} name="check" color={colors.foreground} />,
      onPress: () => setIsPackingMode(!isPackingMode),
      show: isOwnedByUser,
      variant: isPackingMode ? ('primary' as const) : ('secondary' as const),
      disabled: false,
    },
    {
      key: 'analyze',
      label: isAnalyzing ? 'Analyzing...' : 'Analyze Gaps',
      icon: (
        <Icon
          size={20}
          ios={{ name: 'text.viewfinder' }}
          materialIcon={{ type: 'MaterialCommunityIcons', name: 'magnify-scan' }}
          color={colors.foreground}
        />
      ),
      onPress: handleAnalyzeGapsPress,
      show: isOwnedByUser,
      variant: 'secondary' as const,
      disabled: isAnalyzing,
    },
    {
      key: 'add-from-photo',
      label: 'Add from Photo',
      icon: <Icon size={20} name="camera-outline" color={colors.foreground} />,
      onPress: handleAddFromPhoto,
      show: isOwnedByUser,
      variant: 'secondary' as const,
      disabled: false,
    },
    {
      key: 'browse',
      label: 'Browse Catalog',
      icon: <Icon size={20} name="magnify" color={colors.foreground} />,
      onPress: () => setIsCatalogModalVisible(true),
      show: isOwnedByUser,
      variant: 'secondary' as const,
      disabled: isAddingItems,
    },
  ];

  type ActionItem = {
    key: string;
    label: string;
    icon: React.ReactNode;
    onPress: () => void;
    show: boolean;
    variant: 'primary' | 'secondary';
    disabled: boolean;
  };

  type PlaceholderItem = {
    key: string;
    placeholder: true;
  };

  const visibleActions = actions.filter((a) => a.show);
  const normalizedActions: (ActionItem | PlaceholderItem)[] = [...visibleActions];
  if (normalizedActions.length % 2 === 1) {
    normalizedActions.push({ key: '__placeholder__', placeholder: true });
  }

  // Consistent sizing classes for action buttons (full-width inside 1/2 column)
  const actionBtnClass = 'w-full h-14 flex-row items-center justify-start gap-2';

  if (!isOwnedByUser && isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-4">
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

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
      <ScrollView stickyHeaderIndices={[2]} contentContainerClassName="pb-24">
        {pack.image && (
          <Image source={{ uri: pack.image }} className="h-48 w-full" resizeMode="cover" />
        )}

        {/* Header */}
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

        {/* Actions */}
        <View className="p-4">
          <View className="gap-4 flex-row items-center">
            <Button variant="secondary" onPress={handleAskAI} className="flex-1">
              <Text>Ask AI</Text>
            </Button>

            {isOwnedByUser && (
              <Button
                variant={isPackingMode ? 'primary' : 'secondary'}
                onPress={() => {
                  setIsPackingMode(!isPackingMode);
                  setActiveTab(DEFAULT_TAB); // Reset tab when toggling mode
                }}
              >
                <Text>{isPackingMode ? 'Done Packing' : 'Start Packing'}</Text>
              </Button>
            )}

            {isOwnedByUser && (
              <Button variant="secondary" size="icon" onPress={handleMoreActionsPress}>
                <Icon name="dots-horizontal" size={20} color={colors.grey2} />
              </Button>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View className="flex-row bg-background sticky border-b border-border">
          {isPackingMode ? (
            <>
              <TouchableOpacity className={getTabStyle('all')} onPress={() => setActiveTab('all')}>
                <Text className={getTabTextStyle('all')}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={getTabStyle('unpacked')}
                onPress={() => setActiveTab('unpacked')}
              >
                <Text className={getTabTextStyle('unpacked')}>Unpacked</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={getTabStyle('packed')}
                onPress={() => setActiveTab('packed')}
              >
                <Text className={getTabTextStyle('packed')}>Packed</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity className={getTabStyle('all')} onPress={() => setActiveTab('all')}>
                <Text className={getTabTextStyle('all')}>All Items</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={getTabStyle('worn')}
                onPress={() => setActiveTab('worn')}
              >
                <Text className={getTabTextStyle('worn')}>Worn</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={getTabStyle('consumable')}
                onPress={() => setActiveTab('consumable')}
              >
                <Text className={getTabTextStyle('consumable')}>Consumable</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Content */}
        <View>
          {filteredItems.length > 0 ? (
            <View className="p-4">
              {filteredItems.map((item) => (
                <PackItemCard
                  key={item.id}
                  item={item}
                  dimOnSelect={isPackingMode && !!packedItems[item.id]}
                  {...(isPackingMode
                    ? { onSelect: handleItemSelect, selected: !!packedItems[item.id] }
                    : { onPress: handleItemPress })}
                />
              ))}
            </View>
          ) : (
            <View className="items-center justify-center p-4">
              <Text className="text-muted-foreground">No items found</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Packing Mode Toolbar */}
      {isPackingMode && (
        <View className="absolute border border-t-border bottom-0 left-0 right-0 px-4 py-3 bg-card border-b border-border">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              {/* Close Button */}
              <Button
                variant="plain"
                size="icon"
                onPress={() => {
                  appAlert.current?.alert({
                    title: 'Exit Packing Mode?',
                    message: "If you don't save, your packing state will be lost.",
                    buttons: [
                      {
                        text: 'Exit without Saving',
                        style: 'destructive',
                        onPress() {
                          setIsPackingMode(!isPackingMode);
                          setActiveTab(DEFAULT_TAB); // Reset tab when toggling mode
                        },
                      },
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Save',
                        style: 'default',
                        onPress() {
                          handleSavePackingMode();
                        },
                      },
                    ],
                  });
                }}
              >
                <Icon name="close" size={20} color={colors.grey2} />
              </Button>
              {/* Progress Text */}
              <Text variant="subhead" className="text-muted-foreground">
                {packingProgress.packed} of {packingProgress.total} items packed
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              {/* Reset Button */}
              <Button variant="plain" size="sm" onPress={handleResetPackingMode}>
                <Text>Reset</Text>
              </Button>
              {/* Save Button */}
              <Button variant="plain" size="sm" onPress={handleSavePackingMode}>
                <Text>Save</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      <Sheet
        ref={bottomSheetRef}
        enableDynamicSizing={true}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: colors.card }}
        handleIndicatorStyle={{ backgroundColor: colors.grey2 }}
      >
        <BottomSheetView className="flex-1 px-4" style={{ flex: 1 }}>
          {/* Revamped consistent 2-column action layout */}
          <View className="flex-row flex-wrap -mx-1">
            {normalizedActions.map((action) => (
              <View key={action.key} className="w-1/2 px-1 mb-3">
                {'placeholder' in action ? (
                  <View className={actionBtnClass} />
                ) : (
                  <Button
                    variant={action.variant}
                    onPress={() => {
                      bottomSheetRef.current?.close();
                      action.onPress();
                    }}
                    disabled={action.disabled}
                    className={actionBtnClass}
                  >
                    {action.icon}
                    <Text className="text-sm font-normal pr-8">{action.label}</Text>
                  </Button>
                )}
              </View>
            ))}
          </View>
        </BottomSheetView>
      </Sheet>

      <CatalogBrowserModal
        visible={isCatalogModalVisible}
        onClose={() => setIsCatalogModalVisible(false)}
        onItemsSelected={handleCatalogItemsSelected}
      />

      {/* Gap Analysis Flow*/}
      <LocationPicker
        subtitle="Get enhanced analysis with weather and terrain data."
        title="Select Location"
        open={isLocationPickerOpen}
        onClose={() => setIsLocationPickerOpen(false)}
        skipText="Skip"
        onSkip={handleLocationSelect}
        selectText="Continue"
        onSelect={handleLocationSelect}
      />
      <GapAnalysisModal
        visible={isGapAnalysisModalVisible}
        onClose={() => setIsGapAnalysisModalVisible(false)}
        pack={pack}
        location={location?.name}
        analysis={gapAnalysis || null}
        isLoading={isAnalyzing}
        onRetry={handleRetryAnalysis}
      />
    </SafeAreaView>
  );
}
