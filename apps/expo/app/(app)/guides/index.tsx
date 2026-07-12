import { GuidesListScreen } from 'expo-app/features/guides/screens/GuidesListScreen';
import { EarlyAccessGate } from 'expo-app/features/purchases';

export default function GuidesRoute() {
  return (
    <EarlyAccessGate featureKey="guides">
      <GuidesListScreen />
    </EarlyAccessGate>
  );
}
