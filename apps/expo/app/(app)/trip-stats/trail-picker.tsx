import { TrailPickerScreen } from 'expo-app/features/trip-stats/screens/TrailsScreens';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect } from 'expo-router';

export default function TripStatsTrailPickerRoute() {
  const enableTripStats = useFeatureFlag('enableTripStats');
  if (!enableTripStats) return <Redirect href="/" />;
  return <TrailPickerScreen />;
}
