import { CreatePackItemForm } from 'expo-app/features/packs/screens/CreatePackItemForm';
import { useLocalSearchParams } from 'expo-router';

export default function NewItemScreen() {
  const { packId } = useLocalSearchParams();

  // TODO: We will need a pack item and a standard item creat / edit form.
  return <CreatePackItemForm packId={packId as string} />;
}
