import { CreatePackItemForm } from '~/features/packs/screens/CreatePackItemForm';
import { NotFoundScreen } from '../../../screens/NotFoundScreen';
import { useLocalSearchParams } from 'expo-router';
import { usePackItem } from '../hooks';

export function EditPackItemScreen() {
  const { id, packId } = useLocalSearchParams();
  const effectiveItemId = Array.isArray(id) ? id[0] : id;
  const effectivePackId = Array.isArray(packId) ? packId[0] : packId;

  const item = usePackItem(effectiveItemId);

  if (!item) {
    return (
      <NotFoundScreen
        title="Pack not found"
        message="The pack you're looking for doesn't exist or has been moved."
        backButtonLabel="Go Back"
      />
    );
  }

  return <CreatePackItemForm packId={effectivePackId} existingItem={item} />;
}
