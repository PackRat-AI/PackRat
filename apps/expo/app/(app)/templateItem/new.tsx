import { CreatePackTemplateItemForm } from 'expo-app/features/pack-templates/screens/CreatePackTemplateItemForm';
import { ProGate } from 'expo-app/features/purchases';
import { useLocalSearchParams } from 'expo-router';

export default function NewTemplateItemScreen() {
  const { packTemplateId } = useLocalSearchParams();

  return (
    <ProGate>
      <CreatePackTemplateItemForm packTemplateId={packTemplateId as string} />
    </ProGate>
  );
}
