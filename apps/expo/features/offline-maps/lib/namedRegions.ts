import { getNationalParks } from 'expo-app/features/trip-stats/lib/nationalParks';
import { getPlaceAtlas, localizedCountryName } from 'expo-app/features/trip-stats/lib/places';
import {
  buildNamedRegions,
  isSaveable,
  type NationalForestRow,
  type OfflineNamedRegion,
} from '../utils/namedRegions';

let all: OfflineNamedRegion[] | null = null;
let measured: Promise<MeasuredRegion[]> | null = null;

/** A region and whether it fits whole at Standard detail. */
export type MeasuredRegion = { region: OfflineNamedRegion; fits: boolean };

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
 * Every region, marked with whether it is small enough to save whole at Standard detail, so the
 * list can say so up front. Counting tiles over hundreds of outlines takes a moment, so it yields
 * between batches to keep the list's spinner moving, and the answer is kept for the session.
 */
export function getMeasuredRegions(): Promise<MeasuredRegion[]> {
  if (!measured) {
    measured = (async () => {
      const regions = getNamedRegions();
      const result: MeasuredRegion[] = [];
      for (let index = 0; index < regions.length; index++) {
        if (index % 20 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
        const region = regions[index];
        if (region) result.push({ region, fits: isSaveable(region) });
      }
      return result;
    })();
    // A failed count is tried again the next time the list opens.
    measured.catch(() => {
      measured = null;
    });
  }
  return measured;
}
