import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useEffect } from 'react';
import { resumeRecordingIfNeeded } from '../lib/trackRecorder';

/** Mount once inside the signed-in app: carries on a recording PackRat was closed in the middle of. */
export function useTrackRecorderSync({ isAuthed }: { isAuthed: boolean }) {
  const enabled = useFeatureFlag('enableVoiceCommands') && isAuthed;

  useEffect(() => {
    if (enabled) void resumeRecordingIfNeeded();
  }, [enabled]);
}
