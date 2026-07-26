import { UpcomingTripsScreen } from 'expo-app/features/trips/screens/UpcomingTripsScreen';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect } from 'expo-router';

export default function UpcomingTripsRoute() {
  const enableTrips = useFeatureFlag('enableTrips');
  if (!enableTrips) return <Redirect href="/" />;
  return <UpcomingTripsScreen />;
}
