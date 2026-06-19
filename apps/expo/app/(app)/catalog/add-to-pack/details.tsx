import { AddCatalogItemDetailsScreen } from 'expo-app/features/catalog/screens/AddCatalogItemDetailsScreen';
import { ProGate } from 'expo-app/features/purchases';

export default function AddCatalogItemDetailsPage() {
  return (
    <ProGate>
      <AddCatalogItemDetailsScreen />
    </ProGate>
  );
}
