import { RouteDrawingScreen } from 'expo-app/features/trip-stats/screens/RouteDrawingScreen';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect } from 'expo-router';

export default function TripStatsDrawRouteRoute() {
  const enableTripStats = useFeatureFlag('enableTripStats');
  if (!enableTripStats) return <Redirect href="/" />;
  return <RouteDrawingScreen />;
}
