import { SearchInput, type SearchInputRef, Text } from '@packrat/ui/nativewindui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Icon } from '@roninoss/icons';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import debounce from 'lodash.debounce';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Linking,
  Platform,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocationSearch } from '../hooks';
import type { LocationSearchResult } from '../types';

// Key for storing recent searches in AsyncStorage
const RECENT_SEARCHES_KEY = 'packrat_recent_location_searches';

export default function LocationSearchScreen() {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const { isLoading, results, error, search, addSearchResult, searchByCoordinates } =
    useLocationSearch();
  const searchInputRef = useRef<SearchInputRef>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [addingLocationId, setAddingLocationId] = useState<number | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);

  // Focus search input on mount
  useEffect(() => {
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 300);
  }, []);

  // Load recent searches from AsyncStorage
  useEffect(() => {
    const loadRecentSearches = async () => {
      try {
        const storedSearches = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
        if (storedSearches) {
          setRecentSearches(JSON.parse(storedSearches));
        }
      } catch (err) {
        console.error('Error loading recent searches:', err);
      }
    };

    loadRecentSearches();
  }, []);

  // Save a search term to recent searches
  const saveToRecentSearches = async (searchTerm: string) => {
    try {
      // Don't add duplicates
      if (recentSearches.includes(searchTerm)) {
        // Move to top if it exists
        const updatedSearches = [
          searchTerm,
          ...recentSearches.filter((term) => term !== searchTerm),
        ].slice(0, 5); // Keep only 5 most recent

        setRecentSearches(updatedSearches);
        await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updatedSearches));
        return;
      }

      // Add new search term to the beginning and limit to 5
      const updatedSearches = [searchTerm, ...recentSearches].slice(0, 5);
      setRecentSearches(updatedSearches);
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updatedSearches));
    } catch (err) {
      console.error('Error saving recent search:', err);
    }
  };

  // Create a debounced search function
  const debouncedSearch = useRef(
    debounce((text: string) => {
      search(text);
    }, 500),
  ).current;

  // Handle search input change
  const handleSearchChange = (text: string) => {
    setQuery(text);
    debouncedSearch(text);
  };

  // Handle adding a location
  const handleAddLocation = async (location: LocationSearchResult) => {
    setIsAdding(true);
    setAddingLocationId(location.id);

    try {
      const success = await addSearchResult(location);
      if (success) {
        // Add to recent searches
        saveToRecentSearches(location.name);

        // Show success message
        Alert.alert(
          t('weather.locationAdded'),
          t('weather.locationAddedMessage', { name: location.name }),
          [
            {
              text: t('weather.viewAllLocations'),
              onPress: () => router.back(),
            },
            {
              text: t('weather.addAnother'),
              onPress: () => {
                setQuery('');
                searchInputRef.current?.focus();
              },
            },
          ],
          { cancelable: false },
        );
      } else {
        Alert.alert(t('common.error'), t('weather.errorAddingLocation'));
      }
    } catch (err) {
      console.error('Error adding location:', err);
      Alert.alert(t('common.error'), t('weather.unexpectedError'));
    } finally {
      setIsAdding(false);
      setAddingLocationId(null);
    }
  };

  // Handle viewing location details without saving
  const handleViewLocationDetails = (location: LocationSearchResult) => {
    saveToRecentSearches(location.name);

    // Navigate to preview screen with location coordinates
    router.push({
      pathname: '/weather/preview',
      params: {
        lat: location.lat.toString(),
        lon: location.lon.toString(),
        name: location.name,
        region: location.region || '',
        country: location.country,
      },
    });
  };

  // Handle selecting a popular city
  const handlePopularCitySearch = (cityName: string) => {
    setQuery(cityName);
    debouncedSearch(cityName);
    Keyboard.dismiss();
  };

  // Handle using device location
  const handleUseDeviceLocation = async () => {
    setIsGettingLocation(true);
    setLocationPermissionDenied(false);
    Keyboard.dismiss();

    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setLocationPermissionDenied(true);
        Alert.alert(
          t('weather.permissionDenied'),
          t('weather.permissionDeniedMessage'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('weather.openSettings'),
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              },
            },
          ],
        );
        return;
      }

      // Get current location with timeout
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Set a timeout for location retrieval
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Location request timed out')), 15000),
      );

      // Race between location retrieval and timeout
      const location = (await Promise.race([
        locationPromise,
        timeoutPromise,
      ])) as Location.LocationObject;

      // Search for locations near coordinates
      await searchByCoordinates(location.coords.latitude, location.coords.longitude);

      // Clear search query since we're showing results based on coordinates
      setQuery('');
    } catch (err) {
      console.error('Error getting location:', err);

      // Provide more specific error messages
      if (err instanceof Error && err.message === 'Location request timed out') {
        Alert.alert(
          t('weather.locationTimeout'),
          t('weather.locationTimeoutMessage'),
          [{ text: t('common.ok') }],
        );
      } else {
        Alert.alert(
          t('weather.locationError'),
          t('weather.locationErrorMessage'),
          [{ text: t('common.ok') }],
        );
      }
    } finally {
      setIsGettingLocation(false);
    }
  };

  // Popular cities list
  const POPULAR_CITIES = [
    { name: 'New York', country: 'United States' },
    { name: 'London', country: 'United Kingdom' },
    { name: 'Tokyo', country: 'Japan' },
    { name: 'Paris', country: 'France' },
    { name: 'Sydney', country: 'Australia' },
    { name: 'Berlin', country: 'Germany' },
    { name: 'Toronto', country: 'Canada' },
  ];

  // Render a search result item
  const renderResultItem = ({ item }: { item: LocationSearchResult }) => (
    <View className="border-border/30 border-b px-4 py-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="font-medium">{item.name}</Text>
          <Text className="text-sm text-muted-foreground">
            {item.region ? `${item.region}, ` : ''}
            {item.country}
          </Text>
        </View>

        <View className="flex-row">
          {/* View Details Button */}
          <TouchableOpacity
            className="bg-primary/10 mr-2 rounded-full px-3 py-1.5"
            onPress={() => handleViewLocationDetails(item)}
          >
            <Text className="text-sm font-medium text-primary">{t('weather.view')}</Text>
          </TouchableOpacity>

          {/* Add Button */}
          <TouchableOpacity
            className="rounded-full bg-primary px-3 py-1.5"
            onPress={() => handleAddLocation(item)}
            disabled={isAdding && addingLocationId === item.id}
          >
            {isAdding && addingLocationId === item.id ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="text-sm font-medium text-white">{t('weather.add')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // Render empty list component
  const renderEmptyList = () => {
    if (error) {
      return (
        <View className="flex-1 items-center justify-center p-8">
          <Icon name="exclamation" size={48} color={colors.destructive} />
          <Text className="mt-4 text-center text-destructive">{error}</Text>
          <TouchableOpacity
            className="mt-6 rounded-full bg-primary px-4 py-2"
            onPress={() => (query.length > 0 ? debouncedSearch(query) : handleUseDeviceLocation())}
          >
            <Text className="text-white">{t('weather.tryAgain')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (query.length > 0) {
      return (
        <View className="flex-1 items-center justify-center p-8">
          <Icon name="magnify-minus-outline" size={48} color={colors.grey2} />
          <Text className="mt-4 text-center text-muted-foreground">
            {t('weather.noLocationsFound', { query })}
          </Text>
          <Text className="mt-1 text-center text-sm text-muted-foreground">
            {t('weather.tryDifferentSearch')}
          </Text>
        </View>
      );
    }

    return (
      <View className="p-4">
        {/* Current Location Button */}
        <TouchableOpacity
          className={cn(
            'mb-6 flex-row items-center justify-center gap-2 rounded-lg p-3',
            locationPermissionDenied ? 'bg-destructive/10' : 'bg-primary/10',
          )}
          onPress={handleUseDeviceLocation}
          disabled={isGettingLocation}
        >
          {isGettingLocation ? (
            <>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text className="font-medium text-primary">{t('weather.gettingLocation')}</Text>
            </>
          ) : locationPermissionDenied ? (
            <>
              <Icon name="bell-outline" size={20} color={colors.destructive} />
              <Text className="font-medium text-destructive">{t('weather.locationPermissionRequired')}</Text>
            </>
          ) : (
            <>
              <Icon name="map-marker-radius-outline" size={20} color={colors.primary} />
              <Text className="font-medium text-primary">{t('weather.useCurrentLocation')}</Text>
            </>
          )}
        </TouchableOpacity>

        {recentSearches.length > 0 && (
          <>
            <Text className="mb-2 text-xs uppercase text-muted-foreground">{t('weather.recentSearches')}</Text>
            <View className="mb-6">
              {recentSearches.map((search) => (
                <TouchableOpacity
                  key={search}
                  className="border-border/30 flex-row items-center gap-3 border-b py-3"
                  onPress={() => handlePopularCitySearch(search)}
                >
                  <Icon name="clock-outline" size={20} color={colors.grey2} />
                  <Text className="text-foreground">{search}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text className="mb-2 text-xs uppercase text-muted-foreground">{t('weather.popularCities')}</Text>
        <View>
          {POPULAR_CITIES.map((city) => (
            <TouchableOpacity
              key={`${city.country}-${city.name}`}
              className="border-border/30 flex-row items-center gap-3 border-b py-3"
              onPress={() => handlePopularCitySearch(city.name)}
            >
              <Icon name="map-marker-outline" size={20} color={colors.grey2} />
              <View>
                <Text className="text-foreground">{city.name}</Text>
                <Text className="text-sm text-muted-foreground">{city.country}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Search Input */}
      <View className="px-4">
        <SearchInput
          ref={searchInputRef}
          placeholder={t('weather.searchForCity')}
          value={query}
          onChangeText={handleSearchChange}
          containerClassName="border border-border"
          autoFocus
          clearButtonMode="while-editing"
        />
      </View>

      {/* Results List */}
      {isLoading && query.length > 0 ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          className="flex-1 items-center justify-center"
        >
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="mt-4 text-muted-foreground">{t('weather.searchingForLocations')}</Text>
        </Animated.View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderResultItem}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={renderEmptyList}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
}
