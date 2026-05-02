import { WildlifeScreen } from '@packrat/app/wildlife/screens/WildlifeScreen';
import { featureFlags } from 'expo-app/config';
import { Redirect } from 'expo-router';

export default function WildlifeRoute() {
  if (!featureFlags.enableWildlifeIdentification) {
    return <Redirect href="/" />;
  }
  return <WildlifeScreen />;
}
