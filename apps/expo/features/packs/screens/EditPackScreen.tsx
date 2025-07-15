import { usePackDetailsFromStore } from 'expo-app/features/packs';
import { PackForm } from 'expo-app/features/packs/components/PackForm';
import { useLocalSearchParams } from 'expo-router';
import { NotFoundScreen } from '../../../screens/NotFoundScreen';
import { assertDefined } from 'expo-app/utils/typeAssertions';

export function EditPackScreen() {
  const { id } = useLocalSearchParams();
  const effectiveId = Array.isArray(id) ? id[0] : id;
  assertDefined(effectiveId);

  const pack = usePackDetailsFromStore(effectiveId);
  assertDefined(pack);

  return <PackForm pack={pack} />;
}
