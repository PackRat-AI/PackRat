import { CreateTripScreen } from '@packrat/app/trips/screens/CreateTripScreen';
import { featureFlags } from 'expo-app/config';
import { Redirect } from 'expo-router';

export default function TripNewScreen() {
  // Gate deep links behind the trips feature flag so e.g. `packrat://trip/new`
  // cannot bypass the kill switch.
  if (!featureFlags.enableTrips) return <Redirect href="/" />;
  return <CreateTripScreen />;
}
