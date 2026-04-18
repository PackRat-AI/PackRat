import { ScrollView } from 'react-native';
import { PackForm } from '../components/PackForm';

export function CreatePackScreen() {
  return (
    <ScrollView className="w-full bg-background">
      <PackForm />
    </ScrollView>
  );
}
