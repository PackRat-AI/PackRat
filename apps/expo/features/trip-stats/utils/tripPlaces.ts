import {
  flagEmoji,
  type PlaceAtlas,
  type PlaceHit,
  placesVisitedBy,
  type RegionNoun,
  regionNoun,
} from './places';
import type { DayWindow, FinishedTrip, StatsTrip } from './tripStats';

/**
 * Countries, and states and provinces, a user's finished trips reached. Pure, like the record.
 * Ported from the Swift app's `TripPlaces`.
 *
 * A trip counts in every country and region its location or route passes through, once each
 * however long it stayed. Visits come from the trips in scope, so the year and activity filters
 * narrow them; the first-visit date comes from the whole record, so "new" means new to the user,
 * not new to the filter.
 */

export interface PlaceVisit {
  tripId: string;
  tripName: string;
  date: Date;
}

export interface RegionStatus {
  code: string;
  name: string;
  /** Newest first. */
  visits: PlaceVisit[];
  /** Over the whole record, not just the scope. */
  firstVisit: Date;
}

export interface CountryStatus {
  code: string;
  name: string;
  flag: string | null;
  /** Newest first. */
  visits: PlaceVisit[];
  /** Over the whole record, not just the scope. */
  firstVisit: Date;
  /** Busiest first. Empty for a country without states in the dataset. */
  regions: RegionStatus[];
}

export interface TripPlaces {
  /** Busiest first, then the earliest visited. */
  countries: CountryStatus[];
}

/** Answers kept per trip, location and route: matching against every boundary is the slow part. */
export type PlacesCache = Map<string, PlaceHit[]>;

function cacheKey(trip: StatsTrip): string {
  const location = trip.location ? `${trip.location.latitude},${trip.location.longitude}` : '-';
  return `${trip.id}|${location}|${trip.log?.route ?? ''}`;
}

/** Busiest first, then the earliest visited, then by name. */
function sortByBusiest<T extends { visits: unknown[]; firstVisit: Date; name: string }>(
  places: T[],
): T[] {
  return places.sort(
    (a, b) =>
      b.visits.length - a.visits.length ||
      a.firstVisit.getTime() - b.firstVisit.getTime() ||
      a.name.localeCompare(b.name),
  );
}

function newestFirst(visits: PlaceVisit[]): PlaceVisit[] {
  return [...visits].sort(
    (a, b) => b.date.getTime() - a.date.getTime() || b.tripId.localeCompare(a.tripId),
  );
}

function earliest(visits: readonly PlaceVisit[]): Date {
  return new Date(Math.min(...visits.map((visit) => visit.date.getTime())));
}

