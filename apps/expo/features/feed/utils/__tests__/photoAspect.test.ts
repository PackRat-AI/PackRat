import { describe, expect, it } from 'vitest';
import {
  clampedPhotoAspect,
  LANDSCAPE_LIMIT,
  PLACEHOLDER_ASPECT,
  PORTRAIT_LIMIT,
} from '../photoAspect';

describe('clampedPhotoAspect', () => {
  it('keeps a ratio inside the limits', () => {
    expect(clampedPhotoAspect({ width: 1600, height: 1200 })).toBeCloseTo(4 / 3);
  });

  it('clamps tall and wide photos', () => {
    expect(clampedPhotoAspect({ width: 1000, height: 3000 })).toBe(PORTRAIT_LIMIT);
    expect(clampedPhotoAspect({ width: 4000, height: 1000 })).toBe(LANDSCAPE_LIMIT);
  });

  it('uses the placeholder for missing sizes', () => {
    expect(clampedPhotoAspect({ width: 0, height: 100 })).toBe(PLACEHOLDER_ASPECT);
    expect(clampedPhotoAspect({ width: 100, height: Number.NaN })).toBe(PLACEHOLDER_ASPECT);
  });
});
