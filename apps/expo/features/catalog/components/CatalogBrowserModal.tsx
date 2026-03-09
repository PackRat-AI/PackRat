import { Button, SearchInput, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { searchValueAtom } from 'expo-app/atoms/itemListAtoms';
import { CategoriesFilter } from 'expo-app/components/CategoriesFilter';
import { HorizontalCatalogItemCard } from 'expo-app/features/packs/components/HorizontalCatalogItemCard';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useAtom } from 'jotai';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
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
  onItemToggle,
  emptyMessage,
}: {
  title: string;
  items: CatalogItem[];
  selectedItems: Set<number>;
  onItemToggle: (item: CatalogItem) => void;
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    if (!emptyMessage) return null;
    return (
      <View className="mb-4">
        <Text className="mb-2 text-sm font-semibold text-foreground">{title}</Text>
        <Text className="text-xs text-muted-foreground">{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-semibold text-foreground">{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {items.map((item) => (
          <View key={item.id} className="w-56">
            <HorizontalCatalogItemCard
              item={item}
              selected={selectedItems.has(item.id)}
              onSelect={onItemToggle}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function SelectedItemsQuantityPanel({
  items,
  quantities,
  onQuantityChange,
  onClear,
  onAdd,
}: {
  items: CatalogItem[];
  quantities: Map<number, number>;
  onQuantityChange: (itemId: number, delta: number) => void;
  onClear: () => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();

  return (
    <View className="border-t border-border bg-card">
      <ScrollView style={{ maxHeight: 180 }} contentContainerStyle={{ padding: 12, gap: 8 }}>
        {items.map((item) => {
          const qty = quantities.get(item.id) ?? 1;
          return (
            <View key={item.id} className="flex-row items-center justify-between">
              <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
                {item.name}
              </Text>
              <View className="flex-row items-center gap-2 ml-2">
                <TouchableOpacity
                  onPress={() => onQuantityChange(item.id, -1)}
                  disabled={qty <= 1}
                  className="h-7 w-7 items-center justify-center rounded-full border border-border"
                >
                  <Icon
                    name="minus"
                    size={14}
                    color={qty <= 1 ? colors.grey2 : colors.foreground}
                  />
                </TouchableOpacity>
                <Text className="w-6 text-center text-sm font-medium text-foreground">{qty}</Text>
                <TouchableOpacity
                  onPress={() => onQuantityChange(item.id, 1)}
                  className="h-7 w-7 items-center justify-center rounded-full border border-border"
                >
                  <Icon name="plus" size={14} color={colors.foreground} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
      <View className="flex-row gap-3 items-center justify-end border-t border-border px-4 py-3">
        <Button variant="secondary" className="mb-1" onPress={onClear}>
          <Text>{t('catalog.clearSelection')}</Text>
        </Button>
        <Button onPress={onAdd} className="mb-1" variant="tonal">
          <Text>
            {t('catalog.addItems', {
              count: items.length,
              unit: items.length > 1 ? t('catalog.items') : t('catalog.item'),
            })}
          </Text>
        </Button>
      </View>
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
  const [debouncedSearchValue] = useDebounce(searchValue, 400);

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

  // All unique items available (main list + popular + recent) for lookup
  const allAvailableItems = useMemo(() => {
    const map = new Map<number, CatalogItem>();
    for (const item of items) map.set(item.id, item);
    for (const item of popularItems) map.set(item.id, item);
    for (const item of recentItems) map.set(item.id, item);
    return map;
  }, [items, popularItems, recentItems]);

  const handleItemToggle = useCallback(
    (item: CatalogItem) => {
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

  const handleAddSelected = () => {
    const selectedCatalogItems = Array.from(selectedItems)
      .map((id) => allAvailableItems.get(id))
      .filter((item): item is CatalogItem => item !== undefined)
      .map((item) => ({ ...item, quantity: itemQuantities.get(item.id) ?? 1 }));
    onItemsSelected(selectedCatalogItems);
    resetSelection();
    onClose();
  };

  const resetSelection = () => {
    setSelectedItems(new Set());
    setItemQuantities(new Map());
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
        .map((id) => allAvailableItems.get(id))
        .filter((item): item is CatalogItem => item !== undefined),
    [selectedItems, allAvailableItems],
  );

  const renderItem = ({ item }: { item: CatalogItem }) => (
    <HorizontalCatalogItemCard
      item={item}
      selected={selectedItems.has(item.id)}
      onSelect={handleItemToggle}
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
            onItemToggle={handleItemToggle}
          />
        )}
        {showPopular && (
          <QuickAccessSection
            title={t('catalog.popularItems')}
            items={isPopularLoading ? [] : popularItems}
            selectedItems={selectedItems}
            onItemToggle={handleItemToggle}
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
    handleItemToggle,
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
              keyExtractor={(item) => item.id.toString()}
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

        {/* Bottom Actions with per-item quantity */}
        {selectedItems.size > 0 && (
          <SelectedItemsQuantityPanel
            items={selectedItemsList}
            quantities={itemQuantities}
            onQuantityChange={handleQuantityChange}
            onClear={resetSelection}
            onAdd={handleAddSelected}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
