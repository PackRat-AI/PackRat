import { featureFlags } from 'app/config';
import { WildlifeScreen } from 'app/features/wildlife/screens/WildlifeScreen';
import { Redirect } from 'expo-router';

export default function WildlifeRoute() {
  if (!featureFlags.enableWildlifeIdentification) {
    return <Redirect href="/" />;
  }
  return <WildlifeScreen />;
}
