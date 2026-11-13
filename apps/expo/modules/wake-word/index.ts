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
  setHeadsetActive(active: boolean): void;
  addListener<E extends keyof WakeWordEvents>(
    event: E,
    listener: WakeWordEvents[E],
  ): EventSubscription;
}

/** "Hey PackRat" detection on the phone. Android only; null where the native module isn't built in. */
export const WakeWord = requireOptionalNativeModule<WakeWordNativeModule>('WakeWord');
