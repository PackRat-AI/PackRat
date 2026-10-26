import { observable } from '@legendapp/state';
import type { TripTrail } from '@packrat/schemas/trips';

/**
 * The trail chosen on the picker screen, handed back to the trip log that opened it, the same
 * hand-off as the peak picker: the opener clears this before pushing the picker and consumes it
 * when it regains focus.
 */
export const pickedTrail$ = observable<TripTrail | null>(null);

/** Takes the pending pick, if any, so a later focus doesn't add it twice. */
export function consumePickedTrail(): TripTrail | null {
  const trail = pickedTrail$.peek();
  if (trail) pickedTrail$.set(null);
  return trail;
}
