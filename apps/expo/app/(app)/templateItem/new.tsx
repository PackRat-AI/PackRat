import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { CreatePackTemplateItemForm } from '~/features/pack-templates/screens/CreatePackTemplateItemForm';

export default function NewTemplateItemScreen() {
  const { packTemplateId } = useLocalSearchParams();

  return <CreatePackTemplateItemForm packTemplateId={packTemplateId as string} />;
}
