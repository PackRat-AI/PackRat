import { ProGate } from 'expo-app/features/purchases';
import { EditTripScreen } from 'expo-app/features/trips/screens/EditTripScreen';

export default function EditTripScreenRoute() {
  return (
    <ProGate>
      <EditTripScreen />
    </ProGate>
  );
}
