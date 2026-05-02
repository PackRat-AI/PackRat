import { IdentificationScreen } from '@packrat/app/wildlife/screens/IdentificationScreen';
import { featureFlags } from 'expo-app/config';
import { Redirect } from 'expo-router';

export default function IdentifyRoute() {
  if (!featureFlags.enableWildlifeIdentification) {
    return <Redirect href="/" />;
  }
  return <IdentificationScreen />;
}
