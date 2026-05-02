import { useTranslation } from '@packrat/app/lib/hooks/useTranslation';
import { CreatePackItemForm } from '@packrat/app/packs/screens/CreatePackItemForm';
import { NotFoundScreen } from '@packrat/app/screens/NotFoundScreen';
import { useLocalSearchParams } from 'expo-router';
import { usePackItemDetailsFromStore } from '../hooks';

export function EditPackItemScreen() {
  const { t } = useTranslation();
  const { id, packId } = useLocalSearchParams();
  const effectiveItemId = Array.isArray(id) ? id[0] : id;
  const effectivePackId = Array.isArray(packId) ? packId[0] : packId;

  const item = usePackItemDetailsFromStore(effectiveItemId || '');

  if (!item || !effectivePackId || !effectiveItemId) {
    return (
      <NotFoundScreen
        title={t('packs.packNotFound')}
        message={t('packs.pleaseGetLocation')}
        backButtonLabel={t('packs.goBack')}
      />
    );
  }

  return <CreatePackItemForm packId={effectivePackId} existingItem={item} />;
}
