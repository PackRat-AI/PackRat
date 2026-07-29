import { TripDetailScreen } from 'expo-app/features/trips/screens/TripDetailScreen';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect } from 'expo-router';

export default function TripDetailScreenRoute() {
  const enableTrips = useFeatureFlag('enableTrips');
  if (!enableTrips) return <Redirect href="/" />;
  return <TripDetailScreen />;
}
