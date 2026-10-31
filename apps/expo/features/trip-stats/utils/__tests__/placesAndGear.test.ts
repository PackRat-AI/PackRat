import { describe, expect, it } from 'vitest';
import {
  computeIdleGear,
  type IdleGearPack,
  type IdleGearPackItem,
  idleTotalGrams,
} from '../idleGear';
import {
  atlasFromFile,
  boundaryContains,
  distanceToBoundaryKm,
  flagEmoji,
  locatePoint,
  makeAtlas,
  placeBoundary,
  placesVisitedBy,
  regionNoun,
} from '../places';
import { type Coordinate, encodePolyline } from '../polyline';
import {
  computeTripPlaces,
  findPlace,
  mostVisitedPlace,
  newPlaces,
  type PlacesCache,
  regionCount,
  regionLabel,
} from '../tripPlaces';
import { finishedTrips, type StatsTrip } from '../tripStats';

const NOW = new Date(2026, 5, 15, 10);

function square({ lat, lng, size }: { lat: number; lng: number; size: number }): Coordinate[] {
  return [
    { latitude: lat, longitude: lng },
    { latitude: lat, longitude: lng + size },
    { latitude: lat + size, longitude: lng + size },
    { latitude: lat + size, longitude: lng },
    { latitude: lat, longitude: lng },
  ];
}

// "US" is the union of two states; "MX" carries its own outline; "FR" has a hole.
const ATLAS = atlasFromFile({
  countries: [
    { code: 'US', name: 'United States', rings: [] },
    { code: 'MX', name: 'Mexico', rings: [encodePolyline(square({ lat: 0, lng: 0, size: 2 }))] },
    {
      code: 'FR',
      name: 'France',
      rings: [
        encodePolyline(square({ lat: 20, lng: 20, size: 2 })),
        encodePolyline(square({ lat: 20.5, lng: 20.5, size: 1 })),
      ],
    },
    { code: 'CA', name: 'Canada', rings: [] },
  ],
  regions: [
    {
      code: 'US-AA',
      name: 'Alpha',
      country: 'US',
      rings: [encodePolyline(square({ lat: 10, lng: 0, size: 1 }))],
    },
    {
      code: 'US-BB',
      name: 'Beta',
      country: 'US',
      rings: [encodePolyline(square({ lat: 10, lng: 1, size: 1 }))],
    },
    {
      code: 'CA-CC',
      name: 'Gamma',
      country: 'CA',
      rings: [encodePolyline(square({ lat: 30, lng: 0, size: 1 }))],
    },
  ],
});

