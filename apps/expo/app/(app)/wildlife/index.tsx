import { featureFlags } from '@packrat/app/config';
import { WildlifeScreen } from '@packrat/app/wildlife/screens/WildlifeScreen';
import { Redirect } from 'expo-router';

export default function WildlifeRoute() {
  if (!featureFlags.enableWildlifeIdentification) {
    return <Redirect href="/" />;
  }
  return <WildlifeScreen />;
}
