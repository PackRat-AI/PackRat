import type { TripLog } from '@packrat/schemas/trips';
import { describe, expect, it } from 'vitest';
import { getLandscapeGrid } from '../../lib/landscapes';
import {
  computeTripLandscapes,
  decodeLandscapeGrid,
  gridCode,
  isMountainous,
  landscapeAt,
  tripLandscape,
} from '../landscapes';
import { encodePolyline } from '../polyline';
import { finishedTrips, type StatsTrip } from '../tripStats';

const grid = getLandscapeGrid();
const NOW = new Date(2026, 9, 1);

const at = (latitude: number, longitude: number) =>
  landscapeAt({ grid, point: { latitude, longitude } });

function log(fields: Partial<TripLog> = {}): TripLog {
  return { activities: [], ...fields };
}

function trip({
  id,
  point,
  tripLog,
  startDate = '2026-06-01',
}: {
  id: string;
  point?: [number, number];
  tripLog?: TripLog;
  startDate?: string;
}): StatsTrip {
  return {
    id,
    name: `Trip ${id}`,
    startDate,
    endDate: startDate,
    location: point ? { latitude: point[0], longitude: point[1] } : undefined,
    log: tripLog ?? null,
  };
}

describe('landscape grid', () => {
  it('reads known places', () => {
    expect(at(46.85, -121.76)).toBe('mountain'); // Mount Rainier
    expect(at(33.87, -115.9)).toBe('desert'); // Joshua Tree
    expect(at(36.27, -121.8)).toBe('coastal'); // Big Sur
    expect(at(39.1, -120.03)).toBe('water'); // Lake Tahoe
    expect(at(38.5, -99)).toBe('grassland'); // Kansas, Great Plains
    expect(at(64.8, -18.5)).toBe('polar'); // Iceland's interior
    expect(at(38.57, -109.55)).toBe('desert'); // Moab
  });

  it('reads open sea as nothing and just offshore as coastal', () => {
    expect(at(30, -140)).toBeNull();
    expect(at(47.905, -124.66)).toBe('coastal');
  });

  it('wraps across the date line and is empty off the poles', () => {
    expect(gridCode({ grid, row: 100, column: -1 })).toBe(
      gridCode({ grid, row: 100, column: 7_199 }),
    );
    expect(gridCode({ grid, row: -5, column: 0 })).toBe(0);
  });

  it('reads a truncated file as empty', () => {
    const empty = decodeLandscapeGrid(new Uint8Array([1, 0]));
    expect(empty.rowOffsets.length).toBe(0);
    expect(landscapeAt({ grid: empty, point: { latitude: 46.85, longitude: -121.76 } })).toBeNull();
  });
});

describe('tripLandscape', () => {
  it('turns open country into mountain for summits, steep climbing and ski trips', () => {
    expect(isMountainous(log({ distanceMeters: 10_000, elevationGainMeters: 800 }))).toBe(true);
    expect(isMountainous(log({ distanceMeters: 40_000, elevationGainMeters: 800 }))).toBe(false);
    expect(isMountainous(log({ distanceMeters: 5_000, elevationGainMeters: 300 }))).toBe(false);
    expect(isMountainous(log({ elevationGainMeters: 600 }))).toBe(true);
    expect(isMountainous(log({ activities: ['skiing'] }))).toBe(true);
    const kansas = trip({
      id: 'a',
      point: [38.5, -99],
      tripLog: log({ summits: [{ name: 'Peak', latitude: 38.5, longitude: -99 }] }),
    });
    expect(tripLandscape({ trip: kansas, grid })).toBe('mountain');
  });

  it('reads paddling inland as lakes and rivers but not on the coast', () => {
    const paddling = log({ activities: ['paddling'] });
    expect(
      tripLandscape({ trip: trip({ id: 'a', point: [38.5, -99], tripLog: paddling }), grid }),
    ).toBe('water');
    expect(
      tripLandscape({ trip: trip({ id: 'b', point: [36.27, -121.8], tripLog: paddling }), grid }),
    ).toBe('coastal');
  });

  it("puts the user's choice first, even without a place", () => {
    const chosen = log({ landscape: 'forest' });
    expect(
      tripLandscape({ trip: trip({ id: 'a', point: [33.87, -115.9], tripLog: chosen }), grid }),
    ).toBe('forest');
    expect(tripLandscape({ trip: trip({ id: 'b', tripLog: chosen }), grid })).toBe('forest');
  });

  it('uses the middle of the route when the trip has no pin', () => {
    const route = encodePolyline([
      { latitude: 33.8, longitude: -116 },
      { latitude: 33.87, longitude: -115.9 },
      { latitude: 33.9, longitude: -115.8 },
    ]);
    expect(tripLandscape({ trip: trip({ id: 'a', tripLog: log({ route }) }), grid })).toBe(
      'desert',
    );
    expect(tripLandscape({ trip: trip({ id: 'b' }), grid })).toBeNull();
  });
});

describe('computeTripLandscapes', () => {
  it('counts most first, then in the listed order, newest trip first', () => {
    const finished = finishedTrips({
      trips: [
        trip({ id: 'a', point: [33.87, -115.9], startDate: '2026-03-01' }),
        trip({ id: 'b', point: [36.5, -117], startDate: '2026-05-01' }),
        trip({ id: 'c', point: [46.85, -121.76] }),
        trip({ id: 'd', point: [36.27, -121.8] }),
        trip({ id: 'e' }),
      ],
      now: NOW,
    });
    const buckets = computeTripLandscapes({ finished, grid });
    expect(buckets.map((bucket) => bucket.landscape)).toEqual(['desert', 'mountain', 'coastal']);
    expect(buckets[0]?.trips.map((item) => item.trip.id)).toEqual(['b', 'a']);
  });
});
