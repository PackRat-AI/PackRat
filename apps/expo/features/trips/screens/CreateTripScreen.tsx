import { ScrollView } from 'react-native';
import { TripForm } from '../components/TripForm';

export function CreateTripScreen() {
  return (
    <ScrollView className="w-full bg-background">
      <TripForm />
    </ScrollView>
  );
}
