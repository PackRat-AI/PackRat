import { ItemsScanScreen } from 'expo-app/features/packs/screens/ItemsScanScreen';
import { ProGate } from 'expo-app/features/purchases';

export default function PackNewFromImageScreen() {
  return (
    <ProGate>
      <ItemsScanScreen />
    </ProGate>
  );
}
