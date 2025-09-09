import { Button, SearchInput, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { searchValueAtom } from 'expo-app/atoms/itemListAtoms';
import { CategoriesFilter } from 'expo-app/components/CategoriesFilter';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useAtom } from 'jotai';
import { useState } from 'react';
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
import { CatalogItemSelectCard } from './CatalogItemSelectCard';

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
  const [searchValue, setSearchValue] = useAtom(searchValueAtom);
  const [activeFilter, setActiveFilter] = useState<'All' | string>('All');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [debouncedSearchValue] = useDebounce(searchValue, 150);

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
    query: debouncedSearchValue,
    category: activeFilter === 'All' ? undefined : activeFilter,
    limit: 20,
    sort: { field: 'createdAt', order: 'desc' },
  });

  const {
    data: searchResults,
    isLoading: isSearchLoading,
    error: searchError,
  } = useVectorSearch(debouncedSearchValue);

  const items = isSearching
    ? searchResults || []
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
    const selectedCatalogItems = items.filter((item) => selectedItems.has(item.id));
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
    <CatalogItemSelectCard
      item={item}
      isSelected={selectedItems.has(item.id)}
      onToggle={() => handleItemToggle(item)}
    />
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-border p-4">
          <View className="flex-row items-center">
            <Text className="text-lg font-semibold">Browse Catalog</Text>
            {selectedItems.size > 0 && (
              <View className="ml-2 rounded-full bg-primary px-2 py-1">
                <Text className="text-xs text-primary-foreground">{selectedItems.size}</Text>
              </View>
            )}
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
            placeholder="Search catalog items..."
          />

          {categories && (
            <View className="mt-3">
              <CategoriesFilter
                activeFilter={activeFilter}
                onFilter={setActiveFilter}
                data={categories ? ['All', ...categories] : undefined}
              />
            </View>
          )}
        </View>

        {/* Items List */}
        <View className="flex-1">
          {isLoading && items.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text className="mt-2 text-muted-foreground">Loading catalog items...</Text>
            </View>
          ) : error ? (
            <View className="flex-1 items-center justify-center p-4">
              <Icon name="exclamation" size={48} color={colors.destructive} />
              <Text className="mt-2 text-center font-semibold">Error loading items</Text>
              <Text className="mt-1 text-center text-muted-foreground">{error.message}</Text>
              <Button className="mt-4" onPress={handleRefresh}>
                <Text>Try Again</Text>
              </Button>
            </View>
          ) : items.length === 0 ? (
            <View className="flex-1 items-center justify-center p-4">
              <Icon name="magnify" size={48} color={colors.grey2} />
              <Text className="mt-2 text-center font-semibold">No items found</Text>
              <Text className="mt-1 text-center text-muted-foreground">
                {isSearching ? 'Try adjusting your search' : 'No catalog items available'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderItem}
              contentContainerStyle={{ padding: 16 }}
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
            <View className="flex-row gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onPress={() => setSelectedItems(new Set())}
              >
                <Text>Clear Selection</Text>
              </Button>
              <Button className="flex-1" onPress={handleAddSelected}>
                <Text>Add {selectedItems.size} Items</Text>
              </Button>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}
