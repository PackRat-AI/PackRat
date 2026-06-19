import { CatalogItemDetailScreen } from 'expo-app/features/catalog/screens/CatalogItemDetailScreen';
import { ProGate } from 'expo-app/features/purchases';

export default function CatalogItemDetailPage() {
  return (
    <ProGate>
      <CatalogItemDetailScreen />
    </ProGate>
  );
}
