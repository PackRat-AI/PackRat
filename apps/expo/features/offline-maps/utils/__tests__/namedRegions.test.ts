import type { PlaceBoundary } from 'expo-app/features/trip-stats/utils/places';
import { describe, expect, it } from 'vitest';
import {
  boundaryFeatureCollection,
  buildNamedRegions,
  isSaveable,
  matchRegions,
} from '../namedRegions';

const square = ({ lon, lat, size }: { lon: number; lat: number; size: number }) => [
  { longitude: lon, latitude: lat },
  { longitude: lon + size, latitude: lat },
  { longitude: lon + size, latitude: lat + size },
  { longitude: lon, latitude: lat + size },
  { longitude: lon, latitude: lat },
];

const boundary = (overrides: Partial<PlaceBoundary>): PlaceBoundary => ({
  code: 'X',
  name: 'X',
  countryCode: null,
  rings: [square({ lon: 0, lat: 0, size: 1 })],
  minLatitude: 0,
  maxLatitude: 1,
  minLongitude: 0,
  maxLongitude: 1,
  ...overrides,
});

const regions = buildNamedRegions({
  parks: [
    {
      code: 'YOSE',
      name: 'Yosemite',
      states: ['CA'],
      rings: [square({ lon: -119.8, lat: 37.5, size: 0.5 })],
    },
  ],
  forests: [
    {
      code: '05',
      name: 'Inyo National Forest',
      states: ['CA', 'NV'],
      rings: [[-118.5, 37, -117.5, 37, -117.5, 38, -118.5, 38, -118.5, 37]],
    },
  ],
  atlas: {
    countries: [
      boundary({
        code: 'AD',
        name: 'Andorra',
        rings: [square({ lon: 1.4, lat: 42.4, size: 0.3 })],
      }),
      // The union of its regions: no outline of its own.
      boundary({ code: 'US', name: 'United States', rings: [] }),
    ],
    regions: [
      boundary({
        code: 'US-VT',
        name: 'Vermont',
        countryCode: 'US',
        rings: [square({ lon: -73, lat: 43, size: 2 })],
      }),
    ],
  },
  countryName: (code) => (code === 'US' ? 'United States' : code),
});

describe('buildNamedRegions', () => {
  it('lists every kind sorted by name, skipping countries without an outline', () => {
    expect(regions.map((region) => [region.id, region.name, region.subtitle, region.kind])).toEqual(
      [
        ['country-AD', 'Andorra', '', 'country'],
        ['forest-05', 'Inyo National Forest', 'CA, NV', 'forest'],
        ['region-US-VT', 'Vermont', 'United States', 'region'],
        ['park-YOSE', 'Yosemite National Park', 'CA', 'park'],
      ],
    );
  });

  it('turns outlines into longitude, latitude pairs', () => {
    expect(regions[0]?.rings[0]?.[1]).toEqual([1.7, 42.4]);
  });
});

describe('isSaveable', () => {
  it('keeps a park-sized outline', () => {
    expect(
      isSaveable({
        rings: [
          [
            [-119.8, 37.5],
            [-119.3, 37.5],
            [-119.3, 38],
            [-119.8, 37.5],
          ],
        ],
      }),
    ).toBe(true);
  });

  it('leaves out an outline too big to save at Standard detail', () => {
    const texas: [number, number][] = [
      [-106.6, 25.8],
      [-93.5, 25.8],
      [-93.5, 36.5],
      [-106.6, 36.5],
      [-106.6, 25.8],
    ];
    expect(isSaveable({ rings: [texas] })).toBe(false);
  });
});

describe('matchRegions', () => {
  it('returns everything for a blank query', () => {
    expect(matchRegions({ regions, query: '  ' })).toBe(regions);
  });

  it('matches names and subtitles, ignoring case and accents', () => {
    expect(matchRegions({ regions, query: 'yosémite' }).map((region) => region.id)).toEqual([
      'park-YOSE',
    ]);
    expect(matchRegions({ regions, query: 'nv' }).map((region) => region.id)).toEqual([
      'forest-05',
    ]);
    expect(matchRegions({ regions, query: 'united' }).map((region) => region.id)).toEqual([
      'region-US-VT',
    ]);
  });
});

describe('boundaryFeatureCollection', () => {
  it('wraps every ring in one multipolygon feature', () => {
    const ring: [number, number][] = [
      [0, 0],
      [1, 0],
      [0, 1],
      [0, 0],
    ];
    const collection = boundaryFeatureCollection([ring, ring]);
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0]?.geometry).toEqual({
      type: 'MultiPolygon',
      coordinates: [[ring], [ring]],
    });
  });
});
