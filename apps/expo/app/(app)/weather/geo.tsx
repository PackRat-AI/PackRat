import { ProGate } from 'expo-app/features/purchases';
import TripWeatherDetailsScreen from 'expo-app/features/trips/screens/TripWeatherDetailsScreen';

export default function GeoWeatherDetailsScreen() {
  return (
    <ProGate>
      <TripWeatherDetailsScreen />
    </ProGate>
  );
}
