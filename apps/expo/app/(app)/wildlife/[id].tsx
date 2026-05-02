import { featureFlags } from '@packrat/app/config';
import { SpeciesDetailScreen } from '@packrat/app/wildlife/screens/SpeciesDetailScreen';
import { Redirect } from 'expo-router';

export default function SpeciesDetailRoute() {
  if (!featureFlags.enableWildlifeIdentification) {
    return <Redirect href="/" />;
  }
  return <SpeciesDetailScreen />;
}
