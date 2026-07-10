import { featureFlags } from 'expo-app/config';
import { ProGate } from 'expo-app/features/purchases';
import { UpcomingTripsScreen } from 'expo-app/features/trips/screens/UpcomingTripsScreen';
import { Redirect } from 'expo-router';

export default function UpcomingTripsRoute() {
  if (!featureFlags.enableTrips) return <Redirect href="/" />;
  return (
    <ProGate>
      <UpcomingTripsScreen />
    </ProGate>
  );
}
