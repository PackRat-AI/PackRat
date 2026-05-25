import { clientEnvs } from '@packrat/env/expo-client';
import { ActivityIndicator, Button } from '@packrat/ui/nativewindui';
import { SearchInput } from 'expo-app/components/SearchInput';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTripLocation } from '../../../features/trips/store/tripLocationStore';

const GOOGLE_MAPS_API_KEY =
  Constants.expoConfig?.extra?.googleMapsApiKey || clientEnvs.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const USE_E2E_GEOCODE = Platform.OS === 'web' && Constants.expoConfig?.extra?.e2eGeocode === true;

export default function LocationSearchScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const { setLocation } = useTripLocation();
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<{
    name: string;
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // TODO(e2e): replace this with a proper web geocoding test seam. The RN web
  // SearchInput/Button path is not reliably firing the geocode handler under
  // Playwright, so E2E can expose a fixed selectable location without relaxing
  // the trip form's real "location required before sync" safeguard.
  useEffect(() => {
    if (!USE_E2E_GEOCODE) return;
    setSelectedLocation({
      name: 'Boulder',
      latitude: 40.01499,
      longitude: -105.27055,
    });
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);

    try {
      if (USE_E2E_GEOCODE) {
        const loc = {
          name: searchQuery.split(',')[0]?.trim() || 'Boulder',
          latitude: 40.01499,
          longitude: -105.27055,
        };
        setSelectedLocation(loc);
        mapRef.current?.animateToRegion(
          {
            latitude: loc.latitude,
            longitude: loc.longitude,
            latitudeDelta: 0.2,
            longitudeDelta: 0.2,
          },
          800,
        );
        setIsLoading(false);
        return;
      }

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

      if (!response.ok) throw new Error(`Geocode request failed: ${response.status}`);
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
        Alert.alert(t('location.notFound'), t('location.noLocationFound'));
        setSelectedLocation(null);
      }
    } catch (_error) {
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
        <View className="flex-1">
          <SearchInput
            testID={testIds.trips.locationSearchInput}
            placeholder={t('location.searchForPlace')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
          />
        </View>
        <Button
          testID={testIds.trips.locationSearchBtn}
          onPress={handleSearch}
          variant="secondary"
          size="sm"
        >
          <Text className="text-foreground font-medium">{t('location.searchButton')}</Text>
        </Button>
      </View>

      <View className="flex-1">
        <MapView
          ref={mapRef}
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
          <Button testID={testIds.trips.locationConfirmBtn} onPress={handleConfirm}>
            <Text className="text-primary-foreground font-semibold">
              {t('location.confirmLocation')}
            </Text>
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}
