import { useState, useRef } from 'react';
import { SafeAreaView, View, Text } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Button, SearchInput, ActivityIndicator } from '@packrat/ui/nativewindui';
import { useRouter } from 'expo-router';
import { useTripLocation } from '../../../features/trips/store/tripLocationStore';

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

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`
      );
      const data = await response.json();

      if (data.length > 0) {
        const place = data[0];
        const lat = parseFloat(place.lat);
        const lon = parseFloat(place.lon);

        const loc = { name: place.display_name, latitude: lat, longitude: lon };
        setSelectedLocation(loc);
        mapRef.current?.animateToRegion(
          { latitude: lat, longitude: lon, latitudeDelta: 0.2, longitudeDelta: 0.2 },
          800
        );
      } else {
        setSelectedLocation(null);
      }
    } catch (error) {
      console.error('Error searching location:', error);
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
          <Text>Search</Text>
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
          <Button onPress={handleConfirm}>
            <Text>Confirm Location</Text>
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}
