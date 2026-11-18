import { OfflineRegionListScreen } from 'expo-app/features/offline-maps';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect } from 'expo-router';

export default function OfflineRegionListRoute() {
  const enableOfflineMaps = useFeatureFlag('enableOfflineMaps');
  if (!enableOfflineMaps) return <Redirect href="/" />;
  return <OfflineRegionListScreen />;
}
