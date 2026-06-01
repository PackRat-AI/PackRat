/**
 * Provenance manifest — the source-of-truth for where each `@packrat/utils`
 * export comes from. Enforced by `check-utils-provenance` (packages/checks):
 *
 *  - every barrel export MUST have an entry here (and vice-versa — no stale rows);
 *  - `source` MUST be a known lib;
 *  - if any lib in `alsoIn` outranks `source` in LIB_PRIORITY, a non-empty
 *    `reason` MUST justify the lower-priority choice (the "best types +
 *    has-the-function" tiebreaker, made explicit).
 *
 * Priority is a soft default, not a rigid rule — `reason` is how a deliberate
 * lower-priority pick is recorded and kept honest. See docs/utils-policy.md.
 */

/** The five general-utility libs, highest priority first. */
export const LIB_PRIORITY = ['radashi', 'radash', 'es-toolkit', 'lodash', 'remeda'] as const;

export type RankedLib = (typeof LIB_PRIORITY)[number];

/** Sources that sit outside the priority ladder (special-purpose libs). */
export type UnrankedLib = 'destr' | 'safe-stable-stringify';

export type SourceLib = RankedLib | UnrankedLib;

export interface ProvenanceEntry {
  /** The lib this export is sourced from. */
  source: SourceLib;
  /** Higher-or-equal-priority ranked libs that ALSO expose this name. */
  alsoIn?: RankedLib[];
  /** Required when `source` is outranked by something in `alsoIn`. */
  reason?: string;
}

export const provenance: Record<string, ProvenanceEntry> = {
  // --- array ---
  unique: { source: 'radashi' },
  group: { source: 'radashi' },
  sort: { source: 'radashi' },
  list: { source: 'radashi' },
  first: { source: 'radashi' },
  last: { source: 'radashi' },
  chunk: { source: 'es-toolkit' }, // radashi's equivalent is named `cluster`

  // --- async ---
  all: { source: 'radashi' },
  guard: { source: 'radashi' },
  parallel: { source: 'radashi' },
  retry: { source: 'radashi' },
  sleep: { source: 'radashi' },
  tryit: { source: 'radashi' },

  // --- fn ---
  debounce: { source: 'radashi' },
  memo: { source: 'radashi' },
  once: { source: 'radashi' },
  throttle: { source: 'radashi' },
  pipe: { source: 'remeda' }, // typed dataLast composition primitive

  // --- json ---
  safeJsonStringify: { source: 'safe-stable-stringify' },
  stableJsonStringify: { source: 'safe-stable-stringify' },
  configureJsonStringify: { source: 'safe-stable-stringify' },
  safeJsonParse: { source: 'destr' },

  // --- math ---
  clamp: { source: 'radashi' },
  max: { source: 'radashi' },
  min: { source: 'radashi' },
  sum: { source: 'radashi' },
  toFloat: { source: 'radashi' },
  toInt: { source: 'radashi' },
  maxBy: { source: 'es-toolkit' },
  meanBy: { source: 'es-toolkit' },
  minBy: { source: 'es-toolkit' },
  sumBy: { source: 'es-toolkit' },
  round: {
    source: 'es-toolkit',
    alsoIn: ['radashi'],
    reason: 'es-toolkit `round` supports a precision argument; radashi `round` does not',
  },

  // --- object ---
  assign: { source: 'radashi' },
  mapEntries: { source: 'radashi' },
  mapValues: { source: 'radashi' },
  omit: { source: 'radashi' },
  pick: { source: 'radashi' },
  shake: { source: 'radashi' },

  // --- string ---
  capitalize: { source: 'radashi' },
  title: { source: 'radashi' },

  // --- predicates (technical source for @packrat/guards) ---
  isArray: { source: 'radashi' },
  isDate: { source: 'radashi' },
  isEmpty: { source: 'radashi' },
  isEqual: { source: 'radashi' },
  isFloat: { source: 'radashi' },
  isFunction: { source: 'radashi' },
  isInt: { source: 'radashi' },
  isNumber: { source: 'radashi' },
  isObject: { source: 'radashi' },
  isPrimitive: { source: 'radashi' },
  isPromise: { source: 'radashi' },
  isString: { source: 'radashi' },
  isSymbol: { source: 'radashi' },
};
