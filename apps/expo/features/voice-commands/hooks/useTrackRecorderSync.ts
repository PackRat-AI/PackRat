import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useEffect } from 'react';
import { resumeRecordingIfNeeded } from '../lib/trackRecorder';
import { resumeGuidanceIfNeeded } from '../lib/tripGuide';

/** Mount once inside the signed-in app: carries on a recording or guidance PackRat was closed in the middle of. */
export function useTrackRecorderSync({ isAuthed }: { isAuthed: boolean }) {
  const enabled = useFeatureFlag('enableVoiceCommands') && isAuthed;

  useEffect(() => {
    if (!enabled) return;
    void resumeRecordingIfNeeded();
    void resumeGuidanceIfNeeded();
  }, [enabled]);
}
