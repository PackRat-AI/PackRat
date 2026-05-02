import { SpeciesDetailScreen } from '@packrat/app/wildlife/screens/SpeciesDetailScreen';
import { featureFlags } from 'expo-app/config';
import { Redirect } from 'expo-router';

export default function SpeciesDetailRoute() {
  if (!featureFlags.enableWildlifeIdentification) {
    return <Redirect href="/" />;
  }
  return <SpeciesDetailScreen />;
}
