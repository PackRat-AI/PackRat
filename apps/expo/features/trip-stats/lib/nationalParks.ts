import { type NationalPark, type NationalParkRow, parkFromRow } from '../utils/parksAndPeaks';

let cached: NationalPark[] | null = null;

/**
 * Every US National Park, by name, from the bundled boundary file. Parsed on first use rather
 * than at import: the file is over a megabyte and only Trip Stats reads it.
 */
export function getNationalParks(): NationalPark[] {
  if (!cached) {
    const rows: NationalParkRow[] = require('../data/nationalParks.json');
    cached = rows.map(parkFromRow).sort((a, b) => a.name.localeCompare(b.name));
  }
  return cached;
}
