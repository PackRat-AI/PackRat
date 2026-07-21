import { WildlifeScreen } from 'expo-app/features/wildlife/screens/WildlifeScreen';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect } from 'expo-router';

export default function WildlifeRoute() {
  const enableWildlifeIdentification = useFeatureFlag('enableWildlifeIdentification');
  if (!enableWildlifeIdentification) {
    return <Redirect href="/" />;
  }
  return <WildlifeScreen />;
}
