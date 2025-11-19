import { LargeTitleHeader, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { searchValueAtom } from 'expo-app/atoms/itemListAtoms';
import { CategoriesFilter } from 'expo-app/components/CategoriesFilter';
import { withAuthWall } from 'expo-app/features/auth/hocs';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { useAtom } from 'jotai';
import { useMemo, useState } from 'react';
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
import { CatalogItemCard } from '../components/CatalogItemCard';
import { useCatalogItemsInfinite } from '../hooks';
import { useCatalogItemsCategories } from '../hooks/useCatalogItemsCategories';
import { useVectorSearch } from '../hooks/useVectorSearch';
import type { CatalogItem } from '../types';

function CatalogItemsScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useAtom(searchValueAtom);
  const [activeFilter, setActiveFilter] = useState<'All' | string>('All');
  const [debouncedSearchValue] = useDebounce(searchValue, 400);

  const isSearching = debouncedSearchValue.length > 0;

  const {
    data: categories,
    error: categoriesError,
    refetch: refetchCategories,
  } = useCatalogItemsCategories();

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
    sort: { field: 'usage', order: 'desc' },
  });

  const {
    data: vectorResult,
    isLoading: isVectorLoading,
    isFetching: _isVectorFetching,
    error: vectorError,
  } = useVectorSearch({ query: debouncedSearchValue, limit: 10 });
  const searchResults = vectorResult?.items;

  const paginatedItems: CatalogItem[] = (
    paginatedData?.pages.flatMap((page) => page.items) ?? []
  ).filter((item) => Boolean(item?.id));

  const totalItems = paginatedData?.pages[0]?.totalCount ?? 0;

  const totalItemsText = `${Number(totalItems).toLocaleString()} ${
    totalItems === 1 ? t('catalog.item') : t('catalog.items')
  }`;
  const showingText = t('catalog.showingItems', {
    current: paginatedItems.length,
    total: Number(totalItems).toLocaleString(),
  });

  const handleItemPress = (item: CatalogItem) => {
    router.push({ pathname: '/catalog/[id]', params: { id: item.id } });
  };

  const loadMore = () => {
    if (!isSearching && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const ItemSeparatorComponent = useMemo(() => () => <View className="h-2" />, []);

  return (
    <SafeAreaView className="flex-1">
      <LargeTitleHeader
        title={t('catalog.title')}
        backVisible={false}
        searchBar={{
          iosHideWhenScrolling: false,
          onChangeText: setSearchValue,
          placeholder: t('catalog.searchPlaceholder'),
          content: (
            <View style={{ flex: 1, backgroundColor: colors.background }}>
              {isSearching ? (
                isVectorLoading ? (
                  <View className="flex-1 items-center justify-center p-6">
                    <ActivityIndicator className="text-primary" size="large" />
                  </View>
                ) : (
                  <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                    <View className="px-4 pt-2">
                      {searchResults.length > 0 && (
                        <Text className="text-xs text-muted-foreground">
                          {searchResults.length} {t('catalog.results')}
                        </Text>
                      )}
                    </View>
                    {searchResults.map((item: CatalogItem) => (
                      <View className="px-4 pt-4" key={item.id}>
                        <CatalogItemCard item={item} onPress={() => handleItemPress(item)} />
                      </View>
                    ))}
                    {searchResults.length === 0 && (
                      <View className="flex-1 items-center justify-center p-8">
                        {vectorError ? (
                          <>
                            <View className="bg-destructive/10 mb-4 rounded-full p-4">
                              <Icon name="close-circle" size={32} color="text-destructive" />
                            </View>
                            <Text className="mb-1 text-lg font-medium text-foreground">
                              {t('catalog.searchError')}
                            </Text>
                            <Text className="text-center text-muted-foreground">
                              {t('catalog.unableToSearch')}
                            </Text>
                          </>
                        ) : (
                          <>
                            <View className="mb-4 rounded-full bg-muted p-4">
                              <Icon name="magnify" size={32} color="text-muted-foreground" />
                            </View>
                            <Text className="mb-1 text-lg font-medium text-foreground">
                              {t('catalog.noResults')}
                            </Text>
                            <Text className="text-center text-muted-foreground">
                              {t('catalog.tryAdjustingFilters')}
                            </Text>
                          </>
                        )}
                      </View>
                    )}
                  </ScrollView>
                )
              ) : (
                <View className="flex-1 items-center justify-center p-4">
                  <Text className="text-muted-foreground">{t('catalog.searchCatalog')}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />

      <CategoriesFilter
        data={categories}
        onFilter={setActiveFilter}
        activeFilter={activeFilter}
        error={categoriesError}
        retry={refetchCategories}
        className="px-4 py-2"
      />

      <FlatList
        key={activeFilter}
        data={paginatedItems}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <CatalogItemCard item={item} onPress={() => handleItemPress(item)} />
        )}
        ItemSeparatorComponent={ItemSeparatorComponent}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          <View className="py-4">
            {isFetchingNextPage ? (
              <ActivityIndicator className="text-primary" />
            ) : hasNextPage ? (
              <Text className="text-center text-xs text-muted-foreground">
                {t('catalog.scrollToLoadMore')}
              </Text>
            ) : paginatedItems.length > 0 ? (
              <Text className="text-center text-xs text-muted-foreground">
                {t('catalog.endOfCatalog')}
              </Text>
            ) : null}
          </View>
        }
        ListHeaderComponent={
          <View className="mb-4">
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
              <ActivityIndicator color={colors.primary} size="large" />
            ) : paginatedError ? (
              <>
                <View className="bg-destructive/10 mb-4 rounded-full p-4">
                  <Icon name="close" size={32} color="text-destructive" />
                </View>
                <Text className="mb-1 text-lg font-medium text-foreground">
                  {t('catalog.errorLoadingItems')}
                </Text>
                <Text className="text-center text-muted-foreground">
                  {paginatedError.message || t('catalog.somethingWentWrong')}
                </Text>
                <TouchableOpacity
                  onPress={() => refetch()}
                  className="mt-4 rounded-lg bg-primary px-4 py-2"
                >
                  <Text className="font-medium text-primary-foreground">{t('catalog.retry')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View className="mb-4 rounded-full bg-muted p-4">
                  <Icon name="magnify" size={32} color="text-muted-foreground" />
                </View>
                <Text className="mb-1 text-lg font-medium text-foreground">
                  {t('catalog.noItemsFound')}
                </Text>
                <Text className="text-center text-muted-foreground">
                  {t('catalog.tryDifferentCategory')}
                </Text>
              </>
            )}
          </View>
        }
        contentContainerStyle={{ flexGrow: 1, padding: 16 }}
      />
    </SafeAreaView>
  );
}

export default withAuthWall(CatalogItemsScreen, CatalogItemsAuthWall);
