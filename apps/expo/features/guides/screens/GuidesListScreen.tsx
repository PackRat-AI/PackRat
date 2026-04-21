import { LargeTitleHeader, type LargeTitleSearchBarMethods, Text } from '@packrat/ui/nativewindui';
import { CategoriesFilter } from 'expo-app/components/CategoriesFilter';
import { LargeTitleHeaderSearchContentContainer } from 'expo-app/components/LargeTitleHeaderSearchContentContainer';
import TabScreen from 'expo-app/components/TabScreen';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { asNonNullableRef } from 'expo-app/lib/utils/asNonNullableRef';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { GuideCard } from '../components/GuideCard';
import { useGuideCategories, useGuides, useSearchGuides } from '../hooks';
import type { Guide } from '../types';

export const GuidesListScreen = () => {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(() => t('guides.all'));
  const searchBarRef = useRef<LargeTitleSearchBarMethods>(null);

  const {
    data: categories,
    error: categoriesError,
    refetch: refetchCategories,
  } = useGuideCategories();

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
          <ActivityIndicator color={colors.primary} size="large" />
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

  const renderSearchContent = () => {
    if (!isSearchMode) {
      return (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-muted-foreground">{t('guides.searchGuides')}</Text>
        </View>
      );
    }

    if (isLoading) {
      return (
        <View className="flex-1 items-center justify-center p-6">
          <ActivityIndicator className="text-primary" size="large" />
        </View>
      );
    }

    return (
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-4 pt-2">
          {guides.length > 0 && (
            <Text className="text-xs text-muted-foreground">
              {guides.length} {guides.length === 1 ? t('guides.result') : t('guides.results')}
            </Text>
          )}
        </View>

        {guides.map((guide: Guide) => (
          <View className="px-4 pt-4" key={guide.id}>
            <GuideCard guide={guide} onPress={() => handleGuidePress(guide)} />
          </View>
        ))}

        {guides.length === 0 && (
          <View className="flex-1 items-center justify-center p-8">
            <Text className="text-center text-gray-500 dark:text-gray-400">
              {t('guides.noGuidesFound', { query: searchQuery })}
            </Text>
          </View>
        )}
      </ScrollView>
    );
  };

  const listHeader = () => {
    if (isSearchMode) return null;

    return (
      <TabScreen useLegacySafeAreaView>
        <CategoriesFilter
          data={categories}
          onFilter={handleCategoryChange}
          activeFilter={selectedCategory}
          error={categoriesError}
          retry={refetchCategories}
          className="px-4 pb-2"
        />
      </TabScreen>
    );
  };

  return (
    <>
      <LargeTitleHeader
        title={t('guides.guides')}
        backVisible={false}
        searchBar={{
          iosHideWhenScrolling: false,
          ref: asNonNullableRef(searchBarRef),
          onChangeText: handleSearch,
          placeholder: t('guides.searchPlaceholder'),
          content: (
            <LargeTitleHeaderSearchContentContainer>
              {renderSearchContent()}
            </LargeTitleHeaderSearchContentContainer>
          ),
        }}
      />

      <FlatList
        data={guides}
        keyExtractor={(item) => item.id}
        renderItem={renderGuide}
        ListHeaderComponent={listHeader}
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
    </>
  );
};
