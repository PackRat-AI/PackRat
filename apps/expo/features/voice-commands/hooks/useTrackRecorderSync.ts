import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useEffect } from 'react';
import { resumeRecordingIfNeeded, suspendRecording } from '../lib/trackRecorder';
import { resumeGuidanceIfNeeded, suspendGuidance } from '../lib/tripGuide';

/**
 * Mount once inside the signed-in app: carries on a recording or guidance PackRat was closed in
 * the middle of. Signing out or switching voice commands off stops both collecting location; what
 * was recorded stays for when they're back.
 */
export function useTrackRecorderSync({ isAuthed }: { isAuthed: boolean }) {
  const enabled = useFeatureFlag('enableVoiceCommands') && isAuthed;

  useEffect(() => {
    const suspend = () => {
      void suspendRecording();
      void suspendGuidance();
    };
    if (!enabled) {
      suspend();
      return;
    }
    void resumeRecordingIfNeeded();
    void resumeGuidanceIfNeeded();
    return suspend;
  }, [enabled]);
}
