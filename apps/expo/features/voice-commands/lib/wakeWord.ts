import * as Sentry from '@sentry/react-native';
import { WakeWord } from 'expo-app/modules/wake-word';
import i18next from 'i18next';

/**
 * "Hey PackRat" while a trip is underway. The native service owns the microphone and detection;
 * this keeps which trip it's listening for and steps it aside while PackRat listens itself.
 */
let armedTripId: string | null = null;
let onWake: (() => void) | null = null;
/** The native event is subscribed once, for the life of the app. */
let subscribed = false;

export function isWakeWordAvailable(): boolean {
  return WakeWord != null;
}

/** Starts listening for this trip. Must be called with the app on screen. */
export function armWakeWord({ tripId, onHeard }: { tripId: string; onHeard: () => void }): void {
  if (!WakeWord) return;
  onWake = onHeard;
  if (!subscribed) {
    WakeWord.addListener('onWake', () => onWake?.());
    subscribed = true;
  }
  if (armedTripId === tripId && WakeWord.isArmed()) return;
  armedTripId = tripId;
  try {
    WakeWord.arm(
      i18next.t('voiceCommands.wake.notificationTitle'),
      i18next.t('voiceCommands.wake.notificationBody'),
      i18next.t('voiceCommands.wake.channel'),
    );
    Sentry.addBreadcrumb({
      category: 'voiceCommands',
      message: 'Wake word armed',
      level: 'info',
      data: { tripId },
    });
  } catch (error) {
    armedTripId = null;
    Sentry.captureException(error, {
      tags: { feature: 'voiceCommands', action: 'armWakeWord' },
      extra: { tripId },
    });
  }
}

/** Stops listening, for this trip only when one is given. */
export function disarmWakeWord(tripId?: string): void {
  if (!WakeWord || (tripId && armedTripId !== tripId)) return;
  armedTripId = null;
  onWake = null;
  WakeWord.disarm();
}

/** PackRat is about to listen itself: the wake listener lets go of the microphone. */
export function pauseWakeWord(): void {
  if (armedTripId) WakeWord?.pause();
}

/** PackRat has finished listening and speaking: listen for "Hey PackRat" again. */
export function resumeWakeWord(): void {
  if (armedTripId) WakeWord?.resume();
}
