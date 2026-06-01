/**
 * Numeric / math utilities — curated re-exports. See ./provenance for source mapping.
 */

// es-toolkit — *-by selectors + precision round (radashi's `round` has no
// precision argument, so es-toolkit wins here on capability)
export { maxBy, meanBy, minBy, round, sumBy } from 'es-toolkit';
// radashi — sum, clamp, min/max, numeric coercion (toFloat/toInt are the
// "old-school" coercions; radashi covers them, so lodash isn't needed here)
export { clamp, max, min, sum, toFloat, toInt } from 'radashi';
