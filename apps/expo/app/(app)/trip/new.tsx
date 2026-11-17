import { CreateTripScreen } from 'expo-app/features/trips/screens/CreateTripScreen';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function TripNewScreen() {
  const enableTrips = useFeatureFlag('enableTrips');
  // Planned from a trail's page: the trip starts on that trail.
  const { trailId, trailName, lat, lon } = useLocalSearchParams<{
    trailId?: string;
    trailName?: string;
    lat?: string;
    lon?: string;
  }>();
  if (!enableTrips) return <Redirect href="/" />;
  const center = lat && lon ? { latitude: Number(lat), longitude: Number(lon) } : null;
  return (
    <CreateTripScreen
      startingTrail={trailId && trailName ? { id: trailId, name: trailName, center } : undefined}
    />
  );
}
