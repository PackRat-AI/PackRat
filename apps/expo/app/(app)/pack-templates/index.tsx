import { PackTemplateListScreen } from 'expo-app/features/pack-templates/screens/PackTemplateListScreen';
import { PaywallGate } from 'expo-app/features/purchases';

export default function PackTemplatesRoute() {
  return (
    <PaywallGate>
      <PackTemplateListScreen />
    </PaywallGate>
  );
}
