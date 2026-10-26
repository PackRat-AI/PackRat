import { TripLogEditorScreen } from 'expo-app/features/trip-stats/screens/TripLogEditorScreen';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect } from 'expo-router';

export default function TripLogRoute() {
  const enableTripStats = useFeatureFlag('enableTripStats');
  if (!enableTripStats) return <Redirect href="/" />;
  return <TripLogEditorScreen />;
}
