import { featureFlags } from 'expo-app/config';
import { ProGate } from 'expo-app/features/purchases';
import { TripDetailScreen } from 'expo-app/features/trips/screens/TripDetailScreen';
import { Redirect } from 'expo-router';

export default function TripDetailScreenRoute() {
  if (!featureFlags.enableTrips) return <Redirect href="/" />;
  return (
    <ProGate>
      <TripDetailScreen />
    </ProGate>
  );
}
