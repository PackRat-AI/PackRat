import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { NotFoundScreen } from 'expo-app/screens/NotFoundScreen';
import { useLocalSearchParams } from 'expo-router';
import { PackTemplateForm } from '../components/PackTemplateForm';
import { usePackTemplateDetails } from '../hooks/usePackTemplatesDetails';

export function EditPackTemplateScreen() {
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  const effectiveId = (Array.isArray(id) ? id[0] : id) as string;

  const packTemplate = usePackTemplateDetails(effectiveId);

  if (!packTemplate) {
    return (
      <NotFoundScreen
        title={t('packTemplates.templateNotFound')}
        message={t('packTemplates.templateNotFoundMessage')}
        backButtonLabel={t('packTemplates.goBack')}
      />
    );
  }

  return <PackTemplateForm template={packTemplate} />;
}
