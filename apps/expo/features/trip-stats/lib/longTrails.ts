import {
  type LongTrail,
  type LongTrailCache,
  type LongTrailRow,
  longTrailFromRow,
} from '../utils/longTrails';

let cached: LongTrail[] | null = null;

/** Trip answers outlive a render: a trip's walked stretch only changes with its route. */
export const longTrailCache: LongTrailCache = new Map();

/** Every long trail, from the bundled centerlines, parsed on first use like the other datasets. */
export function getLongTrails(): LongTrail[] {
  if (!cached) {
    const rows: LongTrailRow[] = require('../data/longTrails.json');
    cached = rows.map(longTrailFromRow);
  }
  return cached;
}

export function findLongTrail(code: string | null | undefined): LongTrail | null {
  if (!code) return null;
  return getLongTrails().find((trail) => trail.code === code) ?? null;
}
