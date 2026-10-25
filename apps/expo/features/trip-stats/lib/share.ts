import { observable } from '@legendapp/state';
import type { GoalProgress } from '../utils/goalProgress';
import type { Coordinate } from '../utils/polyline';
import type { Totals } from '../utils/tripStats';
import type { ReviewPage, YearInReview } from '../utils/yearInReview';

/**
 * The shapes a shared image comes in, after Strava's share sheet: a story (9:16, Instagram and
 * Snapchat), a square post, and a transparent sticker to lay over a photo.
 */
export const SHARE_FORMATS = Object.freeze(['story', 'square', 'sticker'] as const);
export type ShareFormat = (typeof SHARE_FORMATS)[number];

/** Card size in dp, captured at 3× so a story is 1080 × 1920 px. A sticker is as tall as its content. */
export const CARD_WIDTH = 360;
export const CARD_SCALE = 3;
export function cardHeight(format: ShareFormat): number | null {
  return format === 'story' ? 640 : format === 'square' ? 360 : null;
}

/** Width over height of the map area on a map card. */
export function mapAspect(format: ShareFormat): number {
  return format === 'square' ? 2 : 1.15;
}

/**
 * One card's worth of numbers, built from the stats the screen already shows. A card never
 * carries trip names, notes or exact places unless the user turns that on before sharing.
 */
export type ShareContent =
  | { kind: 'totals'; totals: Totals }
  | { kind: 'year'; year: number; totals: Totals; lastYear: Totals | null }
  | {
      kind: 'map';
      routes: Coordinate[][];
      pins: Coordinate[];
      trips: number;
      distance: number | null;
    }
  | { kind: 'goal'; progress: GoalProgress }
  | { kind: 'parks'; visited: string[] }
  | { kind: 'review'; review: YearInReview; page: ReviewPage };

export interface ShareOptions {
  showNames: boolean;
  /** Off: the map is held at least `PRIVATE_SPAN_METRES` across, showing the region, not the spot. */
  zoomClose: boolean;
}

/** True when the card would name a trip, so the share screen offers the toggle. */
export function canShowNames(content: ShareContent): boolean {
  return (
    content.kind === 'review' &&
    content.page === 'longestTrip' &&
    (content.review.longestTrip != null || content.review.farthestTrip != null)
  );
}

/**
 * The card on its way to the share screen, and the review on its way to the year-in-review
 * screen. Both hold dates and nested records that don't fit in route params, so the opener sets
 * them before pushing, as the pickers hand their picks back.
 */
export const pendingShare$ = observable<ShareContent | null>(null);
export const pendingReview$ = observable<YearInReview | null>(null);
