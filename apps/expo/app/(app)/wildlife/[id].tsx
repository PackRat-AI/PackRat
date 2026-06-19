import { featureFlags } from 'expo-app/config';
import { ProGate } from 'expo-app/features/purchases';
import { SpeciesDetailScreen } from 'expo-app/features/wildlife/screens/SpeciesDetailScreen';
import { Redirect } from 'expo-router';

export default function SpeciesDetailRoute() {
  if (!featureFlags.enableWildlifeIdentification) {
    return <Redirect href="/" />;
  }
  return (
    <ProGate>
      <SpeciesDetailScreen />
    </ProGate>
  );
}
