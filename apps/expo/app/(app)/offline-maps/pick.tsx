import { OfflineAreaPickerScreen } from 'expo-app/features/offline-maps';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect } from 'expo-router';

export default function OfflineAreaPickerRoute() {
  const enableOfflineMaps = useFeatureFlag('enableOfflineMaps');
  if (!enableOfflineMaps) return <Redirect href="/" />;
  return <OfflineAreaPickerScreen />;
}