describe('places', () => {
  it('contains points with the even-odd rule and a box check', () => {
    const france = ATLAS.countriesByCode.get('FR');
    if (!france) throw new Error('missing France');
    expect(boundaryContains({ boundary: france, point: { latitude: 20.2, longitude: 20.2 } })).toBe(
      true,
    );
    expect(boundaryContains({ boundary: france, point: { latitude: 21, longitude: 21 } })).toBe(
      false,
    );
    expect(boundaryContains({ boundary: france, point: { latitude: 50, longitude: 21 } })).toBe(
      false,
    );
    expect(
      distanceToBoundaryKm({ boundary: france, point: { latitude: 19.99, longitude: 21 } }),
    ).toBeCloseTo(1.11, 1);
    expect(
      distanceToBoundaryKm({
        boundary: placeBoundary({ code: 'X', name: 'X', rings: [] }),
        point: { latitude: 0, longitude: 0 },
      }),
    ).toBe(Number.POSITIVE_INFINITY);
  });

  it('locates regions first, then countries, then the nearest coast', () => {
    expect(locatePoint({ atlas: ATLAS, point: { latitude: 10.5, longitude: 1.5 } })).toEqual({
      country: 'US',
      region: 'US-BB',
    });
    expect(locatePoint({ atlas: ATLAS, point: { latitude: 1, longitude: 1 } })).toEqual({
      country: 'MX',
      region: null,
    });
    // 2 km off Mexico's north edge, then far out at sea.
    expect(locatePoint({ atlas: ATLAS, point: { latitude: 2.018, longitude: 1 } })).toEqual({
      country: 'MX',
      region: null,
    });
    expect(locatePoint({ atlas: ATLAS, point: { latitude: 2.1, longitude: 1 } })).toBeNull();
    expect(locatePoint({ atlas: ATLAS, point: { latitude: 2.018, longitude: 0.5 } })).toEqual({
      country: 'MX',
      region: null,
    });
    // 2 km off a region's edge counts in the region.
    expect(locatePoint({ atlas: ATLAS, point: { latitude: 9.982, longitude: 0.5 } })).toEqual({
      country: 'US',
      region: 'US-AA',
    });
  });

  it('keeps a hint that still holds and drops one that does not', () => {
    const hint = { country: 'US', region: 'US-AA' };
    expect(locatePoint({ atlas: ATLAS, point: { latitude: 10.5, longitude: 0.5 }, hint })).toBe(
      hint,
    );
    expect(locatePoint({ atlas: ATLAS, point: { latitude: 10.5, longitude: 1.5 }, hint })).toEqual({
      country: 'US',
      region: 'US-BB',
    });
    const countryHint = { country: 'MX', region: null };
    expect(
      locatePoint({ atlas: ATLAS, point: { latitude: 1, longitude: 1 }, hint: countryHint }),
    ).toBe(countryHint);
  });

  it('collects every place a location and route touch, once each', () => {
    const route = encodePolyline([
      { latitude: 10.5, longitude: 0.5 },
      { latitude: 10.5, longitude: 0.6 },
      { latitude: 10.5, longitude: 1.5 },
      { latitude: 50, longitude: 50 },
    ]);
    const hits = placesVisitedBy({
      atlas: ATLAS,
      trip: {
        location: { latitude: 1, longitude: 1 },
        log: { activities: [], route },
      },
    });
    expect(hits).toEqual([
      { country: 'MX', region: null },
      { country: 'US', region: 'US-AA' },
      { country: 'US', region: 'US-BB' },
    ]);
    expect(placesVisitedBy({ atlas: ATLAS, trip: {} })).toEqual([]);
  });

  it('makes flags and names regions', () => {
    expect(flagEmoji('us')).toBe('🇺🇸');
    expect(flagEmoji('XKX')).toBeNull();
    expect(regionNoun('US')).toBe('states');
    expect(regionNoun('CA')).toBe('provinces');
    expect(regionNoun('AU')).toBe('statesAndTerritories');
    const empty = makeAtlas({ countries: [], regions: [] });
    expect(empty.countriesByCode.size).toBe(0);
  });
});

function trip(overrides: Partial<StatsTrip> & Pick<StatsTrip, 'id' | 'startDate'>): StatsTrip {
  return { name: overrides.id, ...overrides };
}

const at = (latitude: number, longitude: number) => ({ latitude, longitude });

const placeTrips: StatsTrip[] = [
  trip({ id: 'old-mexico', startDate: '2019-02-01', location: at(1, 1) }),
  trip({ id: 'alpha-1', startDate: '2025-03-01', location: at(10.5, 0.5) }),
  trip({ id: 'alpha-2', startDate: '2025-07-01', location: at(10.5, 0.5) }),
  trip({
    id: 'line',
    startDate: '2026-02-01',
    location: at(10.5, 0.5),
    log: { activities: ['hiking'], route: encodePolyline([at(10.5, 0.5), at(10.5, 1.5)]) },
  }),
  trip({ id: 'mexico', startDate: '2026-03-01', location: at(1.5, 1.5) }),
  trip({ id: 'sea', startDate: '2026-04-01', location: at(60, 60) }),
  trip({ id: 'canada', startDate: '2026-05-01', location: at(30.5, 0.5) }),
];

