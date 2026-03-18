import { ActivityIndicator, Button, SearchInput } from '@packrat/ui/nativewindui';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, Text, type TextInput, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTripLocation } from '../../../features/trips/store/tripLocationStore';

export default function LocationSearchScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const searchInputRef = useRef<TextInput>(null);
  const { setLocation } = useTripLocation();
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<{
    name: string;
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Focus search input on mount with a delay to ensure the screen transition is complete
  // and the input is ready to receive focus
  useEffect(() => {
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 300);
  }, []);

  // On Android, manually focus the SearchInput when the area is pressed.
  // This fixes an issue where the keyboard doesn't reappear after being dismissed.
  const handleSearchInputPressIn = () => {
    if (Platform.OS === 'android') {
      searchInputRef.current?.focus();
    }
  };

  const GOOGLE_MAPS_API_KEY =
    Constants.expoConfig?.extra?.googleMapsApiKey || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);

    try {
      if (!GOOGLE_MAPS_API_KEY) {
        Alert.alert(t('location.missingApiKey'), t('location.apiKeyNotConfigured'));
        setIsLoading(false);
        return;
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          searchQuery,
        )}&key=${GOOGLE_MAPS_API_KEY}`,
      );

      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const place = data.results[0];
        const { lat, lng } = place.geometry.location;

        const shortName = place.formatted_address.split(',')[0];

        const loc = {
          name: shortName,
          latitude: lat,
          longitude: lng,
        };

        setSelectedLocation(loc);
        mapRef.current?.animateToRegion(
          {
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.2,
            longitudeDelta: 0.2,
          },
          800,
        );
      } else {
        console.warn('Google Maps response:', data);
        Alert.alert(t('location.notFound'), t('location.noLocationFound'));
        setSelectedLocation(null);
      }
    } catch (error) {
      console.error('Error searching location:', error);
      Alert.alert(t('location.searchError'), t('location.somethingWentWrong'));
      setSelectedLocation(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      setLocation(selectedLocation);
      router.back();
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="p-4 border-b border-border bg-background flex-row items-center space-x-2">
        <Pressable className="flex-1" onPressIn={handleSearchInputPressIn}>
          <SearchInput
            ref={searchInputRef}
            placeholder={t('location.searchForPlace')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
          />
        </Pressable>
        <Button onPress={handleSearch} variant="secondary" size="sm">
          <Text className="text-foreground font-medium">{t('location.searchButton')}</Text>
        </Button>
      </View>

      <View className="flex-1">
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: 20.5937,
            longitude: 78.9629,
            latitudeDelta: 10,
            longitudeDelta: 10,
          }}
        >
          {selectedLocation && (
            <Marker
              coordinate={{
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
              }}
              title={selectedLocation.name}
            />
          )}
        </MapView>
      </View>

      <View className="p-4 space-y-2">
        {isLoading && <ActivityIndicator />}
        {selectedLocation && (
          <Button onPress={handleConfirm}>
            <Text className="text-primary-foreground font-semibold">
              {t('location.confirmLocation')}
            </Text>
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}
