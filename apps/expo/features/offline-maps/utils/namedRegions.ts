import type {
  NationalPark,
  NationalParkRow,
} from 'expo-app/features/trip-stats/utils/parksAndPeaks';
import type { PlaceAtlas } from 'expo-app/features/trip-stats/utils/places';
import type { Coordinate } from 'expo-app/features/trip-stats/utils/polyline';
import type { LonLat } from '../types';
import { TILE_PACK_BUDGET, tilePacks } from './offlineArea';

export type NamedRegionKind = 'park' | 'forest' | 'region' | 'country';

/** The order the region list shows its sections in. */
export const NAMED_REGION_KINDS = Object.freeze(['park', 'forest', 'region', 'country'] as const);

/**
 * A place with a known outline that can be saved by name: a national park, a national forest or
 * grassland, a state or province, or a country. Mirrors `OfflineNamedRegion` in the Swift app.
 */
export type OfflineNamedRegion = {
  id: string;
  name: string;
  /** The park's or forest's states, or a region's country. Empty for a country. */
  subtitle: string;
  kind: NamedRegionKind;
  rings: LonLat[][];
};

/** A row of the bundled `nationalForests.json`, laid out like `nationalParks.json`. */
export type NationalForestRow = NationalParkRow;

const lonLatRings = (rings: Coordinate[][]): LonLat[][] =>
  rings.map((ring) => ring.map((point): LonLat => [point.longitude, point.latitude]));

/** Flat `[lng, lat, lng, lat, …]` rings as pairs. */
const pairedRings = (rings: number[][]): LonLat[][] =>
  rings.map((flat) => {
    const ring: LonLat[] = [];
    for (let index = 0; index + 1 < flat.length; index += 2) {
      ring.push([flat[index] ?? 0, flat[index + 1] ?? 0]);
    }
    return ring;
  });

/** Every park, forest, state, province and country with an outline, sorted by name. */
export function buildNamedRegions({
  parks,
  forests,
  atlas,
  countryName,
}: {
  parks: Pick<NationalPark, 'code' | 'name' | 'states' | 'rings'>[];
  forests: NationalForestRow[];
  atlas: Pick<PlaceAtlas, 'countries' | 'regions'>;
  /** The country's display name for a code, falling back to the atlas name. */
  countryName: (code: string) => string;
}): OfflineNamedRegion[] {
  const regions: OfflineNamedRegion[] = [
    ...parks.map((park) => ({
      id: `park-${park.code}`,
      name: `${park.name} National Park`,
      subtitle: park.states.join(', '),
      kind: 'park' as const,
      rings: lonLatRings(park.rings),
    })),
    ...forests.map((forest) => ({
      id: `forest-${forest.code}`,
      name: forest.name,
      subtitle: forest.states.join(', '),
      kind: 'forest' as const,
      rings: pairedRings(forest.rings),
    })),
    ...atlas.regions.map((region) => ({
      id: `region-${region.code}`,
      name: region.name,
      subtitle: region.countryCode ? countryName(region.countryCode) : '',
      kind: 'region' as const,
      rings: lonLatRings(region.rings),
    })),
    // A country that is the union of its regions carries no outline of its own.
    ...atlas.countries
      .filter((country) => country.rings.length > 0)
      .map((country) => ({
        id: `country-${country.code}`,
        name: country.name,
        subtitle: '',
        kind: 'country' as const,
        rings: lonLatRings(country.rings),
      })),
  ];
  return regions.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Whether the region is small enough to save whole at Standard detail. Big states and countries
 * are left out of the list rather than offered and then refused.
 */
export function isSaveable(region: Pick<OfflineNamedRegion, 'rings'>): boolean {
  return (
    tilePacks({ rings: region.rings, detail: 'standard', maxPacks: TILE_PACK_BUDGET }).size <=
    TILE_PACK_BUDGET
  );
}

/** Regions whose name or subtitle contains the query, ignoring case and accents. */
export function matchRegions({
  regions,
  query,
}: {
  regions: OfflineNamedRegion[];
  query: string;
}): OfflineNamedRegion[] {
  const fold = (text: string) =>
    text
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  const needle = fold(query.trim());
  if (!needle) return regions;
  return regions.filter(
    (region) => fold(region.name).includes(needle) || fold(region.subtitle).includes(needle),
  );
}

/** The region's outline as one GeoJSON feature, the way the tile store takes a download frame. */
export function boundaryFeatureCollection(rings: LonLat[][]) {
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {},
        // Each ring as its own polygon: an outline is islands and holes alike, and saving a hole's
        // tiles too costs little.
        geometry: { type: 'MultiPolygon' as const, coordinates: rings.map((ring) => [ring]) },
      },
    ],
  };
}
