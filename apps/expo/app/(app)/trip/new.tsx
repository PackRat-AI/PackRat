import { featureFlags } from 'expo-app/config';
import { ProGate } from 'expo-app/features/purchases';
import { CreateTripScreen } from 'expo-app/features/trips/screens/CreateTripScreen';
import { Redirect } from 'expo-router';

export default function TripNewScreen() {
  if (!featureFlags.enableTrips) return <Redirect href="/" />;
  return (
    <ProGate>
      <CreateTripScreen />
    </ProGate>
  );
}
