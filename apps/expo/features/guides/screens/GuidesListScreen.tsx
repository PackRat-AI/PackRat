import { getAppBarOptions } from '@packrat/ui/src/app-bar';
import { Button } from '@packrat/ui/src/button';
import { IosTransparentHeaderOverlapFix } from '@packrat/ui/src/ios-transparent-header-overlap-fix';
import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { SearchOverlay } from '@packrat/ui/src/search-overlay';
import { Text } from '@packrat/ui/src/text';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useRouter } from 'expo-router';
import { type ReactElement, useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useDebounce } from 'use-debounce';
import { GuideCard } from '../components/GuideCard';
import { GuideCardSkeleton } from '../components/GuideCardSkeleton';
import { GuideCategoryChips } from '../components/GuideCategoryChips';
import { GuidesMessage } from '../components/GuidesMessage';
import { useGuideCategories, useGuides, useSearchGuides } from '../hooks';
import { guideCategoryLabel } from '../lib/categories';
import type { Guide } from '../types';

const NEWEST_FIRST = Object.freeze({ field: 'createdAt', order: 'desc' } as const);
const SKELETON_COUNT = 4;
const LIST_PADDING = Object.freeze({ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 });

const keyExtractor = (item: Guide) => item.id;

function Skeletons() {
  return (
    <View>
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <GuideCardSkeleton key={i} />
      ))}
    </View>
  );
}

/** Last list row: a spinner while the next page loads, or a retry if it failed. */
function PageFooter({
  isFetching,
  isError,
  onRetry,
}: {
  isFetching: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const { colors } = useColorScheme();
  const { t } = useTranslation();

  if (isFetching) {
    return (
      <View className="items-center py-4">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (isError) {
    return (
      <View className="items-center gap-2 py-4">
        <Text className="text-sm text-muted-foreground">{t('guides.loadMoreFailed')}</Text>
        <Button variant="text" onPress={onRetry}>
          <Text>{t('guides.tryAgain')}</Text>
        </Button>
      </View>
    );
  }
  return null;
}

export const GuidesListScreen = () => {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery.trim(), 300);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [isManualRefresh, setIsManualRefresh] = useState(false);

  const { data: categories } = useGuideCategories();
  const guidesQuery = useGuides({ category, sort: NEWEST_FIRST });
  const searchQueryResult = useSearchGuides({ query: debouncedQuery });

  const guides = guidesQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const results = searchQueryResult.data?.pages.flatMap((page) => page.items) ?? [];
  const resultCount = searchQueryResult.data?.pages[0]?.totalCount ?? results.length;

  const openGuide = useCallback(
    (guide: Guide) => {
      router.push({ pathname: '/guides/[id]', params: { id: guide.id } });
    },
    [router],
  );

  const renderGuide = useCallback(
    ({ item }: { item: Guide }) => (
      <GuideCard
        guide={item}
        onPress={() => openGuide(item)}
        testID={testIds.guides.card(item.id)}
      />
    ),
    [openGuide],
  );

  const handleRefresh = async () => {
    setIsManualRefresh(true);
    await guidesQuery.refetch();
    setIsManualRefresh(false);
  };

  const renderLibraryEmpty = (): ReactElement => {
    if (guidesQuery.isLoading) return <Skeletons />;
    if (guidesQuery.isError) {
      return (
        <GuidesMessage
          icon="error"
          title={t('guides.loadFailedTitle')}
          body={t('guides.checkConnection')}
          action={{ label: t('guides.tryAgain'), onPress: () => guidesQuery.refetch() }}
        />
      );
    }
    if (category) {
      return (
        <GuidesMessage
          icon="empty"
          title={t('guides.emptyCategoryTitle', {
            category: guideCategoryLabel({ slug: category, t }),
          })}
          action={{ label: t('guides.showAllGuides'), onPress: () => setCategory(undefined) }}
        />
      );
    }
    return (
      <GuidesMessage icon="empty" title={t('guides.emptyTitle')} body={t('guides.emptyBody')} />
    );
  };

  const renderSearch = () => {
    if (!searchQuery.trim()) {
      return (
        <View className="flex-1 items-center px-8 pt-16">
          <Text className="text-center text-sm text-muted-foreground">
            {t('guides.searchHint')}
          </Text>
        </View>
      );
    }
    // Between a keystroke and the debounced request there is nothing new to show yet; keep the
    // placeholders up rather than flashing "No results".
    if (searchQueryResult.isLoading || debouncedQuery !== searchQuery.trim()) {
      return (
        <View style={LIST_PADDING} className="pt-4">
          <Skeletons />
        </View>
      );
    }
    if (searchQueryResult.isError) {
      return (
        <GuidesMessage
          icon="error"
          title={t('guides.loadFailedTitle')}
          body={t('guides.checkConnection')}
          action={{ label: t('guides.tryAgain'), onPress: () => searchQueryResult.refetch() }}
        />
      );
    }
    if (results.length === 0) {
      return (
        <GuidesMessage
          icon="search"
          title={t('guides.noResultsTitle', { query: debouncedQuery })}
          body={t('guides.noResultsBody')}
        />
      );
    }
    return (
      <FlatList
        data={results}
        keyExtractor={keyExtractor}
        renderItem={renderGuide}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <Text className="pb-3 pt-4 text-xs font-medium text-muted-foreground">
            {t('guides.resultCount', { count: resultCount })}
          </Text>
        }
        ListFooterComponent={
          <PageFooter
            isFetching={searchQueryResult.isFetchingNextPage}
            isError={searchQueryResult.isFetchNextPageError}
            onRetry={() => searchQueryResult.fetchNextPage()}
          />
        }
        onEndReached={() => {
          if (searchQueryResult.hasNextPage && !searchQueryResult.isFetchingNextPage) {
            searchQueryResult.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        contentContainerStyle={LIST_PADDING}
      />
    );
  };

  return (
    <>
      <Stack.Screen options={{ ...getAppBarOptions(), title: t('guides.guides') }} />
      <SearchOverlay
        placeholder={t('guides.searchPlaceholder')}
        value={searchQuery}
        onChangeText={setSearchQuery}
      >
        {renderSearch()}
      </SearchOverlay>

      <View className="flex-1 bg-background">
        <IosTransparentHeaderOverlapFix />
        {/* Rendered from the first frame with just "All", so the list never shifts down when the
            topics arrive. */}
        <GuideCategoryChips
          categories={categories ?? []}
          selected={category}
          onSelect={setCategory}
        />
        <FlatList
          data={guides}
          keyExtractor={keyExtractor}
          renderItem={renderGuide}
          contentContainerStyle={[LIST_PADDING, { flexGrow: 1 }]}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            <RefreshControl
              refreshing={isManualRefresh}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          onEndReached={() => {
            if (guidesQuery.hasNextPage && !guidesQuery.isFetchingNextPage) {
              guidesQuery.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            <PageFooter
              isFetching={guidesQuery.isFetchingNextPage}
              isError={guidesQuery.isFetchNextPageError}
              onRetry={() => guidesQuery.fetchNextPage()}
            />
          }
          ListEmptyComponent={renderLibraryEmpty()}
        />
      </View>
    </>
  );
};