export function computeTripPlaces({
  finished,
  lifetime = finished,
  atlas,
  countryName = (code) => atlas.countriesByCode.get(code)?.name ?? code,
  cache,
}: {
  /** The trips in scope. */
  finished: readonly FinishedTrip[];
  /** Every finished trip, for first-visit dates. */
  lifetime?: readonly FinishedTrip[];
  atlas: PlaceAtlas;
  /** The country's name in the user's language; the dataset's English by default. */
  countryName?: (code: string) => string;
  cache?: PlacesCache;
}): TripPlaces {
  const hits = (trip: FinishedTrip): PlaceHit[] => {
    if (!cache) return placesVisitedBy({ atlas, trip: trip.trip });
    const key = cacheKey(trip.trip);
    const known = cache.get(key);
    if (known) return known;
    const found = placesVisitedBy({ atlas, trip: trip.trip });
    cache.set(key, found);
    return found;
  };

  const firstCountry = new Map<string, Date>();
  const firstRegion = new Map<string, Date>();
  const keepEarliest = ({
    map,
    code,
    date,
  }: {
    map: Map<string, Date>;
    code: string;
    date: Date;
  }) => {
    const known = map.get(code);
    if (!known || date < known) map.set(code, date);
  };
  for (const trip of lifetime) {
    for (const hit of hits(trip)) {
      keepEarliest({ map: firstCountry, code: hit.country, date: trip.start });
      if (hit.region) keepEarliest({ map: firstRegion, code: hit.region, date: trip.start });
    }
  }

  const countryVisits = new Map<string, PlaceVisit[]>();
  const regionVisits = new Map<string, Map<string, PlaceVisit[]>>();
  for (const trip of finished) {
    const visit = { tripId: trip.trip.id, tripName: trip.trip.name, date: trip.start };
    const tripHits = hits(trip);
    for (const country of new Set(tripHits.map((hit) => hit.country))) {
      countryVisits.set(country, [...(countryVisits.get(country) ?? []), visit]);
    }
    for (const hit of tripHits) {
      if (!hit.region) continue;
      const regions = regionVisits.get(hit.country) ?? new Map<string, PlaceVisit[]>();
      regions.set(hit.region, [...(regions.get(hit.region) ?? []), visit]);
      regionVisits.set(hit.country, regions);
    }
  }

  const countries = [...countryVisits.entries()].map(([code, visits]): CountryStatus => {
    const regions = sortByBusiest(
      [...(regionVisits.get(code) ?? new Map<string, PlaceVisit[]>()).entries()].map(
        ([regionCode, regionVisitList]): RegionStatus => ({
          code: regionCode,
          name: atlas.regionsByCode.get(regionCode)?.name ?? regionCode,
          visits: newestFirst(regionVisitList),
          firstVisit: firstRegion.get(regionCode) ?? earliest(regionVisitList),
        }),
      ),
    );
    return {
      code,
      name: countryName(code),
      flag: flagEmoji(code),
      visits: newestFirst(visits),
      firstVisit: firstCountry.get(code) ?? earliest(visits),
      regions,
    };
  });
  return { countries: sortByBusiest(countries) };
}

export function regionCount(places: TripPlaces): number {
  return places.countries.reduce((total, country) => total + country.regions.length, 0);
}

/** What the regions are called: one country's noun, or "States & Provinces" across several. */
export function regionLabel(places: TripPlaces): RegionNoun {
  const withRegions = places.countries.filter((country) => country.regions.length > 0);
  const only = withRegions[0];
  return withRegions.length === 1 && only ? regionNoun(only.code) : 'statesAndProvinces';
}

/** Countries and regions whose first visit falls inside the window, both days counted. */
export function newPlaces({
  places,
  window,
}: {
  places: TripPlaces;
  window: DayWindow;
}): { name: string }[] {
  const inWindow = (place: { firstVisit: Date }) =>
    place.firstVisit >= window.start && place.firstVisit <= window.end;
  return [
    ...places.countries.filter(inWindow),
    ...places.countries.flatMap((country) => country.regions).filter(inWindow),
  ];
}

/** The most-visited region, else country, once it has more than one trip. */
export function mostVisitedPlace(places: TripPlaces): { name: string; trips: number } | null {
  const busiest = (list: readonly { name: string; visits: PlaceVisit[] }[]) => {
    let best: { name: string; trips: number } | null = null;
    for (const place of list) {
      const trips = place.visits.length;
      if (!best || trips > best.trips || (trips === best.trips && place.name < best.name)) {
        best = { name: place.name, trips };
      }
    }
    return best && best.trips > 1 ? best : null;
  };
  return (
    busiest(places.countries.flatMap((country) => country.regions)) ??
    busiest(places.countries.slice(0, 1))
  );
}

/** The country or region with this code, with the country a region sits in. */
export function findPlace({ places, code }: { places: TripPlaces; code: string }): {
  country: CountryStatus | null;
  region: RegionStatus | null;
} {
  for (const country of places.countries) {
    if (country.code === code) return { country, region: null };
    const region = country.regions.find((item) => item.code === code);
    if (region) return { country: null, region };
  }
  return { country: null, region: null };
}
