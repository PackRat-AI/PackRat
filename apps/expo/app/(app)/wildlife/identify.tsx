import { featureFlags } from '@packrat/app/config';
import { IdentificationScreen } from '@packrat/app/wildlife/screens/IdentificationScreen';
import { Redirect } from 'expo-router';

export default function IdentifyRoute() {
  if (!featureFlags.enableWildlifeIdentification) {
    return <Redirect href="/" />;
  }
  return <IdentificationScreen />;
}
