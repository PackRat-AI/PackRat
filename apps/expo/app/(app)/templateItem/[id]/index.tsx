import { PackTemplateItemDetailScreen } from 'expo-app/features/pack-templates/screens/PackTemplateItemDetailScreen';
import { ProGate } from 'expo-app/features/purchases';

export default function TemplateItemDetailRoute() {
  return (
    <ProGate>
      <PackTemplateItemDetailScreen />
    </ProGate>
  );
}
