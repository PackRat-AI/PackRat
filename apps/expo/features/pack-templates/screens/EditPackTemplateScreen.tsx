import { useLocalSearchParams } from 'expo-router';
import { NotFoundScreen } from '~/screens/NotFoundScreen';
import { PackTemplateForm } from '../components/PackTemplateForm';
import { usePackTemplateDetails } from '../hooks/usePackTemplatesDetails';

export function EditPackTemplateScreen() {
  const { id } = useLocalSearchParams();
  const effectiveId = Array.isArray(id) ? id[0] : id;

  const packTemplate = usePackTemplateDetails(effectiveId);

  if (!packTemplate) {
    return (
      <NotFoundScreen
        title="Template not found"
        message="The pack template you're looking for doesn't exist or has been moved."
        backButtonLabel="Go Back"
      />
    );
  }

  return <PackTemplateForm template={packTemplate} />;
}