describe('computeTripPlaces', () => {
  const lifetime = finishedTrips({ trips: placeTrips, now: NOW });
  const in2026 = lifetime.filter((item) => item.start.getFullYear() === 2026);

  it('counts trips per country and region, busiest first', () => {
    const places = computeTripPlaces({ finished: lifetime, atlas: ATLAS });
    expect(places.countries.map((c) => [c.code, c.visits.length])).toEqual([
      ['US', 3],
      ['MX', 2],
      ['CA', 1],
    ]);
    const us = places.countries[0];
    expect(us?.name).toBe('United States');
    expect(us?.flag).toBe('🇺🇸');
    expect(us?.regions.map((r) => [r.code, r.visits.length])).toEqual([
      ['US-AA', 3],
      ['US-BB', 1],
    ]);
    expect(us?.visits.map((v) => v.tripId)).toEqual(['line', 'alpha-2', 'alpha-1']);
    expect(regionCount(places)).toBe(3);
    expect(regionLabel(places)).toBe('statesAndProvinces');
    expect(mostVisitedPlace(places)).toEqual({ name: 'Alpha', trips: 3 });
  });

  it('narrows visits to the scope but keeps lifetime first visits', () => {
    const cache: PlacesCache = new Map();
    const places = computeTripPlaces({
      finished: in2026,
      lifetime,
      atlas: ATLAS,
      countryName: (code) => `Name ${code}`,
      cache,
    });
    const mexico = places.countries.find((c) => c.code === 'MX');
    expect(mexico?.name).toBe('Name MX');
    expect(mexico?.visits.map((v) => v.tripId)).toEqual(['mexico']);
    expect(mexico?.firstVisit).toEqual(new Date(2019, 1, 1));
    expect(
      newPlaces({
        places,
        window: { start: new Date(2026, 0, 1), end: new Date(2026, 11, 31) },
      }).map((place) => place.name),
    ).toEqual(['Name CA', 'Beta', 'Gamma']);
    // Cached answers are reused on the next pass.
    expect(cache.size).toBe(lifetime.length);
    const again = computeTripPlaces({ finished: in2026, lifetime, atlas: ATLAS, cache });
    expect(again.countries.length).toBe(places.countries.length);
  });

  it('labels a single country by its noun and finds places by code', () => {
    const onlyUs = computeTripPlaces({
      finished: lifetime.filter((item) => item.trip.id.startsWith('alpha')),
      atlas: ATLAS,
    });
    expect(regionLabel(onlyUs)).toBe('states');
    expect(findPlace({ places: onlyUs, code: 'US' }).country?.code).toBe('US');
    expect(findPlace({ places: onlyUs, code: 'US-AA' }).region?.name).toBe('Alpha');
    expect(findPlace({ places: onlyUs, code: 'ZZ' })).toEqual({ country: null, region: null });
    expect(mostVisitedPlace(onlyUs)).toEqual({ name: 'Alpha', trips: 2 });
  });

  it('falls back to the busiest country, and to nothing for single visits', () => {
    const mexicoOnly = computeTripPlaces({
      finished: lifetime.filter((item) => item.trip.id.includes('mexico')),
      atlas: ATLAS,
    });
    expect(mostVisitedPlace(mexicoOnly)).toEqual({ name: 'Mexico', trips: 2 });
    const once = computeTripPlaces({
      finished: lifetime.filter((item) => item.trip.id === 'canada'),
      atlas: ATLAS,
    });
    expect(mostVisitedPlace(once)).toBeNull();
    expect(computeTripPlaces({ finished: [], atlas: ATLAS }).countries).toEqual([]);
  });

  it('breaks ties by trip and name, and dates first visits from the scope without a lifetime', () => {
    const sameDay = finishedTrips({
      trips: [
        trip({ id: 'b', startDate: '2026-01-01', location: at(10.5, 0.5) }),
        trip({ id: 'a', startDate: '2026-01-01', location: at(10.5, 1.5) }),
        trip({ id: 'c', startDate: '2026-01-01', location: at(1, 1) }),
      ],
      now: NOW,
    });
    const places = computeTripPlaces({ finished: sameDay, lifetime: [], atlas: ATLAS });
    expect(places.countries.map((c) => c.code)).toEqual(['US', 'MX']);
    expect(places.countries[0]?.visits.map((v) => v.tripId)).toEqual(['b', 'a']);
    expect(places.countries[0]?.regions.map((r) => r.name)).toEqual(['Alpha', 'Beta']);
    expect(places.countries[0]?.firstVisit).toEqual(new Date(2026, 0, 1));
    expect(places.countries[0]?.regions[0]?.firstVisit).toEqual(new Date(2026, 0, 1));
  });
});

