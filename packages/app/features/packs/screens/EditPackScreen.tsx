import { assertDefined } from '@packrat/guards';
import { usePackDetailsFromStore } from 'app/features/packs';
import { PackForm } from 'app/features/packs/components/PackForm';
import { useLocalSearchParams } from 'expo-router';

export function EditPackScreen() {
  const { id } = useLocalSearchParams();
  const effectiveId = Array.isArray(id) ? id[0] : id;
  assertDefined(effectiveId);

  const pack = usePackDetailsFromStore(effectiveId);
  assertDefined(pack);

  return <PackForm pack={pack} />;
}
