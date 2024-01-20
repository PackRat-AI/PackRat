import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FlatList, View, ScrollView, Platform } from 'react-native';
import Card from '../../components/feed/FeedCard';
import {
  getPublicPacks,
  getPublicTrips,
  getFavoritePacks,
} from '../../store/feedStore';
import {
  changePackStatus,
  fetchUserPacks,
  selectAllPacks,
} from '../../store/packsStore';
// import { fetchUserTrips, selectAllTrips } from '../../store/tripsStore';
import { usefetchTrips } from 'app/hooks/trips';
import { useRouter } from 'app/hooks/router';
import { fuseSearch } from '../../utils/fuseSearch';
import { fetchUserFavorites } from '../../store/favoritesStore';
import useCustomStyles from 'app/hooks/useCustomStyles';
import FeedSearchFilter from 'app/components/feed/FeedSearchFilter';
import { useFeed } from 'app/hooks/feed';
import { RefreshControl } from 'react-native';
import { RText } from '@packrat/ui';

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

const Feed = ({ feedType = 'public' }) => {
  const router = useRouter();

  const [queryString, setQueryString] = useState('');
  const [selectedTypes, setSelectedTypes] = useState({
    pack: true,
    trip: false,
  });
  const [selectedTrips, setSelectedTrips] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [refreshing, setRefreshing] = useState(false);

  const dispatch = useDispatch();
  const ownerId = useSelector((state) => state.auth.user?._id);
  // const publicPacksData = useSelector((state) => state.feed.publicPacks);
  // const userPacksData = useSelector(selectAllPacks);
  // const publicTripsData = useSelector((state) => state.feed.publicTrips);
  // const userTripsData = useSelector(selectAllTrips);

  const styles = useCustomStyles(loadStyles);
  const { data, error, isLoading, refetch } = useFeed(
    queryString,
    ownerId,
    feedType,
    selectedTypes,
  );

  const onRefresh = () => {
    setRefreshing(true);
    refetch();
    setRefreshing(false);
  };

  console.log('🚀 ../.. file: Feed.js:180 ../.. Feed ../.. feedData:', data);
  // useEffect(() => {
  //   if (feedType === 'public') {
  //     dispatch(getPublicPacks(queryString));
  // dispatch(getPublicTrips(queryString));
  //     dispatch(fetchUserFavorites(ownerId));
  //   } else if (feedType === 'userPacks' && ownerId) {
  //     dispatch(fetchUserPacks({ ownerId, queryString }));
  //   } else if (feedType === 'userTrips' && ownerId) {
  //     dispatch(fetchUserTrips(ownerId));
  //   } else if (feedType === 'favoritePacks') {
  //     dispatch(getFavoritePacks());
  //   }
  // }, [queryString, feedType, ownerId]);

  /**
   * Renders the data for the feed based on the feed type and search query.
   *
   * @return {ReactNode} The rendered feed data.
   */
  const renderData = () => {
    let arrayData = data;

    // if (feedType === 'public') {
    //   if (selectedTypes?.pack) {
    //     data = [...data, ...publicPacksData];
    //   }
    //   if (selectedTypes?.trip) {
    //     data = [...data, ...publicTripsData];
    //   }
    // } else if (feedType === 'userPacks') {
    //   data = userPacksData;
    // } else if (feedType === 'userTrips') {
    //   data = userTripsData;
    // } else if (feedType === 'favoritePacks') {
    //   data = userPacksData.filter((pack) => pack.isFavorite);
    // }

    // Fuse search
    const keys = ['name', 'items.name', 'items.category'];
    const options = {
      threshold: 0.4,
      location: 0,
      distance: 100,
      maxPatternLength: 32,
      minMatchCharLength: 1,
    };

    const results =
      feedType !== 'userTrips'
        ? fuseSearch(arrayData, searchQuery, keys, options)
        : data;
    console.log(
      '🚀 ../.. file: Feed.js:231 ../.. renderData ../.. results:',
      results,
    );

    // Convert fuse results back into the format we want
    // if searchQuery is empty, use the original data
    arrayData = searchQuery ? results.map((result) => result.item) : data;

    const feedSearchFilterComponent = (
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
    );
    // return Platform.OS === 'web' ? (
    //   <ScrollView
    //     showsHorizontalScrollIndicator={false}
    //     contentContainerStyle={{ flex: 1, paddingBottom: 10 }}
    //     refreshControl={
    //       <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
    //     }
    //   >
    //     <View style={styles.cardContainer}>
    //       {/* {console.log({ data })} */}
    //       {feedSearchFilterComponent}
    //       {data?.map((item) => (
    //         <Card key={item?._id} type={item?.type} {...item} />
    //       ))}
    //     </View>
    //   </ScrollView>
    // ) : (
    return (
      <View style={{ flex: 1, paddingBottom: 10 }}>
        <FlatList
          data={data}
          horizontal={false}
          numColumns={Platform.OS === 'web' ? 4 : 1}
          keyExtractor={(item) => item?._id + item?.type}
          renderItem={({ item }) => (
            <Card key={item?._id} type={item?.type} {...item} />
          )}
          ListHeaderComponent={() => feedSearchFilterComponent}
          ListEmptyComponent={() => <RText>{ERROR_MESSAGES[feedType]}</RText>}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          maxToRenderPerBatch={2}
          contentContainerStyle={{ flex: 1 }}
        />
      </View>
    );
  };

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

  return <View style={styles.mainContainer}>{renderData()}</View>;
};

const loadStyles = (theme) => {
  const { currentTheme } = theme;
  return {
    mainContainer: {
      flex: 1,
      backgroundColor: currentTheme.colors.background,
      fontSize: 18,
      padding: 15,
    },
    filterContainer: {
      backgroundColor: currentTheme.colors.card,
      padding: 15,
      fontSize: 18,
      width: '100%',
      borderRadius: 10,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
      padding: 10,
      borderRadius: 5,
    },
    cardContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-around',
      alignItems: 'center',
    },
  };
};

export default Feed;
