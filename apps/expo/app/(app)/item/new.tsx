import { useLocalSearchParams } from 'expo-router';
import { CreatePackItemForm } from '~/features/packs/screens/CreatePackItemForm';

export default function NewItemScreen() {
  const { packId } = useLocalSearchParams();

  // TODO: We will need a pack item and a standard item creat / edit form.
  return <CreatePackItemForm packId={packId as string} />;
}
