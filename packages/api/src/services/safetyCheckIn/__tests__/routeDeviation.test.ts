import { describe, expect, it } from 'vitest';
import {
  detectOffRoute,
  distanceToRouteMeters,
  OFF_ROUTE_THRESHOLD_METERS,
} from '../routeDeviation';

// A north-south route along longitude -120.8, ~1.1 km long.
const route = [
  { latitude: 47.5, longitude: -120.8 },
  { latitude: 47.51, longitude: -120.8 },
];

// 0.01° of longitude at 47.5°N ≈ 751 m.
const METERS_PER_0_01_LON = 751;

describe('distanceToRouteMeters', () => {
  it('is infinite for an empty route', () => {
    expect(distanceToRouteMeters({ latitude: 0, longitude: 0 }, [])).toBe(Number.POSITIVE_INFINITY);
  });

  it('measures to a single vertex', () => {
    const d = distanceToRouteMeters({ latitude: 47.501, longitude: -120.8 }, [
      { latitude: 47.5, longitude: -120.8 },
    ]);
    expect(d).toBeCloseTo(111, 0);
  });

  it('is ~0 on the route and perpendicular distance beside it', () => {
    expect(distanceToRouteMeters({ latitude: 47.505, longitude: -120.8 }, route)).toBeLessThan(1);
    const beside = distanceToRouteMeters({ latitude: 47.505, longitude: -120.79 }, route);
    expect(Math.abs(beside - METERS_PER_0_01_LON)).toBeLessThan(5);
  });

  it('clamps to the nearest endpoint past the end of a segment', () => {
    const d = distanceToRouteMeters({ latitude: 47.52, longitude: -120.8 }, route);
    expect(d).toBeCloseTo(1112, -1);
  });

  it('handles repeated (zero-length) vertices', () => {
    const d = distanceToRouteMeters({ latitude: 47.501, longitude: -120.8 }, [
      { latitude: 47.5, longitude: -120.8 },
      { latitude: 47.5, longitude: -120.8 },
    ]);
    expect(d).toBeCloseTo(111, 0);
  });
});

describe('detectOffRoute', () => {
  const far = { latitude: 47.505, longitude: -120.77 }; // ~2.25 km east
  const near = { latitude: 47.505, longitude: -120.801 };

  it('needs a real route', () => {
    expect(detectOffRoute([far, far], route.slice(0, 1))).toBeNull();
  });

  it('needs enough positions', () => {
    expect(detectOffRoute([far], route)).toBeNull();
  });

  it('ignores a single stray fix', () => {
    expect(detectOffRoute([far, near], route)).toBeNull();
  });

  it('reports the latest distance once consecutive fixes are off route', () => {
    const d = detectOffRoute([near, far, far], route);
    expect(d).toBeGreaterThan(OFF_ROUTE_THRESHOLD_METERS);
    expect(Math.abs((d ?? 0) - 3 * METERS_PER_0_01_LON)).toBeLessThan(15);
  });
});
