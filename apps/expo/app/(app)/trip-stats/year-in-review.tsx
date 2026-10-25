import { YearInReviewScreen } from 'expo-app/features/trip-stats/screens/ShareScreens';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect } from 'expo-router';

export default function TripStatsYearInReviewRoute() {
  const enableTripStats = useFeatureFlag('enableTripStats');
  if (!enableTripStats) return <Redirect href="/" />;
  return <YearInReviewScreen />;
}
