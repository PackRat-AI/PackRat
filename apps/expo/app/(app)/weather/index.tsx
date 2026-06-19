import { ProGate } from 'expo-app/features/purchases';
import { LocationsScreen } from 'expo-app/features/weather/screens';

export default function LocationsIndexScreen() {
  return (
    <ProGate>
      <LocationsScreen />
    </ProGate>
  );
}
