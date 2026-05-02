import { PackForm } from '@packrat/app/packs/components/PackForm';
import { usePackDetailsFromStore } from '@packrat/app/packs/hooks/usePackDetailsFromStore';
import { assertDefined } from '@packrat/guards';
import { useLocalSearchParams } from 'expo-router';

export function EditPackScreen() {
  const { id } = useLocalSearchParams();
  const effectiveId = Array.isArray(id) ? id[0] : id;
  assertDefined(effectiveId);

  const pack = usePackDetailsFromStore(effectiveId);
  assertDefined(pack);

  return <PackForm pack={pack} />;
}
