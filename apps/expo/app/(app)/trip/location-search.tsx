import { useState, useRef } from 'react';
import { SafeAreaView, View, Text, Alert } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Button, SearchInput, ActivityIndicator } from '@packrat/ui/nativewindui';
import { useRouter } from 'expo-router';
import { useTripLocation } from '../../../features/trips/store/tripLocationStore';
import Constants from 'expo-constants';

export default function LocationSearchScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const { setLocation } = useTripLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<{
    name: string;
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const GOOGLE_MAPS_API_KEY =
    Constants.expoConfig?.extra?.googleMapsApiKey ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);

    try {
      if (!GOOGLE_MAPS_API_KEY) {
        Alert.alert('Missing API Key', 'Google Maps API key is not configured.');
        setIsLoading(false);
        return;
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          searchQuery
        )}&key=${GOOGLE_MAPS_API_KEY}`
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
          800
        );
      } else {
        console.warn('Google Maps response:', data);
        Alert.alert('Not Found', 'No location found for that search.');
        setSelectedLocation(null);
      }
    } catch (error) {
      console.error('Error searching location:', error);
      Alert.alert('Error', 'Something went wrong while searching.');
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
            placeholder="Search for a place"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
          />
        </View>
        <Button onPress={handleSearch} variant="secondary" size="sm">
          <Text className="text-foreground font-medium">Search</Text>
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
              Confirm Location
            </Text>
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}
