import { GuideDetailScreen } from 'expo-app/features/guides/screens/GuideDetailScreen';
import { ProGate } from 'expo-app/features/purchases';

export default function GuideDetailRoute() {
  return (
    <ProGate>
      <GuideDetailScreen />
    </ProGate>
  );
}
