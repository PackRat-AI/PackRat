import { observe } from '@legendapp/state';
import * as Sentry from '@sentry/react-native';
import { WakeWord } from 'expo-app/modules/wake-word';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import i18next from 'i18next';
import { voiceSettingsStore } from '../store/voiceSettings';

/**
 * "Hey PackRat" and the headset's long press while a trip is underway. The native service owns
 * the microphone and detection; this keeps which trip it's for and steps it aside while PackRat
 * listens itself.
 */
let armed: { tripId: string; listen: boolean } | null = null;
let onStart: (() => void) | null = null;
/** The trip underway, while the trip page has it open or left it in the background. */
let followed: { tripId: string; onCommand: () => void } | null = null;
let settingsObserved = false;
/** The native events are subscribed once, for the life of the app. */
let subscribed = false;

export function isWakeWordAvailable(): boolean {
  return WakeWord != null;
}

/**
 * Keeps the service in step with the trip and the user's switches. A change in Settings takes
 * effect straight away, without the trip page having to come back on screen.
 */
export function followTrip({ tripId, onCommand }: { tripId: string; onCommand: () => void }): void {
  followed = { tripId, onCommand };
  if (!settingsObserved) {
    settingsObserved = true;
    observe(() => {
      const listen = voiceSettingsStore.wakeWord.get();
      const headset = voiceSettingsStore.headsetShortcut.get() !== false;
      void applySettings({ listen, headset });
    });
  } else {
    void applySettings({
      listen: voiceSettingsStore.wakeWord.peek(),
      headset: voiceSettingsStore.headsetShortcut.peek() !== false,
    });
  }
}

/** The trip ended: switch hands-free off. */
export function leaveTrip(tripId: string): void {
  if (followed?.tripId !== tripId) return;
  followed = null;
  disarmWakeWord(tripId);
}

async function applySettings({
  listen,
  headset,
}: {
  listen: boolean;
  headset: boolean;
}): Promise<void> {
  const trip = followed;
  if (!trip) return;
  if (!listen && !headset) return disarmWakeWord(trip.tripId);
  // The service needs the microphone permission before Android lets it start.
  const { granted } = await ExpoSpeechRecognitionModule.getPermissionsAsync();
  if (!granted || followed !== trip) return;
  armWakeWord({ tripId: trip.tripId, listen, headset, onCommand: trip.onCommand });
}

/**
 * Starts the service for this trip: listening for "Hey PackRat" when `listen` is set, and starting
 * a command on the headset's long press when `headset` is. Must be called with the app on screen.
 */
function armWakeWord({
  tripId,
  listen,
  headset,
  onCommand,
}: {
  tripId: string;
  listen: boolean;
  headset: boolean;
  onCommand: () => void;
}): void {
  if (!WakeWord) return;
  onStart = onCommand;
  if (!subscribed) {
    WakeWord.addListener('onWake', () => onStart?.());
    WakeWord.addListener('onHeadset', () => onStart?.());
    subscribed = true;
  }
  WakeWord.setHeadsetActive(headset);
  if (armed?.tripId === tripId && armed.listen === listen && WakeWord.isArmed()) return;
  armed = { tripId, listen };
  try {
    WakeWord.arm(
      i18next.t(
        listen ? 'voiceCommands.wake.notificationTitle' : 'voiceCommands.wake.headsetTitle',
      ),
      i18next.t(listen ? 'voiceCommands.wake.notificationBody' : 'voiceCommands.wake.headsetBody'),
      i18next.t('voiceCommands.wake.channel'),
      listen,
    );
    Sentry.addBreadcrumb({
      category: 'voiceCommands',
      message: 'Hands-free armed',
      level: 'info',
      data: { tripId, listen, headset },
    });
  } catch (error) {
    armed = null;
    Sentry.captureException(error, {
      tags: { feature: 'voiceCommands', action: 'armWakeWord' },
      extra: { tripId, listen, headset },
    });
  }
}

/** Stops the service, for this trip only when one is given. */
export function disarmWakeWord(tripId?: string): void {
  if (!WakeWord || (tripId && armed?.tripId !== tripId)) return;
  armed = null;
  onStart = null;
  WakeWord.setHeadsetActive(false);
  WakeWord.disarm();
}

/** PackRat is about to listen itself: the wake listener lets go of the microphone. */
export function pauseWakeWord(): void {
  if (armed?.listen) WakeWord?.pause();
}

/**
 * PackRat has finished listening and speaking: listen for "Hey PackRat" again, and let the phone
 * sleep.
 */
export function resumeWakeWord(): void {
  if (armed) WakeWord?.resume();
}
