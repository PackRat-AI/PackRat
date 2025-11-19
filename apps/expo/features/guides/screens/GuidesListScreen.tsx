import { LargeTitleHeader, Text } from '@packrat/ui/nativewindui';
import { CategoriesFilter } from 'expo-app/components/CategoriesFilter';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, SafeAreaView, View } from 'react-native';
import { GuideCard } from '../components/GuideCard';
import { useGuideCategories, useGuides, useSearchGuides } from '../hooks';
import type { Guide } from '../types';

export const GuidesListScreen = () => {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(() => t('guides.all'));

  const { data: categoriesData } = useGuideCategories();

  const categories = [
    t('guides.all'),
    ...(categoriesData?.categories.map((category: string) =>
      category
        .split('-')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
    ) || []),
  ];

  const {
    data: guidesData,
    isLoading: isLoadingGuides,
    isRefetching: isRefetchingGuides,
    refetch: refetchGuides,
    fetchNextPage: fetchNextPageGuides,
    hasNextPage: hasNextPageGuides,
    isFetchingNextPage: isFetchingNextPageGuides,
  } = useGuides({
    category:
      selectedCategory === t('guides.all')
        ? undefined
        : selectedCategory.toLocaleLowerCase().replaceAll(' ', '-'),
  });

  const {
    data: searchData,
    isLoading: isSearching,
    isRefetching: isRefetchingSearch,
    refetch: refetchSearch,
    fetchNextPage: fetchNextPageSearch,
    hasNextPage: hasNextPageSearch,
    isFetchingNextPage: isFetchingNextPageSearch,
  } = useSearchGuides({
    query: searchQuery,
    category:
      selectedCategory === t('guides.all')
        ? undefined
        : selectedCategory.toLocaleLowerCase().replaceAll(' ', '-'),
  });

  const isSearchMode = searchQuery.length > 0;
  const data = isSearchMode ? searchData : guidesData;
  const isLoading = isSearchMode ? isSearching : isLoadingGuides;
  const isRefetching = isSearchMode ? isRefetchingSearch : isRefetchingGuides;
  const refetch = isSearchMode ? refetchSearch : refetchGuides;
  const fetchNextPage = isSearchMode ? fetchNextPageSearch : fetchNextPageGuides;
  const hasNextPage = isSearchMode ? hasNextPageSearch : hasNextPageGuides;
  const isFetchingNextPage = isSearchMode ? isFetchingNextPageSearch : isFetchingNextPageGuides;

  const guides = data?.pages.flatMap((page) => page.items) || [];

  const handleGuidePress = useCallback(
    (guide: Guide) => {
      router.push({
        pathname: '/guides/[id]',
        params: { id: guide.id },
      });
    },
    [router],
  );

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const handleCategoryChange = useCallback((category: string) => {
    setSelectedCategory(category);
  }, []);

  const renderGuide = ({ item }: { item: Guide }) => (
    <GuideCard guide={item} onPress={() => handleGuidePress(item)} />
  );

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View className="py-4">
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  const renderEmpty = () => {
    return (
      <View className="flex-1 items-center justify-center p-8">
        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text className="text-center text-gray-500 dark:text-gray-400">
            {isSearchMode
              ? t('guides.noGuidesFound', { query: searchQuery })
              : t('guides.noGuidesAvailable')}
          </Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1">
      <LargeTitleHeader
        title={t('guides.guides')}
        searchBar={{
          iosHideWhenScrolling: true,
          onChangeText: handleSearch,
          placeholder: t('guides.searchPlaceholder'),
        }}
      />

      <CategoriesFilter
        data={categories}
        onFilter={handleCategoryChange}
        activeFilter={selectedCategory}
      />

      <FlatList
        data={guides}
        keyExtractor={(item) => item.id}
        renderItem={renderGuide}
        contentContainerStyle={{ paddingHorizontal: 16, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
      />
    </SafeAreaView>
  );
};
