import { featureFlags } from '@packrat/app/config';
import { TripDetailScreen } from '@packrat/app/trips/screens/TripDetailScreen';
import { Redirect } from 'expo-router';

export default function TripDetailScreenRoute() {
  // Gate deep links behind the trips feature flag so e.g. `packrat://trip/:id`
  // cannot bypass the kill switch.
  if (!featureFlags.enableTrips) return <Redirect href="/" />;
  return <TripDetailScreen />;
}
