/**
 * Array utilities — curated re-exports. See ./provenance for source mapping.
 */

// es-toolkit — chunk (radashi's equivalent is `cluster`; `chunk` is the
// ecosystem-standard name, so we source it here)
export { chunk } from 'es-toolkit';
// radashi — dedupe, group, sort, build, first/last (safe index-0/-1 access)
export { first, group, last, list, sort, unique } from 'radashi';
