import { featureFlags } from 'app/config';
import { TripDetailScreen } from 'app/features/trips/screens/TripDetailScreen';
import { Redirect } from 'expo-router';

export default function TripDetailScreenRoute() {
  // Gate deep links behind the trips feature flag so e.g. `packrat://trip/:id`
  // cannot bypass the kill switch.
  if (!featureFlags.enableTrips) return <Redirect href="/" />;
  return <TripDetailScreen />;
}
