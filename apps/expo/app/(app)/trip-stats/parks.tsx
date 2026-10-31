import { ParksScreen } from 'expo-app/features/trip-stats/screens/ParksScreens';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect } from 'expo-router';

export default function TripStatsParksRoute() {
  const enableTripStats = useFeatureFlag('enableTripStats');
  if (!enableTripStats) return <Redirect href="/" />;
  return <ParksScreen />;
}
