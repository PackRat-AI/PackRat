import { useTripDetailsFromStore } from 'expo-app/features/trips/hooks/useTripDetailsFromStore';
import { assertDefined } from 'expo-app/utils/typeAssertions';
import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, SafeAreaView } from 'react-native';
import { TripForm } from '../components/TripForm';
import { tripLocationStore } from '../store/tripLocationStore';

export function EditTripScreen() {
  const { id } = useLocalSearchParams();
  const effectiveId = Array.isArray(id) ? id[0] : id;
  assertDefined(effectiveId);

  const trip = useTripDetailsFromStore(effectiveId);

  // biome-ignore lint/correctness/useExhaustiveDependencies: initialize tripLocationStore only when the trip changes, not on every location sync update
  useEffect(() => {
    if (trip) {
      tripLocationStore.set(trip.location ?? null);
    }
    return () => {
      tripLocationStore.set(null);
    };
  }, [trip?.id]);

  if (!trip) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return <TripForm trip={trip} />;
}
