import { PackTemplateDetailScreen } from 'expo-app/features/pack-templates/screens/PackTemplateDetailScreen';
import { ProGate } from 'expo-app/features/purchases';

export default function PackTemplateDetailScreenRoute() {
  return (
    <ProGate>
      <PackTemplateDetailScreen />
    </ProGate>
  );
}
