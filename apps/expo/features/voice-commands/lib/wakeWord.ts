import * as Sentry from '@sentry/react-native';
import { WakeWord } from 'expo-app/modules/wake-word';
import i18next from 'i18next';

/**
 * "Hey PackRat" and the headset's long press while a trip is underway. The native service owns
 * the microphone and detection; this keeps which trip it's for and steps it aside while PackRat
 * listens itself.
 */
let armed: { tripId: string; listen: boolean } | null = null;
let onStart: (() => void) | null = null;
/** The native events are subscribed once, for the life of the app. */
let subscribed = false;

export function isWakeWordAvailable(): boolean {
  return WakeWord != null;
}

/**
 * Starts the service for this trip: listening for "Hey PackRat" when `listen` is set, and starting
 * a command on the headset's long press when `headset` is. Must be called with the app on screen.
 */
export function armWakeWord({
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

/** PackRat has finished listening and speaking: listen for "Hey PackRat" again. */
export function resumeWakeWord(): void {
  if (armed?.listen) WakeWord?.resume();
}
