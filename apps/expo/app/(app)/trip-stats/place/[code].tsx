import { PlaceDetailScreen } from 'expo-app/features/trip-stats/screens/PlacesScreens';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect } from 'expo-router';

export default function TripStatsPlaceRoute() {
  const enableTripStats = useFeatureFlag('enableTripStats');
  if (!enableTripStats) return <Redirect href="/" />;
  return <PlaceDetailScreen />;
}
