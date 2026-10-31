import { atlasFromFile, type PlaceAtlas, type PlacesFile } from '../utils/places';
import type { PlacesCache } from '../utils/tripPlaces';

let cachedAtlas: PlaceAtlas | null = null;

/** Trip answers outlive a render: a trip's place only changes with its location or route. */
export const placesCache: PlacesCache = new Map();

/**
 * Every country and region from the bundled boundary file. Parsed on first use rather than at
 * import: the file is over a megabyte and only Trip Stats reads it.
 */
export function getPlaceAtlas(): PlaceAtlas {
  if (!cachedAtlas) {
    const file: PlacesFile = require('../data/places.json');
    cachedAtlas = atlasFromFile(file);
  }
  return cachedAtlas;
}

let displayNames: Intl.DisplayNames | null | undefined;

/** The country's name in the device language where the engine has `Intl.DisplayNames`. */
export function localizedCountryName(code: string): string | null {
  if (displayNames === undefined) {
    displayNames =
      'DisplayNames' in Intl ? new Intl.DisplayNames(undefined, { type: 'region' }) : null;
  }
  if (!displayNames || code.length !== 2) return null;
  try {
    return displayNames.of(code) ?? null;
  } catch {
    return null;
  }
}
