import { Button, Text } from '@packrat/ui/nativewindui';
import { searchValueAtom } from 'expo-app/atoms/itemListAtoms';
import { CategoriesFilter } from 'expo-app/components/CategoriesFilter';
import { Icon } from 'expo-app/components/Icon';
import { SearchInput } from 'expo-app/components/SearchInput';
import { CatalogItemImage } from 'expo-app/features/catalog/components/CatalogItemImage';
import { HorizontalCatalogItemCard } from 'expo-app/features/packs/components/HorizontalCatalogItemCard';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import * as Haptics from 'expo-haptics';
import { useAtom } from 'jotai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDebounce } from 'use-debounce';
import { useCatalogItemsInfinite } from '../hooks';
import { useCatalogItemsCategories } from '../hooks/useCatalogItemsCategories';
import { usePopularCatalogItems } from '../hooks/usePopularCatalogItems';
import { useRecentlyUsedCatalogItems } from '../hooks/useRecentlyUsedCatalogItems';
import { useVectorSearch } from '../hooks/useVectorSearch';
import type { CatalogItem } from '../types';

type CatalogBrowserModalProps = {
  visible: boolean;
  onClose: () => void;
  onItemsSelected: (items: CatalogItem[]) => void;
};

function QuickAccessSection({
  title,
  items,
  selectedItems,
  itemQuantities,
  onItemToggle,
  onQuantityChange,
  emptyMessage,
}: {
  title: string;
  items: CatalogItem[];
  selectedItems: Set<number>;
  itemQuantities: Map<number, number>;
  onItemToggle: (item: CatalogItem) => void;
  onQuantityChange: (itemId: number, delta: number) => void;
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    if (!emptyMessage) return null;
    return (
      <View className="mb-4">
        <Text className="mb-2 text-sm font-semibold text-foreground" numberOfLines={1}>
          {title}
        </Text>
        <Text className="text-xs text-muted-foreground">{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-semibold text-foreground" numberOfLines={1}>
        {title}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {items.map((item) => (
          <View key={item.id} style={{ width: 288 }}>
            <HorizontalCatalogItemCard
              item={item}
              selected={selectedItems.has(item.id)}
              onSelect={onItemToggle}
              quantity={itemQuantities.get(item.id) ?? 1}
              onQuantityChange={onQuantityChange}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function QtyButton({ onPress, children }: { onPress: () => void; children: React.ReactNode }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPressIn={() => {
        scale.value = withSpring(0.78, { damping: 12, stiffness: 300 });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 300 });
      }}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View
        style={animStyle}
        className="h-7 w-7 items-center justify-center rounded-full border border-border"
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

function CartSheet({
  visible,
  onClose,
  items,
  quantities,
  onQuantityChange,
  onRemoveItem,
  onClear,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  items: CatalogItem[];
  quantities: Map<number, number>;
  onQuantityChange: (itemId: number, delta: number) => void;
  onRemoveItem: (itemId: number) => void;
  onClear: () => void;
  onAdd: () => void;
}) {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();

  const translateY = useSharedValue(400);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 220 });
      translateY.value = withSpring(0, { damping: 22, stiffness: 260, mass: 0.8 });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(400, { duration: 220 });
    }
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'flex-end',
        zIndex: 10,
      }}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {/* Animated backdrop */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
          },
          backdropStyle,
        ]}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      {/* Animated sheet */}
      <Animated.View
        className="bg-card rounded-t-3xl overflow-hidden"
        style={[{ maxHeight: '78%' }, sheetStyle]}
      >
        {/* Drag handle */}
        <View className="items-center pt-3 pb-1">
          <View className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </View>

        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-2 pb-3 border-b border-border">
          <Text className="text-base font-semibold text-foreground">
            {t('catalog.cartTitle', { count: items.length })}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="close" size={20} color={colors.grey2} />
          </TouchableOpacity>
        </View>

        {/* Items list */}
        <ScrollView>
          {items.map((item) => {
            const qty = quantities.get(item.id) ?? 1;
            return (
              <View
                key={item.id}
                className="flex-row items-center gap-3 px-4 py-3 border-b border-border"
              >
                <CatalogItemImage
                  imageUrl={item.images?.[0]}
                  className="h-11 w-11 rounded-lg shrink-0"
                  resizeMode="cover"
                />
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.brand && (
                    <Text className="text-xs text-muted-foreground">{item.brand}</Text>
                  )}
                </View>

                {/* Qty controls */}
                <View className="flex-row items-center gap-2">
                  <QtyButton
                    onPress={() => {
                      if (qty <= 1) onRemoveItem(item.id);
                      else onQuantityChange(item.id, -1);
                    }}
                  >
                    <Icon name="minus" size={13} color={colors.grey2} />
                  </QtyButton>
                  <Text className="text-base font-semibold text-foreground text-center w-7">
                    {qty}
                  </Text>
                  <QtyButton onPress={() => onQuantityChange(item.id, 1)}>
                    <Icon name="plus" size={13} color={colors.foreground} />
                  </QtyButton>
                </View>

                {/* Remove */}
                <TouchableOpacity
                  onPress={() => onRemoveItem(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="trash-can-outline" size={18} color={colors.grey2} />
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>

        {/* Footer */}
        <View
          className="flex-row gap-2 px-4 pt-3 border-t border-border"
          style={{ paddingBottom: Math.max(bottom, 16) + 8 }}
        >
          <Button variant="secondary" className="flex-1" onPress={onClear}>
            <Text>{t('catalog.clearSelection')}</Text>
          </Button>
          <Button onPress={onAdd} variant="tonal" className="flex-1">
            <Text>
              {t('catalog.addItems', {
                count: items.length,
                unit: items.length > 1 ? t('catalog.items') : t('catalog.item'),
              })}
            </Text>
          </Button>
        </View>
      </Animated.View>
    </View>
  );
}

export function CatalogBrowserModal({
  visible,
  onClose,
  onItemsSelected,
}: CatalogBrowserModalProps) {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useAtom(searchValueAtom);
  const [activeFilter, setActiveFilter] = useState<'All' | string>('All');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [itemQuantities, setItemQuantities] = useState<Map<number, number>>(new Map());
  const [isCartVisible, setIsCartVisible] = useState(false);
  const [debouncedSearchValue] = useDebounce(searchValue, 400);
  // Persists item data across category switches so the cart never loses items
  const itemCacheRef = useRef<Map<number, CatalogItem>>(new Map());

  const isSearching = debouncedSearchValue.length > 0;
  const isDefaultView = !isSearching && activeFilter === 'All';

  const { data: categories } = useCatalogItemsCategories();
  const { recentItems } = useRecentlyUsedCatalogItems();
  const { data: popularData, isLoading: isPopularLoading } = usePopularCatalogItems(8);

  const popularItems = popularData?.items ?? [];

  const {
    data: paginatedData,
    isLoading: isPaginatedLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    error: paginatedError,
  } = useCatalogItemsInfinite({
    category: activeFilter === 'All' ? undefined : activeFilter,
    limit: 20,
    sort: { field: 'createdAt', order: 'desc' },
  });

  const {
    data: searchResult,
    isLoading: isSearchLoading,
    error: searchError,
  } = useVectorSearch({ query: debouncedSearchValue, limit: 20 });

  const items = isSearching
    ? searchResult?.items || []
    : paginatedData?.pages.flatMap((page) => page.items) || [];
  const isLoading = isSearching ? isSearchLoading : isPaginatedLoading;
  const error = isSearching ? searchError : paginatedError;

  // Auto-close cart when all items are removed
  useEffect(() => {
    if (selectedItems.size === 0 && isCartVisible) {
      setIsCartVisible(false);
    }
  }, [selectedItems.size, isCartVisible]);

  const handleItemToggle = useCallback(
    (item: CatalogItem) => {
      // Always cache item data so it survives category/search switches
      itemCacheRef.current.set(item.id, item);
      const newSelected = new Set(selectedItems);
      if (newSelected.has(item.id)) {
        newSelected.delete(item.id);
        setItemQuantities((prev) => {
          const next = new Map(prev);
          next.delete(item.id);
          return next;
        });
      } else {
        newSelected.add(item.id);
        setItemQuantities((prev) => new Map(prev).set(item.id, 1));
      }
      setSelectedItems(newSelected);
    },
    [selectedItems],
  );

  const handleQuantityChange = useCallback((itemId: number, delta: number) => {
    setItemQuantities((prev) => {
      const current = prev.get(itemId) ?? 1;
      const next = Math.max(1, current + delta);
      return new Map(prev).set(itemId, next);
    });
  }, []);

  const handleRemoveItem = useCallback((itemId: number) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
    setItemQuantities((prev) => {
      const next = new Map(prev);
      next.delete(itemId);
      return next;
    });
  }, []);

  const handleAddSelected = () => {
    const selectedCatalogItems = Array.from(selectedItems)
      .map((id) => itemCacheRef.current.get(id))
      .filter((item): item is CatalogItem => item !== undefined)
      .map((item) => ({ ...item, quantity: itemQuantities.get(item.id) ?? 1 }));
    onItemsSelected(selectedCatalogItems);
    resetSelection();
    setSearchValue('');
    onClose();
  };

  const resetSelection = () => {
    setSelectedItems(new Set());
    setItemQuantities(new Map());
    setIsCartVisible(false);
  };

  const handleClose = () => {
    resetSelection();
    setSearchValue('');
    onClose();
  };

  const handleRefresh = () => {
    if (isSearching) {
      setSearchValue('');
    } else {
      refetch();
    }
  };

  const handleLoadMore = () => {
    if (!isSearching && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const selectedItemsList = useMemo(
    () =>
      Array.from(selectedItems)
        .map((id) => itemCacheRef.current.get(id))
        .filter((item): item is CatalogItem => item !== undefined),
    [selectedItems],
  );

  const renderItem = ({ item }: { item: CatalogItem }) => (
    <HorizontalCatalogItemCard
      item={item}
      selected={selectedItems.has(item.id)}
      onSelect={handleItemToggle}
      quantity={itemQuantities.get(item.id) ?? 1}
      onQuantityChange={handleQuantityChange}
    />
  );

  const ItemSeparatorComponent = useMemo(() => () => <View className="h-2" />, []);

  const ListHeaderComponent = useMemo(() => {
    if (!isDefaultView) return null;
    const showPopular = popularItems.length > 0 || isPopularLoading;
    const showRecent = recentItems.length > 0;
    if (!showPopular && !showRecent) return null;
    return (
      <View className="pb-2">
        {showRecent && (
          <QuickAccessSection
            title={t('catalog.recentlyUsed')}
            items={recentItems}
            selectedItems={selectedItems}
            itemQuantities={itemQuantities}
            onItemToggle={handleItemToggle}
            onQuantityChange={handleQuantityChange}
          />
        )}
        {showPopular && (
          <QuickAccessSection
            title={t('catalog.popularItems')}
            items={isPopularLoading ? [] : popularItems}
            selectedItems={selectedItems}
            itemQuantities={itemQuantities}
            onItemToggle={handleItemToggle}
            onQuantityChange={handleQuantityChange}
          />
        )}
        <Text className="mb-2 text-sm font-semibold text-foreground">
          {t('catalog.browseCatalog')}
        </Text>
      </View>
    );
  }, [
    isDefaultView,
    popularItems,
    isPopularLoading,
    recentItems,
    selectedItems,
    itemQuantities,
    handleItemToggle,
    handleQuantityChange,
    t,
  ]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-border p-4">
          <View className="flex-row items-center">
            <Text>{t('catalog.browseCatalog')}</Text>
          </View>
          <TouchableOpacity onPress={handleClose}>
            <Icon name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Search and Filter */}
        <View className="p-4">
          <SearchInput
            textContentType="none"
            autoComplete="off"
            value={searchValue}
            onChangeText={setSearchValue}
            placeholder={t('catalog.searchEllipsis')}
          />

          {!isSearching && categories && (
            <View className="mt-3">
              <CategoriesFilter
                activeFilter={activeFilter}
                onFilter={setActiveFilter}
                data={categories ? categories : undefined}
              />
            </View>
          )}
        </View>

        {/* Items List */}
        <View className="flex-1">
          {isLoading && items.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text className="mt-2 text-muted-foreground">{t('catalog.loading')}</Text>
            </View>
          ) : error ? (
            <View className="flex-1 items-center justify-center p-4">
              <Icon name="exclamation" size={48} color={colors.destructive} />
              <Text className="mt-2 text-center font-semibold">
                {t('catalog.errorLoadingItems')}
              </Text>
              <Text className="mt-1 text-center text-muted-foreground">{error.message}</Text>
              <Button className="mt-4" onPress={handleRefresh}>
                <Text>{t('catalog.tryAgain')}</Text>
              </Button>
            </View>
          ) : items.length === 0 && !isDefaultView ? (
            <View className="flex-1 items-center justify-center p-4">
              <Icon name="magnify" size={48} color={colors.grey2} />
              <Text className="mt-2 text-center font-semibold">{t('catalog.noItemsFound')}</Text>
              <Text className="mt-1 text-center text-muted-foreground">
                {isSearching ? t('catalog.tryAdjustingSearch') : t('catalog.noCatalogItems')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              renderItem={renderItem}
              contentContainerStyle={{ padding: 16 }}
              ItemSeparatorComponent={ItemSeparatorComponent}
              ListHeaderComponent={ListHeaderComponent}
              refreshControl={
                <RefreshControl
                  refreshing={isRefetching}
                  onRefresh={handleRefresh}
                  tintColor={colors.primary}
                />
              }
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.1}
              ListFooterComponent={
                isFetchingNextPage ? (
                  <View className="py-4">
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ) : null
              }
            />
          )}
        </View>

        {/* Cart CTA bar */}
        {selectedItems.size > 0 && (
          <View className="flex-row gap-2 px-4 py-3 border-t border-border bg-card">
            <Button variant="secondary" className="flex-1" onPress={() => setIsCartVisible(true)}>
              <Text>{t('catalog.viewCart', { count: selectedItems.size })}</Text>
            </Button>
            <Button variant="tonal" className="flex-1" onPress={handleAddSelected}>
              <Text>
                {t('catalog.addItems', {
                  count: selectedItems.size,
                  unit: selectedItems.size > 1 ? t('catalog.items') : t('catalog.item'),
                })}
              </Text>
            </Button>
          </View>
        )}

        {/* Cart sheet overlay */}
        <CartSheet
          visible={isCartVisible}
          onClose={() => setIsCartVisible(false)}
          items={selectedItemsList}
          quantities={itemQuantities}
          onQuantityChange={handleQuantityChange}
          onRemoveItem={handleRemoveItem}
          onClear={resetSelection}
          onAdd={handleAddSelected}
        />
      </SafeAreaView>
    </Modal>
  );
}
