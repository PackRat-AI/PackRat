import { PeakPickerScreen } from 'expo-app/features/trip-stats/screens/PeaksScreens';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect } from 'expo-router';

export default function TripStatsPeakPickerRoute() {
  const enableTripStats = useFeatureFlag('enableTripStats');
  if (!enableTripStats) return <Redirect href="/" />;
  return <PeakPickerScreen />;
}
