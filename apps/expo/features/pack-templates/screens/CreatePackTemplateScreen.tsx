import { ScrollView } from 'react-native';
import { PackTemplateForm } from '../components/PackTemplateForm';

export function CreateTemplatePackScreen() {
  return (
    <ScrollView className="w-full bg-background">
      <PackTemplateForm />
    </ScrollView>
  );
}
