import { useTripDetailsFromStore } from 'expo-app/features/trips/hooks/useTripDetailsFromStore';
import { tripLocationStore } from 'expo-app/features/trips/store/tripLocationStore';
import { assertDefined } from 'expo-app/utils/typeAssertions';
import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { TripForm } from '../components/TripForm';

export function EditTripScreen() {
  const { id } = useLocalSearchParams();
  const effectiveId = Array.isArray(id) ? id[0] : id;
  assertDefined(effectiveId);

  const trip = useTripDetailsFromStore(effectiveId);

  // Sync trip location to store when trip loads
  useEffect(() => {
    if (trip?.location) {
      tripLocationStore.set({
        name: trip.location.name ?? '',
        latitude: trip.location.latitude,
        longitude: trip.location.longitude,
      });
    }
  }, [trip?.location]);

  // Handle loading state gracefully instead of throwing error
  if (!trip) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-muted-foreground">Loading trip details...</Text>
      </View>
    );
  }

  return <TripForm trip={trip} />;
}
