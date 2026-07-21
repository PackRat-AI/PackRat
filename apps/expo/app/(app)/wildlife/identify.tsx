import { IdentificationScreen } from 'expo-app/features/wildlife/screens/IdentificationScreen';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect } from 'expo-router';

export default function IdentifyRoute() {
  const enableWildlifeIdentification = useFeatureFlag('enableWildlifeIdentification');
  if (!enableWildlifeIdentification) {
    return <Redirect href="/" />;
  }
  return <IdentificationScreen />;
}
