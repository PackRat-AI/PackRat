import { ItemsScanScreen } from 'expo-app/features/pack-templates/screens/ItemsScanScreen';
import { ProGate } from 'expo-app/features/purchases';

export default function PackNewFromImageScreen() {
  return (
    <ProGate>
      <ItemsScanScreen />
    </ProGate>
  );
}
