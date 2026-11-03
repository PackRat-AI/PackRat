import { use$ } from '@legendapp/state/react';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { syncTracking } from '../lib/locationTracking';
import { flushSafetyQueue, safetyStore } from '../store/safetyCheckIn';

/** How often queued writes are retried while some are waiting for signal. */
const RETRY_INTERVAL_MS = 60_000;

/**
 * Mount once inside the signed-in app. Restarts background tracking after a relaunch, and sends
 * queued check-ins, extensions and I'm Safe as soon as there is signal: on launch, whenever the
 * app returns to the foreground, and every minute while anything is waiting.
 */
export function useSafetyCheckInSync({ isAuthed }: { isAuthed: boolean }) {
  const enabled = useFeatureFlag('enableSafetyCheckIn') && isAuthed;
  const waiting = use$(() => safetyStore.queue.get().length > 0);

  useEffect(() => {
    if (!enabled) return;
    void syncTracking();
    void flushSafetyQueue();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void flushSafetyQueue();
    });
    return () => subscription.remove();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !waiting) return;
    const id = setInterval(() => void flushSafetyQueue(), RETRY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [enabled, waiting]);
}
