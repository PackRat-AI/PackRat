import { featureFlags } from 'expo-app/config';
import { TripsListScreen } from 'expo-app/features/trips/screens/TripListScreen';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';

export default function TripsScreen() {
  // Gate the tab route behind the trips feature flag. The tab trigger is
  // already hidden in the layout, but this also blocks deep links such as
  // `packrat://(tabs)/trips` from bypassing the kill switch.
  if (!featureFlags.enableTrips) return <Redirect href="/" />;
  return <TripsScreenInner />;
}

function TripsScreenInner() {
  const { colorScheme } = useColorScheme();

  return (
    <>
      <StatusBar
        style={Platform.OS === 'ios' ? 'light' : colorScheme === 'dark' ? 'light' : 'dark'}
      />
      <TripsListScreen />
    </>
  );
}
