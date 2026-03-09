import { ActivityIndicator } from '@packrat/ui/nativewindui';
import { useTripDetailsFromStore } from 'expo-app/features/trips/hooks/useTripDetailsFromStore';
import { assertDefined } from 'expo-app/utils/typeAssertions';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native';
import { TripForm } from '../components/TripForm';

export function EditTripScreen() {
  const { id } = useLocalSearchParams();
  const effectiveId = Array.isArray(id) ? id[0] : id;
  assertDefined(effectiveId);

  const trip = useTripDetailsFromStore(effectiveId);

  if (!trip) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return <TripForm trip={trip} />;
}
