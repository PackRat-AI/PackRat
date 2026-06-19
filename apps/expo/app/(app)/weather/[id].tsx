import { ProGate } from 'expo-app/features/purchases';
import { LocationDetailScreen } from 'expo-app/features/weather/screens';

export default function LocationDetailIndexScreen() {
  return (
    <ProGate>
      <LocationDetailScreen />
    </ProGate>
  );
}
