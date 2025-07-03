import { useLocalSearchParams } from 'expo-router';
import { usePackDetailsFromStore } from '~/features/packs';
import { PackForm } from '~/features/packs/components/PackForm';
import { NotFoundScreen } from '../../../screens/NotFoundScreen';

export function EditPackScreen() {
  const { id } = useLocalSearchParams();
  const effectiveId = Array.isArray(id) ? id[0] : id;

  const pack = usePackDetailsFromStore(effectiveId);

  if (!pack) {
    return (
      <NotFoundScreen
        title="Pack not found"
        message="The pack you're looking for doesn't exist or has been moved."
        backButtonLabel="Go Back"
      />
    );
  }

  return <PackForm pack={pack} />;
}
