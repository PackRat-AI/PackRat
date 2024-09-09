import React, { useMemo, useState } from 'react';
import { FlatList, View, Platform } from 'react-native';
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

interface FeedItem {
  id: string;
  type: string;
}

interface SelectedTypes {
  pack: boolean;
  trip: boolean;
}

interface FeedProps {
  feedType?: string;
}

interface UseFeedResult {
  data: any[] | null;
  error: any | null;
  isLoading: boolean;
  refetch: () => void;
}

const Feed = ({ feedType = 'public' }: FeedProps) => {
  const router = useRouter();

  const [queryString, setQueryString] = useState('Favorite');
  const [selectedTypes, setSelectedTypes] = useState({
    pack: true,
    trip: false,
  });
  const [selectedTrips, setSelectedTrips] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [refreshing, setRefreshing] = useState(false);

  const user = useAuthUser();
  const ownerId = user?.id;

  const styles = useCustomStyles(loadStyles);
  const { data, error, isLoading, refetch } = useFeed({
    queryString,
    ownerId,
    feedType,
    selectedTypes,
  }) as UseFeedResult;

  const onRefresh = () => {
    setRefreshing(true);
    refetch();
    setRefreshing(false);
  };

  let arrayData = data;

  const filteredData = useMemo(() => {
    if (!arrayData) {
      return [];
    }
    // Fuse search
    const keys = ['name', 'items.name', 'items.category'];
    const options = {
      threshold: 0.4,
      location: 0,
      distance: 100,
      maxPatternLength: 32,
      minMatchCharLength: 1,
    };

    const results = fuseSearch(arrayData, searchQuery, keys, options);

    // Convert fuse results back into the format we want
    // if searchQuery is empty, use the original data
    return searchQuery ? results.map((result) => result.item) : data;
  }, [searchQuery, data]);

  /**
   * Renders the data for the feed based on the feed type and search query.
   *
   * @return {ReactNode} The rendered feed data.
   */

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

  const urlPath = URL_PATHS[feedType];
  const createUrlPath = URL_PATHS[feedType] + 'create';
  const errorText = ERROR_MESSAGES[feedType];

  const handleCreateClick = () => {
    // handle create click logic
    router.push(createUrlPath);
  };

  return (
    <View style={styles.mainContainer}>
      <SearchProvider>
        <View
          style={{ flex: 1, paddingBottom: Platform.OS === 'web' ? 10 : 0 }}
        >
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
            keyExtractor={(item) => item?.id + item?.type}
            renderItem={({ item }) => (
              <FeedCard
                key={item?.id}
                item={item}
                cardType="primary"
                feedType={item.type}
              />
            )}
            ListFooterComponent={() => <View style={{ height: 50 }} />}
            ListEmptyComponent={() => (
              <RText style={{ textAlign: 'center', marginTop: 20 }}>
                {ERROR_MESSAGES[feedType]}
              </RText>
            )}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            maxToRenderPerBatch={2}
          />
        </View>
      </SearchProvider>
    </View>
  );
};

const loadStyles = (theme) => {
  const { currentTheme } = theme;
  return {
    mainContainer: {
      flex: 1,
      backgroundColor: currentTheme.colors.background,
      fontSize: 18,
      padding: 15,
      ...(Platform.OS !== 'web' && { paddingBottom: 15, paddingTop: 0 }),
    },
    // filterContainer: {
    //   backgroundColor: currentTheme.colors.card,
    //   padding: 15,
    //   fontSize: 18,
    //   width: '100%',
    //   borderRadius: 10,
    //   marginTop: 20,
    // },
    // searchContainer: {
    //   flexDirection: 'row',
    //   alignItems: 'center',
    //   justifyContent: 'center',
    //   marginBottom: 10,
    //   padding: 10,
    //   borderRadius: 5,
    // },
    // cardContainer: {
    //   flexDirection: 'row',
    //   flexWrap: 'wrap',
    //   justifyContent: 'space-around',
    //   alignItems: 'center',
    // },
  };
};

export default disableScreen(Feed, (props) => props.feedType === 'userTrips');
