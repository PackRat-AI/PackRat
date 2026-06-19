import { featureFlags } from 'expo-app/config';
import { ProGate } from 'expo-app/features/purchases';
import { TripsListScreen } from 'expo-app/features/trips/screens/TripListScreen';
import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function TripsScreen() {
  if (!featureFlags.enableTrips) return <Redirect href="/" />;
  return (
    <ProGate>
      <TripsScreenInner />
    </ProGate>
  );
}

function TripsScreenInner() {
  return (
    <>
      <StatusBar />
      <TripsListScreen />
    </>
  );
}
