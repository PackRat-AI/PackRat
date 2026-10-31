import { GoalEditorScreen } from 'expo-app/features/trip-stats/screens/GoalEditorScreen';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect } from 'expo-router';

export default function TripGoalRoute() {
  const enableTripStats = useFeatureFlag('enableTripStats');
  if (!enableTripStats) return <Redirect href="/" />;
  return <GoalEditorScreen />;
}
