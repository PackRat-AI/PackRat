import { describe, expect, it } from 'vitest';
import { drawnDistance, outAndBack, totalTrailLength, trailDistances } from '../routeDrawing';

const a = { latitude: 0, longitude: 0 };
const b = { latitude: 0, longitude: 0.01 };
const c = { latitude: 0.01, longitude: 0.01 };

describe('route drawing', () => {
  it('measures the drawn line point to point', () => {
    expect(drawnDistance([])).toBe(0);
    expect(drawnDistance([a])).toBe(0);
    // 0.01° of longitude on the equator is about 1.11 km.
    expect(drawnDistance([a, b])).toBeCloseTo(1_113, -1);
    expect(drawnDistance([a, b, c])).toBeCloseTo(2 * drawnDistance([a, b]), -1);
  });

  it('walks the line out and back the same way', () => {
    expect(outAndBack([a])).toEqual([a]);
    expect(outAndBack([a, b, c])).toEqual([a, b, c, b, a]);
    expect(drawnDistance(outAndBack([a, b, c]))).toBeCloseTo(2 * drawnDistance([a, b, c]), 6);
  });
});

describe('trail distances', () => {
  it('adds up the trails that have a length', () => {
    expect(totalTrailLength([])).toBe(0);
    expect(totalTrailLength([{ lengthMeters: 1_000 }, { lengthMeters: null }, {}])).toBe(1_000);
    expect(totalTrailLength([{ lengthMeters: 1_000 }, { lengthMeters: 2_500 }])).toBe(3_500);
  });

  it('offers one way and there and back', () => {
    expect(trailDistances(4_000)).toEqual([
      { kind: 'oneWay', metres: 4_000 },
      { kind: 'thereAndBack', metres: 8_000 },
    ]);
  });
});
