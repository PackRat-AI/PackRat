import * as Speech from 'expo-speech';
import { useCallback } from 'react';

/**
 * Hook for text-to-speech voice feedback.
 * Uses expo-speech for on-device TTS (no internet required).
 */
export function useSpeech() {
  const speak = useCallback((text: string) => {
    Speech.stop();
    Speech.speak(text, {
      language: 'en-US',
      pitch: 1.0,
      rate: 0.9,
    });
  }, []);

  const stop = useCallback(() => {
    Speech.stop();
  }, []);

  const isSpeaking = useCallback(async (): Promise<boolean> => {
    return Speech.isSpeakingAsync();
  }, []);

  return { speak, stop, isSpeaking };
}
