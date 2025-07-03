import { LargeTitleHeader } from '@packrat/ui/nativewindui/LargeTitleHeader';
import { Text } from '@packrat/ui/nativewindui/Text';
import { Icon } from '@roninoss/icons';
import { searchValueAtom } from 'expo-app/atoms/itemListAtoms';
import { withAuthWall } from 'expo-app/features/auth/hocs';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useRouter } from 'expo-router';
import { useAtom } from 'jotai';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDebounce } from 'use-debounce';
import { CatalogItemsAuthWall } from '../components';
import { CatalogCategoriesFilter } from '../components/CatalogCategoriesFilter';
import { CatalogItemCard } from '../components/CatalogItemCard';
import { useCatalogItemsInfinite } from '../hooks';
import { useVectorSearch } from '../hooks/useVectorSearch';
import type { CatalogItem } from '../types';

function CatalogItemsScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const [searchValue, setSearchValue] = useAtom(searchValueAtom);
  const [activeFilter, setActiveFilter] = useState<'All' | string>('All');
  const [debouncedSearchValue] = useDebounce(searchValue, 150);

  const isSearching = debouncedSearchValue.length > 0;

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
    sort: { field: 'createdAt', order: 'asc' },
  });

  // Disabled for now
  const {
    data: vectorResults,
    isLoading: isVectorLoading,
    isFetching: isVectorFetching,
    error: vectorError,
  } = useVectorSearch('');

  const paginatedItems: CatalogItem[] = (
    paginatedData?.pages.flatMap((page) => page.items) ?? []
  ).filter((item) => Boolean(item?.id));

  const results = vectorResults ?? paginatedItems;

  const isLoading = isPaginatedLoading;
  const totalItems = paginatedData?.pages[0]?.totalCount ?? 0;

  const totalItemsText = `${Number(totalItems).toLocaleString()} ${
    totalItems === 1 ? 'item' : 'items'
  }`;
  const showingText = `Showing ${paginatedItems.length} of ${Number(totalItems).toLocaleString()} items`;

  const handleItemPress = (item: CatalogItem) => {
    router.push({ pathname: '/catalog/[id]', params: { id: item.id } });
  };

  const loadMore = () => {
    if (!isSearching && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  return (
    <SafeAreaView className="flex-1">
      <LargeTitleHeader
        title="Catalog"
        backVisible={false}
        searchBar={{
          iosHideWhenScrolling: true,
          onChangeText: setSearchValue,
          placeholder: 'Search catalog items...',
          content: isSearching ? (
            isLoading ? (
              <View className="flex-1 items-center justify-center p-6">
                <ActivityIndicator className="text-primary" size="large" />
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                <View className="px-4 pt-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-muted-foreground">{totalItemsText}</Text>
                    {results.length > 0 && (
                      <Text className="text-xs text-muted-foreground">
                        {results.length} results
                      </Text>
                    )}
                  </View>
                </View>
                {results.map((item) => (
                  <View className="px-4 pt-4" key={item.id}>
                    <CatalogItemCard item={item} onPress={() => handleItemPress(item)} />
                  </View>
                ))}
                {results.length === 0 && (
                  <View className="flex-1 items-center justify-center p-8">
                    {vectorError ? (
                      <>
                        <View className="bg-destructive/10 mb-4 rounded-full p-4">
                          <Icon name="close-circle" size={32} color="text-destructive" />
                        </View>
                        <Text className="mb-1 text-lg font-medium text-foreground">
                          Search error
                        </Text>
                        <Text className="text-center text-muted-foreground">
                          Unable to search. Please try again.
                        </Text>
                      </>
                    ) : (
                      <>
                        <View className="mb-4 rounded-full bg-muted p-4">
                          <Icon name="magnify" size={32} color="text-muted-foreground" />
                        </View>
                        <Text className="mb-1 text-lg font-medium text-foreground">No results</Text>
                        <Text className="text-center text-muted-foreground">
                          Try adjusting your search or filters.
                        </Text>
                      </>
                    )}
                  </View>
                )}
              </ScrollView>
            )
          ) : (
            <View className="flex-1 items-center justify-center p-4">
              <Text className="text-muted-foreground">Search catalog</Text>
            </View>
          ),
        }}
      />

      <CatalogCategoriesFilter onFilter={setActiveFilter} activeFilter={activeFilter} />

      {!isSearching && (
        <FlatList
          key={activeFilter}
          data={paginatedItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View className="px-4 pt-4">
              <CatalogItemCard item={item} onPress={() => handleItemPress(item)} />
            </View>
          )}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            <View className="py-4">
              {isFetchingNextPage ? (
                <ActivityIndicator className="text-primary" size="large" />
              ) : hasNextPage ? (
                <Text className="text-center text-xs text-muted-foreground">
                  Scroll to load more items
                </Text>
              ) : paginatedItems.length > 0 ? (
                <Text className="text-center text-xs text-muted-foreground">
                  You've reached the end of the catalog
                </Text>
              ) : null}
            </View>
          }
          ListHeaderComponent={
            <View className="px-4 pb-0 pt-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-muted-foreground">{totalItemsText}</Text>
              </View>
              {paginatedItems.length > 0 && (
                <Text className="mt-1 text-xs text-muted-foreground">{showingText}</Text>
              )}
            </View>
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center p-8">
              {isPaginatedLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : paginatedError ? (
                <>
                  <View className="bg-destructive/10 mb-4 rounded-full p-4">
                    <Icon name="close-circle" size={32} color="text-destructive" />
                  </View>
                  <Text className="mb-1 text-lg font-medium text-foreground">
                    Error loading items
                  </Text>
                  <Text className="text-center text-muted-foreground">
                    {paginatedError.message || 'Something went wrong. Please try again.'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => refetch()}
                    className="mt-4 rounded-lg bg-primary px-4 py-2"
                  >
                    <Text className="font-medium text-primary-foreground">Retry</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View className="mb-4 rounded-full bg-muted p-4">
                    <Icon name="magnify" size={32} color="text-muted-foreground" />
                  </View>
                  <Text className="mb-1 text-lg font-medium text-foreground">No items found</Text>
                  <Text className="text-center text-muted-foreground">
                    Try a different category or refresh.
                  </Text>
                </>
              )}
            </View>
          }
          contentContainerStyle={{ flexGrow: 1 }}
        />
      )}
    </SafeAreaView>
  );
}

export default withAuthWall(CatalogItemsScreen, CatalogItemsAuthWall);
