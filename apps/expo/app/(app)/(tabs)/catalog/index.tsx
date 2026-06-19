import CatalogItemsScreen from 'expo-app/features/catalog/screens/CatalogItemsScreen';
import { ProGate } from 'expo-app/features/purchases';

export default function CatalogItemsPage() {
  return (
    <ProGate>
      <CatalogItemsScreen />
    </ProGate>
  );
}
