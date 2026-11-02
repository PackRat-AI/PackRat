import { GpxParseError } from 'expo-app/features/trip-stats/utils/trackGeometry';
import { describe, expect, it } from 'vitest';
import { plannedRouteFromGpx, plannedRouteLength, thinRoute } from '../plannedRoute';

const gpx = (points: string) =>
  `<?xml version="1.0"?><gpx version="1.1"><trk><trkseg>${points}</trkseg></trk></gpx>`;

describe('plannedRouteFromGpx', () => {
  it('reads the track as latitude and longitude only', () => {
    const route = plannedRouteFromGpx(
      gpx('<trkpt lat="47.5" lon="-120.8"><ele>1700</ele></trkpt><trkpt lat="47.6" lon="-120.7"/>'),
    );
    expect(route).toEqual([
      { latitude: 47.5, longitude: -120.8 },
      { latitude: 47.6, longitude: -120.7 },
    ]);
  });

  it('refuses a file with a single point', () => {
    expect(() => plannedRouteFromGpx(gpx('<trkpt lat="47.5" lon="-120.8"/>'))).toThrow(
      GpxParseError,
    );
  });
});

describe('thinRoute', () => {
  it('keeps evenly spaced points including both ends', () => {
    const points = Array.from({ length: 11 }, (_, i) => i);
    expect(thinRoute(points, 3)).toEqual([0, 5, 10]);
  });

  it('leaves a short route as it is', () => {
    expect(thinRoute([1, 2, 3], 5)).toEqual([1, 2, 3]);
    expect(thinRoute([1, 2, 3], 1)).toEqual([1, 2, 3]);
  });
});

describe('plannedRouteLength', () => {
  it('measures the route in metres', () => {
    const metres = plannedRouteLength([
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
    ]);
    expect(metres).toBeGreaterThan(111_000);
    expect(metres).toBeLessThan(111_400);
  });
});
