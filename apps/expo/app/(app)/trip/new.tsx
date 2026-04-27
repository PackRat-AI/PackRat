import { featureFlags } from 'app/config';
import { CreateTripScreen } from 'app/features/trips/screens/CreateTripScreen';
import { Redirect } from 'expo-router';

export default function TripNewScreen() {
  // Gate deep links behind the trips feature flag so e.g. `packrat://trip/new`
  // cannot bypass the kill switch.
  if (!featureFlags.enableTrips) return <Redirect href="/" />;
  return <CreateTripScreen />;
}
