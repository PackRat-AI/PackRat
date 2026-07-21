import { CreateTripScreen } from 'expo-app/features/trips/screens/CreateTripScreen';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect } from 'expo-router';

export default function TripNewScreen() {
  const enableTrips = useFeatureFlag('enableTrips');
  if (!enableTrips) return <Redirect href="/" />;
  return <CreateTripScreen />;
}
