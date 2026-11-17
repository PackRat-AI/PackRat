import { observable } from '@legendapp/state';
import type { Coordinate } from '../utils/polyline';

/**
 * The route drawn on the drawing screen, handed back to the trip log. Routes can't carry a
 * callback, so the log clears this before pushing the screen and consumes it when it regains focus.
 */
export const drawnRoute$ = observable<Coordinate[] | null>(null);

/** Takes the pending route, if any, so a later focus doesn't apply it twice. */
export function consumeDrawnRoute(): Coordinate[] | null {
  const route = drawnRoute$.peek();
  if (route) drawnRoute$.set(null);
  return route;
}
