import { PackTemplateListScreen } from 'expo-app/features/pack-templates/screens/PackTemplateListScreen';
import { ProGate } from 'expo-app/features/purchases';

export default function PackTemplatesRoute() {
  return (
    <ProGate>
      <PackTemplateListScreen />
    </ProGate>
  );
}
