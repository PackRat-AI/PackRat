import { TripMapScreen } from 'expo-app/features/trips/screens/TripMapScreen';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect } from 'expo-router';

export default function TripMapScreenRoute() {
  const enableTrips = useFeatureFlag('enableTrips');
  if (!enableTrips) return <Redirect href="/" />;
  return <TripMapScreen />;
}
