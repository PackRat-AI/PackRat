import { SpeciesDetailScreen } from 'expo-app/features/wildlife/screens/SpeciesDetailScreen';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect } from 'expo-router';

export default function SpeciesDetailRoute() {
  const enableWildlifeIdentification = useFeatureFlag('enableWildlifeIdentification');
  if (!enableWildlifeIdentification) {
    return <Redirect href="/" />;
  }
  return <SpeciesDetailScreen />;
}
