import { assertDefined } from '@packrat/guards';
import { useTripDetailsFromStore } from 'expo-app/features/trips/hooks/useTripDetailsFromStore';
import { useLocalSearchParams } from 'expo-router';
import { TripForm } from '../components/TripForm';

export function EditTripScreen() {
  const { id } = useLocalSearchParams();
  const effectiveId = Array.isArray(id) ? id[0] : id;
  assertDefined(effectiveId);

  const trip = useTripDetailsFromStore(effectiveId);
  assertDefined(trip);

  return <TripForm trip={trip} />;
}
