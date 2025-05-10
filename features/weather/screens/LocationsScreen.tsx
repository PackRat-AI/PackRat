import { Icon } from '@roninoss/icons';
import { router } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import {
  Pressable,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Keyboard,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAtom } from 'jotai';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { LargeTitleHeader } from '~/components/nativewindui/LargeTitleHeader';
import { Text } from '~/components/nativewindui/Text';
import { SearchInput } from '~/components/nativewindui/SearchInput';
import { cn } from '~/lib/cn';
import { useColorScheme } from '~/lib/useColorScheme';
import { searchQueryAtom } from '../atoms/locationsAtoms';
import { useLocations, useActiveLocation, useLocationRefresh } from '../hooks';
import { LocationCard } from '../components/LocationCard';
import { withAuthWall } from '~/features/auth/hocs';
import { WeatherAuthWall } from '../components/WeatherAuthWall';

function LocationsScreen() {
  const { colors } = useColorScheme();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useAtom(searchQueryAtom);
  const { locationsState } = useLocations();
  const { setActiveLocation } = useActiveLocation();
  const { isRefreshing, refreshAllLocations } = useLocationRefresh();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef(null);
  const { removeLocation } = useLocations();

  // Determine if we're loading
  const isLoading = locationsState.state === 'loading';

  // Get the locations array safely
  const locations = locationsState.state === 'hasData' ? locationsState.data : [];

  // Filter locations based on search query
  const filteredLocations = locations.filter((location) =>
    location.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle search query change
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };

  // Clear search and dismiss keyboard
  const clearSearch = () => {
    setSearchQuery('');
    Keyboard.dismiss();
    setIsSearchFocused(false);
  };

  // Load weather data on initial render
  useEffect(() => {
    if (locations.length > 0 && !isLoading) {
      refreshAllLocations();
    }
  }, [isLoading]);

  // Clear search when navigating away
  useEffect(() => {
    return () => {
      setSearchQuery('');
    };
  }, []);

  const handleLocationPress = (locationId: string) => {
    router.push(`/weather/${locationId}`);
  };

  const handleSetActive = (locationId: string) => {
    setActiveLocation(locationId);

    // Show confirmation
    const location = locations.find((loc) => loc.id === locationId);
    if (location) {
      Alert.alert(
        'Location Set',
        `${location.name} is now your active location.`,
        [{ text: 'OK' }],
        {
          cancelable: true,
        }
      );
    }
  };

  const handleRemoveLocation = (locationId: string) => {
    removeLocation(locationId);
  };

  const handleAddLocation = () => {
    router.push('/weather/search');
  };

  // Determine which state to show
  const showEmptyState = locations.length === 0 && !isLoading && !isSearchFocused;
  const showSearchResults = isSearchFocused && searchQuery.length > 0;
  const showNoSearchResults = showSearchResults && filteredLocations.length === 0;
  const showLocationsList = filteredLocations.length > 0;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LargeTitleHeader
        title="Weather"
        rightView={() => (
          <View className="flex-row items-center pr-2">
            <Pressable className="opacity-80" onPress={handleAddLocation}>
              {({ pressed }) => (
                <View className={cn(pressed ? 'opacity-50' : 'opacity-90')}>
                  <Icon name="plus" color={colors.foreground} />
                </View>
              )}
            </Pressable>
          </View>
        )}
      />

      <View className="px-4 py-2">
        <SearchInput
          ref={searchInputRef}
          placeholder="Search saved locations"
          value={searchQuery}
          onChangeText={handleSearchChange}
          containerClassName="bg-muted"
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => {
            // Only unfocus if search is empty
            if (searchQuery.length === 0) {
              setIsSearchFocused(false);
            }
          }}
        />
      </View>

      {showNoSearchResults && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          className="px-4 py-2">
          <Text className="mb-2 text-xs uppercase text-muted-foreground">SEARCH RESULTS</Text>
          <View className="bg-muted/30 items-center rounded-lg p-4">
            <Icon name="magnify-minus-outline" size={24} color={colors.grey2} />
            <Text className="mt-2 text-muted-foreground">No locations match "{searchQuery}"</Text>
            <View className="mt-4 flex-row">
              <TouchableOpacity
                className="bg-primary/10 mr-2 rounded-full px-4 py-2"
                onPress={clearSearch}>
                <Text className="text-primary">Clear Search</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="rounded-full bg-primary px-4 py-2"
                onPress={handleAddLocation}>
                <Text className="text-white">Add New Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}

      {isLoading ? (
        <View className="flex-1 items-center justify-center py-12">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="mt-4 text-muted-foreground">Loading weather data...</Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: insets.bottom + 16,
            flexGrow: showEmptyState ? 1 : undefined,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refreshAllLocations}
              tintColor={colors.primary}
            />
          }
          keyboardShouldPersistTaps="handled">
          {showLocationsList && (
            <>
              {showSearchResults && (
                <View className="mb-2">
                  <Text className="text-xs uppercase text-muted-foreground">
                    {filteredLocations.length}{' '}
                    {filteredLocations.length === 1 ? 'RESULT' : 'RESULTS'}
                  </Text>
                </View>
              )}

              <View className="mb-2">
                <Text className="text-xs text-muted-foreground">
                  Long press on a location for options
                </Text>
              </View>

              {filteredLocations.map((location) => (
                <LocationCard
                  key={location.id}
                  location={location}
                  onPress={() => handleLocationPress(location.id)}
                  onSetActive={() => handleSetActive(location.id)}
                  onRemove={() => handleRemoveLocation(location.id)}
                />
              ))}
            </>
          )}

          {showEmptyState && (
            <View className="flex-1 items-center justify-center">
              <Icon name="map-marker-radius-outline" size={64} color={colors.grey2} />
              <Text className="mt-4 text-center text-lg font-medium">No saved locations</Text>
              <Text className="mb-4 mt-2 px-8 text-center text-sm text-muted-foreground">
                Add locations to track weather conditions for your hiking trips and get personalized
                recommendations
              </Text>
              <TouchableOpacity
                className="mt-2 rounded-full bg-primary px-6 py-3"
                onPress={handleAddLocation}>
                <Text className="font-medium text-white">Add Your First Location</Text>
              </TouchableOpacity>
              <Text className="mt-4 text-xs text-muted-foreground">
                Location data helps PackRat AI provide better advice
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

export default withAuthWall(LocationsScreen, WeatherAuthWall);
