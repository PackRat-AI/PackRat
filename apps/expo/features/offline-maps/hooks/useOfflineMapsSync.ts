import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useEffect } from 'react';
import { startOfflineMaps } from '../lib/offlineMapManager';

/**
 * Resumes map downloads that stopped when the app closed, and starts or pauses them as the phone
 * moves between Wi-Fi and cellular. Mounted once, at the app root.
 */
export function useOfflineMapsSync() {
  const enabled = useFeatureFlag('enableOfflineMaps');
  useEffect(() => (enabled ? startOfflineMaps() : undefined), [enabled]);
}
