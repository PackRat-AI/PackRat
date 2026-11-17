import { use$ } from '@legendapp/state/react';
import { tripsStore } from 'expo-app/features/trips/store/trips';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useEffect } from 'react';
import { syncSafetyAnnouncer } from '../lib/safetyAnnouncer';
import { voiceSettingsStore } from '../store/voiceSettings';

/** Mount once inside the signed-in app: spoken safety alerts reach the trip in progress from here, with no trip page open. */
export function useSafetyAnnouncerSync({ isAuthed }: { isAuthed: boolean }) {
  const flag = useFeatureFlag('enableVoiceCommands');
  const voiceOn = use$(voiceSettingsStore.enabled) !== false;
  const enabled = flag && isAuthed && voiceOn;
  const trip = use$(
    () =>
      Object.values(tripsStore.get() ?? {})
        .filter((candidate) => candidate.status === 'in_progress' && !candidate.deleted)
        .sort((a, b) => String(b.startedAt ?? '').localeCompare(String(a.startedAt ?? '')))[0],
  );

  useEffect(() => {
    syncSafetyAnnouncer(enabled ? (trip ?? null) : null);
  }, [enabled, trip]);
}
