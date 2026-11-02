/** Portrait limit: 4:5. */
export const PORTRAIT_LIMIT = 4 / 5;
/** Landscape limit: 1.91:1. */
export const LANDSCAPE_LIMIT = 1.91;
/** Shown until the first photo loads; most trail photos are landscape. */
export const PLACEHOLDER_ASPECT = 4 / 3;

/**
 * Width-over-height for a post's photos. The post takes the shape of its first photo, kept between
 * portrait 4:5 and landscape 1.91:1 so no post towers over the feed or turns into a strip.
 */
export function clampedPhotoAspect(width: number, height: number): number {
  if (!(width > 0) || !(height > 0)) return PLACEHOLDER_ASPECT;
  return Math.min(Math.max(width / height, PORTRAIT_LIMIT), LANDSCAPE_LIMIT);
}
