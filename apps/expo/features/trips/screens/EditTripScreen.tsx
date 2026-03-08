import { useTripDetailsFromStore } from 'expo-app/features/trips/hooks/useTripDetailsFromStore';
import { assertDefined } from 'expo-app/utils/typeAssertions';
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { TripForm } from '../components/TripForm';

export function EditTripScreen() {
  const { id } = useLocalSearchParams();
  const effectiveId = Array.isArray(id) ? id[0] : id;
  assertDefined(effectiveId);

  const trip = useTripDetailsFromStore(effectiveId);

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
