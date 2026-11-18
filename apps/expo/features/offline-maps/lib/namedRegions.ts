import { getNationalParks } from 'expo-app/features/trip-stats/lib/nationalParks';
import { getPlaceAtlas, localizedCountryName } from 'expo-app/features/trip-stats/lib/places';
import {
  buildNamedRegions,
  isSaveable,
  type NationalForestRow,
  type OfflineNamedRegion,
} from '../utils/namedRegions';

let all: OfflineNamedRegion[] | null = null;
let saveable: Promise<OfflineNamedRegion[]> | null = null;

/**
 * Every park, forest, state, province and country the app carries an outline for. Parsed on first
 * use: the boundary files run to several megabytes and only the region list reads them.
 */
export function getNamedRegions(): OfflineNamedRegion[] {
  if (!all) {
    const atlas = getPlaceAtlas();
    const forests: NationalForestRow[] = require('../data/nationalForests.json');
    all = buildNamedRegions({
      parks: getNationalParks(),
      forests,
      atlas,
      countryName: (code) =>
        localizedCountryName(code) ?? atlas.countriesByCode.get(code)?.name ?? code,
    });
  }
  return all;
}

export function getNamedRegion(id: string): OfflineNamedRegion | undefined {
  return getNamedRegions().find((region) => region.id === id);
}

/**
 * The regions small enough to save whole at Standard detail. Counting tiles over hundreds of
 * outlines takes a moment, so it yields between batches to keep the list's spinner moving, and the
 * answer is kept for the rest of the session.
 */
export function getSaveableRegions(): Promise<OfflineNamedRegion[]> {
  if (!saveable) {
    saveable = (async () => {
      const regions = getNamedRegions();
      const kept: OfflineNamedRegion[] = [];
      for (let index = 0; index < regions.length; index++) {
        if (index % 20 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
        const region = regions[index];
        if (region && isSaveable(region)) kept.push(region);
      }
      return kept;
    })();
    // A failed count is tried again the next time the list opens.
    saveable.catch(() => {
      saveable = null;
    });
  }
  return saveable;
}
