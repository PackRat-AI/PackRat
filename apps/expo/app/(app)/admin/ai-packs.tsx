import { AIPacksScreen } from 'expo-app/features/ai-packs/screens/AIPacksScreen';
import { ProGate } from 'expo-app/features/purchases';

export default function AIPacks() {
  return (
    <ProGate>
      <AIPacksScreen />
    </ProGate>
  );
}
