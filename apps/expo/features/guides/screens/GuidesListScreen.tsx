import { LargeTitleHeader, Text } from '@packrat/ui/nativewindui';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { GuideCard } from '../components/GuideCard';
import { useGuideCategories, useGuides, useSearchGuides } from '../hooks';
import type { Guide } from '../types';

export const GuidesListScreen = () => {
  const router = useRouter();
  const { colors } = useColorScheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const { data: categoriesData, isLoading: isLoadingCategories } = useGuideCategories();

  const {
    data: guidesData,
    isLoading: isLoadingGuides,
    refetch: refetchGuides,
    fetchNextPage: fetchNextPageGuides,
    hasNextPage: hasNextPageGuides,
    isFetchingNextPage: isFetchingNextPageGuides,
  } = useGuides({
    category: selectedCategory === 'all' ? undefined : selectedCategory,
  });

  const {
    data: searchData,
    isLoading: isSearching,
    refetch: refetchSearch,
    fetchNextPage: fetchNextPageSearch,
    hasNextPage: hasNextPageSearch,
    isFetchingNextPage: isFetchingNextPageSearch,
  } = useSearchGuides({
    query: searchQuery,
    category: selectedCategory === 'all' ? undefined : selectedCategory,
  });

  const isSearchMode = searchQuery.length > 0;
  const data = isSearchMode ? searchData : guidesData;
  const isLoading = isSearchMode ? isSearching : isLoadingGuides;
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
    if (isLoading) return null;

    return (
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-center text-gray-500 dark:text-gray-400">
          {isSearchMode ? `No guides found for "${searchQuery}"` : 'No guides available'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <FlatList
        data={guides}
        keyExtractor={(item) => item.id}
        renderItem={renderGuide}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && !isFetchingNextPage}
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
        ListHeaderComponent={
          <>
            <LargeTitleHeader
              title="Guides"
              searchBar={{
                iosHideWhenScrolling: true,
                onChangeText: handleSearch,
                placeholder: 'Search guides...',
              }}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="py-3"
              contentContainerStyle={{ paddingRight: 16 }}
            >
              <TouchableOpacity
                onPress={() => handleCategoryChange('all')}
                className={`mr-2 rounded-full px-4 py-2 ${
                  selectedCategory === 'all' ? 'bg-primary' : 'bg-card'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    selectedCategory === 'all' ? 'text-primary-foreground' : 'text-foreground'
                  }`}
                >
                  All
                </Text>
              </TouchableOpacity>
              {isLoadingCategories
                ? Array.from({ length: 6 }).map(() => (
                    <View
                      key={Math.random().toString()}
                      className="h-9 w-24 rounded-full mr-2 bg-neutral-300 dark:bg-neutral-600 animate-pulse"
                    />
                  ))
                : categoriesData?.categories?.map((category: string) => (
                    <TouchableOpacity
                      key={category}
                      onPress={() => handleCategoryChange(category)}
                      className={`mr-2 rounded-full px-4 py-2 ${
                        selectedCategory === category ? 'bg-primary' : 'bg-card'
                      }`}
                    >
                      <Text
                        className={`text-sm font-medium ${
                          selectedCategory === category
                            ? 'text-primary-foreground'
                            : 'text-foreground'
                        }`}
                      >
                        {category
                          .split('-')
                          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
            </ScrollView>
          </>
        }
      />
    </SafeAreaView>
  );
};
