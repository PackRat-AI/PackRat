import CatalogItemsScreen from 'expo-app/features/catalog/screens/CatalogItemsScreen';
import { EarlyAccessGate } from 'expo-app/features/purchases';

// TEST SCAFFOLDING (revenuecat webhook live test) — remove the EarlyAccessGate
// wrapper when done. Gates the catalog screen so the live webhook test can watch
// Pro access flip on the client. See docs live-test runbook.
export default function CatalogItemsPage() {
  return (
    <EarlyAccessGate featureKey="catalog">
      <CatalogItemsScreen />
    </EarlyAccessGate>
  );
}
