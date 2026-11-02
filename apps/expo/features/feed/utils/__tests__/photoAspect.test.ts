import { describe, expect, it } from 'vitest';
import {
  clampedPhotoAspect,
  LANDSCAPE_LIMIT,
  PLACEHOLDER_ASPECT,
  PORTRAIT_LIMIT,
} from '../photoAspect';

describe('clampedPhotoAspect', () => {
  it('keeps a ratio inside the limits', () => {
    expect(clampedPhotoAspect(1600, 1200)).toBeCloseTo(4 / 3);
  });

  it('clamps tall and wide photos', () => {
    expect(clampedPhotoAspect(1000, 3000)).toBe(PORTRAIT_LIMIT);
    expect(clampedPhotoAspect(4000, 1000)).toBe(LANDSCAPE_LIMIT);
  });

  it('uses the placeholder for missing sizes', () => {
    expect(clampedPhotoAspect(0, 100)).toBe(PLACEHOLDER_ASPECT);
    expect(clampedPhotoAspect(100, Number.NaN)).toBe(PLACEHOLDER_ASPECT);
  });
});
