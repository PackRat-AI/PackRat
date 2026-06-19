import { featureFlags } from 'expo-app/config';
import { ProGate } from 'expo-app/features/purchases';
import { IdentificationScreen } from 'expo-app/features/wildlife/screens/IdentificationScreen';
import { Redirect } from 'expo-router';

export default function IdentifyRoute() {
  if (!featureFlags.enableWildlifeIdentification) {
    return <Redirect href="/" />;
  }
  return (
    <ProGate>
      <IdentificationScreen />
    </ProGate>
  );
}
