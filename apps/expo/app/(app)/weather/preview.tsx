import { ProGate } from 'expo-app/features/purchases';
import { LocationPreviewScreen } from 'expo-app/features/weather/screens';

export default function LocationPreviewIndexScreen() {
  return (
    <ProGate>
      <LocationPreviewScreen />
    </ProGate>
  );
}
