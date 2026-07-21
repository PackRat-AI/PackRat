import { TripsListScreen } from 'expo-app/features/trips/screens/TripListScreen';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function TripsScreen() {
  const enableTrips = useFeatureFlag('enableTrips');
  if (!enableTrips) return <Redirect href="/" />;
  return <TripsScreenInner />;
}

function TripsScreenInner() {
  return (
    <>
      <StatusBar />
      <TripsListScreen />
    </>
  );
}
