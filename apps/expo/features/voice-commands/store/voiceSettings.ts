import { observable } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import { persistPlugin } from 'expo-app/lib/persist-plugin';

/**
 * The user's switches for voice commands, on this phone. The `enableVoiceCommands` flag is the
 * gate; these are the user's say once it's open.
 */
export const voiceSettingsStore = observable<{
  /** On by default: the flag decides whether voice commands exist at all. */
  enabled: boolean;
  /** Answers are said out loud as well as shown; off means shown only. */
  spokenAnswers: boolean;
}>({ enabled: true, spokenAnswers: true });

syncObservable(voiceSettingsStore, {
  persist: { plugin: persistPlugin, name: 'voiceSettings' },
});
