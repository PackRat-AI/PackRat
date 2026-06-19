import { EditPackTemplateScreen } from 'expo-app/features/pack-templates/screens/EditPackTemplateScreen';
import { ProGate } from 'expo-app/features/purchases';

export default function EditPackTemplateScreenRoute() {
  return (
    <ProGate>
      <EditPackTemplateScreen />
    </ProGate>
  );
}
