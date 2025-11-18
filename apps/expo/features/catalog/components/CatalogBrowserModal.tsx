import { Button, SearchInput, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { searchValueAtom } from 'expo-app/atoms/itemListAtoms';
import { CategoriesFilter } from 'expo-app/components/CategoriesFilter';
import { HorizontalCatalogItemCard } from 'expo-app/features/packs/components/HorizontalCatalogItemCard';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useAtom } from 'jotai';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  SafeAreaView,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDebounce } from 'use-debounce';
import { useCatalogItemsInfinite } from '../hooks';
import { useCatalogItemsCategories } from '../hooks/useCatalogItemsCategories';
import { useVectorSearch } from '../hooks/useVectorSearch';
import type { CatalogItem } from '../types';

type CatalogBrowserModalProps = {
  visible: boolean;
  onClose: () => void;
  onItemsSelected: (items: CatalogItem[]) => void;
};

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
  const [debouncedSearchValue] = useDebounce(searchValue, 400);

  const isSearching = debouncedSearchValue.length > 0;

  const { data: categories } = useCatalogItemsCategories();

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

  const handleItemToggle = (item: CatalogItem) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(item.id)) {
      newSelected.delete(item.id);
    } else {
      newSelected.add(item.id);
    }
    setSelectedItems(newSelected);
  };

  const handleAddSelected = () => {
    const selectedCatalogItems = items.filter((item: CatalogItem) => selectedItems.has(item.id));
    onItemsSelected(selectedCatalogItems);
    setSelectedItems(new Set());
    onClose();
  };

  const handleClose = () => {
    setSelectedItems(new Set());
    setSearchValue('');
    onClose();
  };

  const handleRefresh = () => {
    if (isSearching) {
      // For search, we can't really refresh, so just clear search
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

  const renderItem = ({ item }: { item: CatalogItem }) => (
    <HorizontalCatalogItemCard
      item={item}
      selected={selectedItems.has(item.id)}
      onSelect={handleItemToggle}
    />
  );

  const ItemSeparatorComponent = useMemo(() => () => <View className="h-2" />, []);

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
              <Text className="mt-2 text-center font-semibold">{t('catalog.errorLoadingItems')}</Text>
              <Text className="mt-1 text-center text-muted-foreground">{error.message}</Text>
              <Button className="mt-4" onPress={handleRefresh}>
                <Text>{t('catalog.tryAgain')}</Text>
              </Button>
            </View>
          ) : items.length === 0 ? (
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

        {/* Bottom Actions */}
        {selectedItems.size > 0 && (
          <View className="border-t border-border bg-card p-4">
            <View className="flex-row gap-3 items-center justify-end">
              <Button
                variant="secondary"
                className="mb-1"
                onPress={() => setSelectedItems(new Set())}
              >
                <Text>{t('catalog.clearSelection')}</Text>
              </Button>
              <Button onPress={handleAddSelected} className="mb-1" variant="tonal">
                <Text>
                  {t('catalog.addItems', {
                    count: selectedItems.size,
                    unit: selectedItems.size > 1 ? t('catalog.items') : t('catalog.item'),
                  })}
                </Text>
              </Button>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}
