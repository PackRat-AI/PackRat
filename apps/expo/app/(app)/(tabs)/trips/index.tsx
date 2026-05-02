import { TripsListScreen } from '@packrat/app/trips/screens/TripListScreen';
import { featureFlags } from 'expo-app/config';
import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function TripsScreen() {
  // Gate the tab route behind the trips feature flag. The tab trigger is
  // already hidden in the layout, but this also blocks deep links such as
  // `packrat://(tabs)/trips` from bypassing the kill switch.
  if (!featureFlags.enableTrips) return <Redirect href="/" />;
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
