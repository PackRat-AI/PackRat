import { Button, LargeTitleHeader, SearchInput, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { withAuthWall } from 'expo-app/features/auth/hocs';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { router, useNavigation } from 'expo-router';
import { useAtom } from 'jotai';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchQueryAtom } from '../atoms/locationsAtoms';
import { LocationCard } from '../components/LocationCard';
import { WeatherAuthWall } from '../components/WeatherAuthWall';
import { useActiveLocation, useLocationRefresh, useLocations } from '../hooks';

function LocationsScreen() {
  const { colors } = useColorScheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
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
    location.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Handle search query change
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };

  // Clear search and dismiss keyboard
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    Keyboard.dismiss();
    setIsSearchFocused(false);
  }, [setSearchQuery]);

  // Load weather data on initial render
  // biome-ignore lint/correctness/useExhaustiveDependencies: need this effect to just get updated data for locations one time
  useEffect(() => {
    if (locations.length > 0 && !isLoading) {
      refreshAllLocations();
    }
  }, [isLoading]);

  // Clear search when navigating to this screen -> https://github.com/PackRat-AI/PackRat/issues/1424
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      clearSearch();
    });

    // Also clear when navigating away (cleanup)
    return () => {
      unsubscribe();
      setSearchQuery('');
    };
  }, [navigation, clearSearch, setSearchQuery]);

  const handleLocationPress = (locationId: number) => {
    router.push(`/weather/${locationId}`);
  };

  const handleSetActive = (locationId: number) => {
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
        },
      );
    }
  };

  const handleRemoveLocation = (locationId: number) => {
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

      <View className="p-4">
        <SearchInput
          ref={searchInputRef}
          placeholder="Search saved locations"
          value={searchQuery}
          onChangeText={handleSearchChange}
          containerClassName="border border-border"
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
          className="px-4 py-2"
        >
          <Text className="mb-2 text-xs uppercase text-muted-foreground">SEARCH RESULTS</Text>
          <View className="bg-muted/30 items-center rounded-lg p-4">
            <Icon name="magnify-minus-outline" size={24} color={colors.grey2} />
            <Text className="mt-2 text-muted-foreground">No locations match "{searchQuery}"</Text>
            <View className="mt-4 flex-row">
              <TouchableOpacity
                className="bg-primary/10 mr-2 rounded-full px-4 py-2"
                onPress={clearSearch}
              >
                <Text className="text-primary">Clear Search</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="rounded-full bg-primary px-4 py-2"
                onPress={handleAddLocation}
              >
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
          keyboardShouldPersistTaps="handled"
        >
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
            <View className="flex-1 items-center mt-16">
              <Icon name="map-marker-radius-outline" size={64} color={colors.grey2} />
              <Text className="mt-4 text-center text-lg font-medium">No saved locations</Text>
              <Text className="mb-4 mt-2 px-8 text-center text-sm text-muted-foreground">
                Add locations to track weather conditions for your hiking trips and get personalized
                recommendations
              </Text>
              <Button variant="primary" onPress={handleAddLocation}>
                <Text className="font-medium text-white">Add Location</Text>
              </Button>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

export default withAuthWall(LocationsScreen, WeatherAuthWall);
