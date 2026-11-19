import { type EventSubscription, requireOptionalNativeModule } from 'expo-modules-core';

type WakeWordEvents = {
  onWake: () => void;
  onHeadset: () => void;
};

interface WakeWordNativeModule {
  arm(title: string, text: string, channelName: string, listen: boolean): void;
  disarm(): void;
  pause(): void;
  resume(): void;
  isArmed(): boolean;
  delay(ms: number): Promise<void>;
  setHeadsetActive(active: boolean): void;
  addListener<E extends keyof WakeWordEvents>(
    event: E,
    listener: WakeWordEvents[E],
  ): EventSubscription;
}

/** "Hey PackRat" detection on the phone. Android only; null where the native module isn't built in. */
export const WakeWord = requireOptionalNativeModule<WakeWordNativeModule>('WakeWord');

/**
 * Waits `ms`, even with the phone locked: JavaScript timers stop while the screen is off, so
 * anything a locked command waits on uses the native clock where there is one.
 */
export function delay(ms: number): Promise<void> {
  if (WakeWord) return WakeWord.delay(ms);
  return new Promise((resolve) => setTimeout(resolve, ms));
}
