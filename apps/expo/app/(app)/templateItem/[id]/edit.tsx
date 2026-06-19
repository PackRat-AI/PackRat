import { EditPackTemplateItemScreen } from 'expo-app/features/pack-templates/screens/EditPackTemplateItemScreen';
import { ProGate } from 'expo-app/features/purchases';

export default function EditTemplateItemRoute() {
  return (
    <ProGate>
      <EditPackTemplateItemScreen />
    </ProGate>
  );
}
