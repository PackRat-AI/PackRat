import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { NotFoundScreen } from 'expo-app/screens/NotFoundScreen';
import { useLocalSearchParams } from 'expo-router';
import { usePackTemplateItem } from '../hooks/usePackTemplateItem';
import { CreatePackTemplateItemForm } from './CreatePackTemplateItemForm';

export function EditPackTemplateItemScreen() {
  const { id, packTemplateId } = useLocalSearchParams<{
    id: string;
    packTemplateId: string;
  }>();
  const { t } = useTranslation();

  const effectiveItemId = Array.isArray(id) ? id[0] : id;
  const effectivePackTemplateId = Array.isArray(packTemplateId)
    ? packTemplateId[0]
    : packTemplateId;

  const item = usePackTemplateItem(effectiveItemId);

  if (item === undefined) {
    return null;
  }

  if (item === null) {
    return (
      <NotFoundScreen
        title={t('packTemplates.itemNotFound')}
        message={t('packTemplates.itemNotFoundMessage')}
        backButtonLabel={t('packTemplates.goBack')}
      />
    );
  }

  return (
    <CreatePackTemplateItemForm packTemplateId={effectivePackTemplateId} existingItem={item} />
  );
}
