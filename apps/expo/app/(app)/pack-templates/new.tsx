import { CreateTemplatePackScreen } from 'expo-app/features/pack-templates/screens/CreatePackTemplateScreen';
import { ProGate } from 'expo-app/features/purchases';

export default function PackNewScreen() {
  return (
    <ProGate>
      <CreateTemplatePackScreen />
    </ProGate>
  );
}
