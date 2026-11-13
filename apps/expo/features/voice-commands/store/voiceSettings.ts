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
  /** "Hey PackRat" while a trip is underway. Off until the user turns it on. */
  wakeWord: boolean;
  /** The trip page has asked once whether to turn on "Hey PackRat". */
  wakeWordOffered: boolean;
  /** What guidance says on its own. Arriving is always said. */
  guidanceTurns: boolean;
  guidanceMilestones: boolean;
  guidanceOffRoute: boolean;
  /** Guidance buzzes instead of speaking, and the trip page shows what it's about. */
  guidanceVibrateOnly: boolean;
}>({
  enabled: true,
  spokenAnswers: true,
  wakeWord: false,
  wakeWordOffered: false,
  guidanceTurns: true,
  guidanceMilestones: true,
  guidanceOffRoute: true,
  guidanceVibrateOnly: false,
});

syncObservable(voiceSettingsStore, {
  persist: { plugin: persistPlugin, name: 'voiceSettings' },
});