function item(overrides: Partial<IdleGearPackItem> & { name: string }): IdleGearPackItem {
  return { weight: 100, weightUnit: 'g', createdAt: '2023-01-01T00:00:00.000Z', ...overrides };
}

describe('computeIdleGear', () => {
  const packs: IdleGearPack[] = [
    {
      id: 'summer',
      name: 'Summer',
      items: [
        item({ name: 'Tent', catalogItemId: 1, weight: 1, weightUnit: 'kg' }),
        item({ name: 'Snacks', consumable: true }),
        item({ name: 'Old Stove', deleted: true }),
      ],
    },
    {
      id: 'winter',
      name: 'Winter',
      items: [
        item({ name: 'Snowshoes', category: 'travel' }),
        item({ name: 'Tent', catalogItemId: 1 }),
        item({ name: 'Packraft' }),
        item({ name: 'Bad Date', createdAt: 'nope' }),
        item({ name: 'Aardvark', createdAt: null }),
      ],
    },
    {
      id: 'second',
      name: 'Second',
      items: [
        item({ name: 'packraft ' }),
        item({ name: 'Kayak' }),
        item({ name: 'New Poles', createdAt: new Date(2026, 4, 1) }),
      ],
    },
    { id: 'gone', name: 'Gone', deleted: true, items: [item({ name: 'Ghost' })] },
  ];

  it('judges nothing without a linked trip', () => {
    const finished = finishedTrips({
      trips: [trip({ id: 'a', startDate: '2026-01-01' })],
      now: NOW,
    });
    const gear = computeIdleGear({ finished, packs, now: NOW });
    expect(gear).toEqual({ items: [], isJudgeable: false, since: new Date(2025, 5, 15) });
  });

  it('lists never-taken gear first, then the longest idle', () => {
    const finished = finishedTrips({
      trips: [
        trip({ id: 'snow', name: 'Snow', startDate: '2024-01-01', packId: 'winter' }),
        trip({ id: 'snow-2', startDate: '2023-01-01', packId: 'winter' }),
        trip({ id: 'camp', startDate: '2026-04-01', endDate: '2026-04-03', packId: 'summer' }),
        trip({ id: 'gone', startDate: '2026-04-01', packId: 'gone' }),
      ],
      now: NOW,
    });
    const gear = computeIdleGear({ finished, packs, now: NOW });
    expect(gear.isJudgeable).toBe(true);
    // The tent went on a recent summer trip; new poles haven't had a year.
    expect(gear.items.map((i) => [i.name, i.lastTrip?.id ?? null])).toEqual([
      ['Kayak', null],
      ['Aardvark', 'snow'],
      ['Bad Date', 'snow'],
      ['Packraft', 'snow'],
      ['Snowshoes', 'snow'],
    ]);
    expect(gear.items[0]?.packNames).toEqual(['Second']);
    expect(gear.items.some((i) => i.name === 'New Poles')).toBe(false);
    expect(gear.items.find((i) => i.name === 'Snowshoes')).toMatchObject({
      category: 'travel',
      packId: 'winter',
      grams: 100,
      lastTrip: { id: 'snow', name: 'Snow', date: new Date(2024, 0, 1) },
    });
    expect(gear.items.find((i) => i.name === 'Packraft')?.packNames).toEqual(['Winter', 'Second']);
    expect(idleTotalGrams(gear)).toBe(500);
    // A trip ending inside the window counts, even one that started before it.
    expect(gear.since).toEqual(new Date(2025, 5, 15));
  });

  it('keeps never-taken items with no or bad dates and sorts them by name', () => {
    const finished = finishedTrips({
      trips: [trip({ id: 'camp', startDate: '2026-04-01', packId: 'summer' })],
      now: NOW,
    });
    const gear = computeIdleGear({ finished, packs, now: NOW });
    expect(gear.items.map((i) => i.name)).toEqual([
      'Aardvark',
      'Bad Date',
      'Kayak',
      'Packraft',
      'Snowshoes',
    ]);
    expect(gear.items.every((i) => i.lastTrip === null)).toBe(true);
  });
});
