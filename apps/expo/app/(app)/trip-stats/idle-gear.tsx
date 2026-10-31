import { IdleGearScreen } from 'expo-app/features/trip-stats/screens/IdleGearScreen';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect } from 'expo-router';

export default function TripStatsIdleGearRoute() {
  const enableTripStats = useFeatureFlag('enableTripStats');
  if (!enableTripStats) return <Redirect href="/" />;
  return <IdleGearScreen />;
}
