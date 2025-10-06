import { TripsListScreen } from 'expo-app/features/trips/screens/TripListScreen';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';

export default function TripsScreen() {
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
