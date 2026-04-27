import { featureFlags } from 'app/config';
import { SpeciesDetailScreen } from 'app/features/wildlife/screens/SpeciesDetailScreen';
import { Redirect } from 'expo-router';

export default function SpeciesDetailRoute() {
  if (!featureFlags.enableWildlifeIdentification) {
    return <Redirect href="/" />;
  }
  return <SpeciesDetailScreen />;
}
