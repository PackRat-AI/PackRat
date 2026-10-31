import { observable } from '@legendapp/state';
import type { TripSummit } from '@packrat/schemas/trips';

/**
 * The peak chosen on the picker screen, handed back to the screen that opened it. Routes can't
 * carry a callback, so the opener clears this before pushing the picker and consumes it when it
 * regains focus.
 */
export const pickedPeak$ = observable<TripSummit | null>(null);

/** Takes the pending pick, if any, so a later focus doesn't add it twice. */
export function consumePickedPeak(): TripSummit | null {
  const peak = pickedPeak$.peek();
  if (peak) pickedPeak$.set(null);
  return peak;
}
