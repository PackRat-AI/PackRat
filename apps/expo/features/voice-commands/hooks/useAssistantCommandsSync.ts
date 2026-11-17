import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useEffect } from 'react';
import { syncAssistantCommands } from '../lib/assistantCommands';

/**
 * Mount once inside the signed-in app: shows the trip commands to Gemini and other assistants
 * while the voice commands flag is on. They say so themselves when the user has voice turned off.
 */
export function useAssistantCommandsSync({ isAuthed }: { isAuthed: boolean }) {
  const enabled = useFeatureFlag('enableVoiceCommands') && isAuthed;

  useEffect(() => {
    void syncAssistantCommands(enabled);
  }, [enabled]);
}
