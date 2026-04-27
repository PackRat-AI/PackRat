import { featureFlags } from 'app/config';
import { IdentificationScreen } from 'app/features/wildlife/screens/IdentificationScreen';
import { Redirect } from 'expo-router';

export default function IdentifyRoute() {
  if (!featureFlags.enableWildlifeIdentification) {
    return <Redirect href="/" />;
  }
  return <IdentificationScreen />;
}
