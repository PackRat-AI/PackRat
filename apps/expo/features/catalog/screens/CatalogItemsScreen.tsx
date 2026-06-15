import { Text } from '@packrat/ui/nativewindui';
import { SearchOverlay } from '@packrat/ui/src/search-overlay';
import { catalogGroupVariantsAtom } from 'expo-app/atoms/catalogGroupAtom';
import { searchValueAtom } from 'expo-app/atoms/itemListAtoms';
import { AndroidTabBarInsetFix } from 'expo-app/components/AndroidTabBarInsetFix';
import { CategoriesFilter } from 'expo-app/components/CategoriesFilter';
import { Icon } from 'expo-app/components/Icon';
import { withAuthWall } from 'expo-app/features/auth/hocs';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { Stack, useRouter } from 'expo-router';
import { useAtom, useSetAtom } from 'jotai';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
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
import { type CatalogItemGroup, groupCatalogItems } from '../lib/groupCatalogItems';
import type { CatalogItem } from '../types';

function CatalogItemsScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useAtom(searchValueAtom);
  const [activeFilter, setActiveFilter] = useState<'All' | string>('All');
  const [isManualRefresh, setIsManualRefresh] = useState(false);

  const [debouncedSearchValue] = useDebounce(searchValue, 400);

  const isSearching = searchValue.trim().length > 0;
  const trimmedQuery = debouncedSearchValue.trim();
  const isQueryReady = trimmedQuery.length > 0;

  const {
    data: categories,
    error: categoriesError,
    refetch: refetchCategories,
  } = useCatalogItemsCategories();

  const {
    data: paginatedData,
    isLoading: isPaginatedLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    error: paginatedError,
  } = useCatalogItemsInfinite({
    category: activeFilter === 'All' ? undefined : activeFilter,
    limit: 80,
    sort: { field: 'createdAt', order: 'desc' },
  });

  const {
    data: vectorResult,
    isLoading: isVectorLoading,
    error: vectorError,
  } = useVectorSearch({ query: trimmedQuery, limit: 10 });
  const searchResults = vectorResult?.items ?? [];

  const paginatedItems = (paginatedData?.pages.flatMap((page) => page.items) ?? []).filter((item) =>
    Boolean(item?.id),
  );

  const groupedItems = useMemo(() => groupCatalogItems(paginatedItems), [paginatedItems]);

  const setGroupVariants = useSetAtom(catalogGroupVariantsAtom);

  const handleGroupPress = (group: CatalogItemGroup) => {
    setGroupVariants(group.variants);
    router.push({ pathname: '/catalog/[id]', params: { id: group.representative.id } });
  };

  const handleItemPress = (item: CatalogItem) => {
    router.push({ pathname: '/catalog/[id]', params: { id: item.id } });
  };
  const handleRefresh = async () => {
    setIsManualRefresh(true);
    await refetch();
    setIsManualRefresh(false);
  };

  const loadMore = () => {
    if (!isSearching && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const ItemSeparatorComponent = useMemo(() => () => <View className="h-2" />, []);

  const listHeader = useMemo(() => {
    if (isSearching) return null;

    return (
      <>
        <CategoriesFilter
          data={categories}
          onFilter={setActiveFilter}
          activeFilter={activeFilter}
          error={categoriesError}
          retry={refetchCategories}
          className="py-4"
          contentPaddingX={16}
        />
      </>
    );
  }, [isSearching, categories, activeFilter, categoriesError, refetchCategories]);

  return (
    <>
      <Stack.Screen
        options={{
          title: t('catalog.title'),
          headerLargeTitle: true,
          headerBackVisible: false,
        }}
      />
      <SearchOverlay
        placeholder={t('catalog.searchPlaceholder')}
        value={searchValue}
        onChangeText={setSearchValue}
      >
        {isVectorLoading || !isQueryReady ? (
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
                ) : isSearching ? (
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
                ) : (
                  <Text className="text-center text-muted-foreground">
                    {t('catalog.searchPlaceholder')}
                  </Text>
                )}
              </View>
            )}
          </ScrollView>
        )}
      </SearchOverlay>

      <FlatList
        data={groupedItems}
        keyExtractor={(group) => group.key}
        renderItem={({ item: group }) => (
          <View className="px-4">
            <CatalogItemCard item={group.representative} onPress={() => handleGroupPress(group)} />
          </View>
        )}
        ItemSeparatorComponent={ItemSeparatorComponent}
        ListHeaderComponent={listHeader}
        refreshControl={<RefreshControl refreshing={isManualRefresh} onRefresh={handleRefresh} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
        contentInsetAdjustmentBehavior="automatic"
        ListFooterComponent={
          <>
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
            <AndroidTabBarInsetFix />
          </>
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
      />
    </>
  );
}

export default withAuthWall({ Component: CatalogItemsScreen, AuthWall: CatalogItemsAuthWall });
