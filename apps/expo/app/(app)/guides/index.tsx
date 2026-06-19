import { GuidesListScreen } from 'expo-app/features/guides/screens/GuidesListScreen';
import { ProGate } from 'expo-app/features/purchases';

export default function GuidesRoute() {
  return (
    <ProGate>
      <GuidesListScreen />
    </ProGate>
  );
}
