import { featureFlags } from 'expo-app/config';
import { PaywallGate } from 'expo-app/features/purchases';
import { WildlifeScreen } from 'expo-app/features/wildlife/screens/WildlifeScreen';
import { Redirect } from 'expo-router';

export default function WildlifeRoute() {
  if (!featureFlags.enableWildlifeIdentification) {
    return <Redirect href="/" />;
  }
  return (
    <PaywallGate>
      <WildlifeScreen />
    </PaywallGate>
  );
}
