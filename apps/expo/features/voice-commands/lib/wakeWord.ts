import { observable, observe } from '@legendapp/state';
import * as Sentry from '@sentry/react-native';
import { tripsStore } from 'expo-app/features/trips/store/trips';
import { obs } from 'expo-app/lib/store';
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
/** The followed trip's id, observable so its status is watched as the trip changes. */
const followedTripId = observable<string | null>(null);
let settingsObserved = false;
/** Bumped by every settings application, so one that waited on a permission lookup can tell it's stale. */
let applyRun = 0;
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
  followedTripId.set(tripId);
  if (!settingsObserved) {
    settingsObserved = true;
    observe(() => {
      voiceSettingsStore.enabled.get();
      voiceSettingsStore.wakeWord.get();
      voiceSettingsStore.headsetShortcut.get();
      // Hands-free ends with the trip, wherever it was ended from.
      const id = followedTripId.get();
      const trip = id ? obs({ store: tripsStore, id }).get() : undefined;
      if (id && (!trip || trip.status === 'complete')) {
        leaveTrip(id);
        return;
      }
      void applySettings();
    });
  } else {
    void applySettings();
  }
}

/** The trip ended: switch hands-free off. */
export function leaveTrip(tripId: string): void {
  if (followed?.tripId !== tripId) return;
  followed = null;
  followedTripId.set(null);
  disarmWakeWord(tripId);
}

/** The switches as they stand: both off while voice commands as a whole are off. */
function currentSettings(): { listen: boolean; headset: boolean } {
  const enabled = voiceSettingsStore.enabled.peek() !== false;
  return {
    listen: enabled && voiceSettingsStore.wakeWord.peek(),
    headset: enabled && voiceSettingsStore.headsetShortcut.peek() !== false,
  };
}

/** Arms or disarms for the followed trip. The trip stays followed, so switching back on restores it. */
async function applySettings(): Promise<void> {
  const run = ++applyRun;
  const trip = followed;
  if (!trip) return;
  const { listen, headset } = currentSettings();
  if (!listen && !headset) return disarmWakeWord(trip.tripId);
  // The service needs the microphone permission before Android lets it start.
  const { granted } = await ExpoSpeechRecognitionModule.getPermissionsAsync();
  // A newer change has applied itself meanwhile; arming now would undo it.
  if (!granted || followed !== trip || run !== applyRun) return;
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
