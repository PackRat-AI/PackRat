import { PackSelectionScreen } from 'expo-app/features/catalog/screens/PackSelectionScreen';
import { ProGate } from 'expo-app/features/purchases';

export default function PackSelectionPage() {
  return (
    <ProGate>
      <PackSelectionScreen />
    </ProGate>
  );
}
