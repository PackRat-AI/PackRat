import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { FlatList, View, Platform, ActivityIndicator } from 'react-native';
import { FeedCard, FeedSearchFilter, SearchProvider } from '../components';
import { useRouter } from 'app/hooks/router';
import { fuseSearch } from 'app/utils/fuseSearch';
import useCustomStyles from 'app/hooks/useCustomStyles';
import { useFeed } from 'app/modules/feed';
import { RefreshControl } from 'react-native';
import { RText } from '@packrat/ui';
import { useAuthUser } from 'app/modules/auth';
import { disableScreen } from 'app/hoc/disableScreen';

const URL_PATHS = {
  userPacks: '/pack/',
  favoritePacks: '/pack/',
  userTrips: '/trip/',
};

const ERROR_MESSAGES = {
  public: 'No Public Feed Data Available',
  userPacks: 'No User Packs Available',
  favoritePacks: 'No Favorite Packs Available',
  userTrips: 'No User Trips Available',
};

interface FeedProps {
  feedType?: string;
}

const Feed = ({ feedType = 'public' }: FeedProps) => {
  const router = useRouter();
  const [queryString, setQueryString] = useState('Favorite');
  const [selectedTypes, setSelectedTypes] = useState({
    pack: true,
    trip: false,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const user = useAuthUser();
  const ownerId = user?.id;
  const styles = useCustomStyles(loadStyles);

  // Fetch feed data using the useFeed hook
  const { data, isLoading, hasMore, fetchNextPage, refetch, isFetchingNextPage } = useFeed({
    queryString,
    ownerId,
    feedType,
    selectedTypes,
  });

  // Refresh data
  const onRefresh = () => {
    setRefreshing(true);
    refetch && refetch(); // Ensure refetch is defined
    setRefreshing(false);
  };

  // Fetch more data when reaching the end, but strictly ensure only one fetch at a time
  const fetchMoreData = useCallback(async () => {
    if (!isFetchingNextPage && hasMore && !isLoading) {
      await fetchNextPage(); // Call to fetch the next page
    }
  }, [isFetchingNextPage, hasMore, isLoading, fetchNextPage]);

  // Web-specific scroll detection
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleScroll = () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;

        if (scrollTop + windowHeight >= documentHeight - 50 && !isFetchingNextPage && hasMore) {
          fetchMoreData();
        }
      };

      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll); // Cleanup
    }
  }, [isFetchingNextPage, hasMore, isLoading, fetchMoreData]);

  // Filter data based on search query
  const filteredData = useMemo(() => {
    if (!data) return [];
    const keys = ['name', 'items.name', 'items.category'];
    const options = {
      threshold: 0.4,
      location: 0,
      distance: 100,
      maxPatternLength: 32,
      minMatchCharLength: 1,
    };
    const results = fuseSearch(data, searchQuery, keys, options);
    return searchQuery ? results.map((result) => result.item) : data;
  }, [searchQuery, data]);

  const handleTogglePack = () => {
    setSelectedTypes((prevState) => ({
      ...prevState,
      pack: !prevState.pack,
    }));
  };

  const handleToggleTrip = () => {
    setSelectedTypes((prevState) => ({
      ...prevState,
      trip: !prevState.trip,
    }));
  };

  const handleSortChange = (value) => {
    setQueryString(value);
  };

  const handleCreateClick = () => {
    const createUrlPath = URL_PATHS[feedType] + 'create';
    router.push(createUrlPath);
  };

  return (
    <View style={styles.mainContainer}>
      <SearchProvider>
        <View style={{ flex: 1, paddingBottom: Platform.OS === 'web' ? 10 : 0 }}>
          <FeedSearchFilter
            feedType={feedType}
            handleSortChange={handleSortChange}
            handleTogglePack={handleTogglePack}
            handleToggleTrip={handleToggleTrip}
            selectedTypes={selectedTypes}
            queryString={queryString}
            setSearchQuery={setSearchQuery}
            handleCreateClick={handleCreateClick}
          />
          <FlatList
            data={filteredData}
            horizontal={false}
            ItemSeparatorComponent={() => (
              <View style={{ height: 12, width: '100%' }} />
            )}
            keyExtractor={(item, index) => `${item?.id}_${item?.type}_${index}`} // Ensure unique keys
            renderItem={({ item }) => (
              <FeedCard
                key={item?.id}
                item={item}
                cardType="primary"
                feedType={item.type}
              />
            )}
            ListFooterComponent={() =>
              isFetchingNextPage || isLoading ? (
                <ActivityIndicator size="small" color="#0000ff" />
              ) : (
                <View style={{ height: 50 }} />
              )
            }
            ListEmptyComponent={() => (
              <RText style={{ textAlign: 'center', marginTop: 20 }}>
                {ERROR_MESSAGES[feedType]}
              </RText>
            )}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            onEndReached={fetchMoreData} // Trigger next page fetch
            onEndReachedThreshold={0.1} // Trigger earlier when close to the bottom
            initialNumToRender={6} // Render more items initially to ensure scrolling
            maxToRenderPerBatch={3} // Ensure more items are rendered in a batch to avoid stopping scroll
            showsVerticalScrollIndicator={false}
          />
        </View>
      </SearchProvider>
    </View>
  );
};

const loadStyles = (theme) => ({
  mainContainer: {
    flex: 1,
    backgroundColor: theme.currentTheme.colors.background,
    fontSize: 18,
    padding: 15,
    ...(Platform.OS !== 'web' && { paddingBottom: 15, paddingTop: 0 }),
  },
});

export default disableScreen(Feed, (props) => props.feedType === 'userTrips');
