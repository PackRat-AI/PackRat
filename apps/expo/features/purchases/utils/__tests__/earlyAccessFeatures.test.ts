import { describe, expect, it } from 'vitest';
import { MAX_FEATURE_SLOTS, otherEarlyAccessFeatureNames } from '../earlyAccessFeatures';

const NOW = new Date('2026-09-10T00:00:00.000Z');
const FUTURE = '2026-12-01T00:00:00.000Z';
const PAST = '2026-01-01T00:00:00.000Z';

interface TestFeature {
  key: string;
  earlyAccessUntil: string | null;
  label?: string | null;
}

const feature = ({ key, earlyAccessUntil, label }: TestFeature): TestFeature => ({
  key,
  earlyAccessUntil,
  label,
});

describe('otherEarlyAccessFeatureNames', () => {
  it('excludes the feature the paywall was opened for', () => {
    const features = [
      feature({ key: 'summit-log', earlyAccessUntil: FUTURE, label: 'Summit Log' }),
      feature({ key: 'wildlife-id', earlyAccessUntil: FUTURE, label: 'Wildlife ID' }),
    ];
    expect(
      otherEarlyAccessFeatureNames(features, { excludingKey: 'summit-log', now: NOW }),
    ).toEqual(['Wildlife ID']);
  });

  it('lists everything when no one feature prompted the paywall', () => {
    const features = [
      feature({ key: 'summit-log', earlyAccessUntil: FUTURE, label: 'Summit Log' }),
      feature({ key: 'wildlife-id', earlyAccessUntil: FUTURE, label: 'Wildlife ID' }),
    ];
    expect(otherEarlyAccessFeatureNames(features, { now: NOW })).toEqual([
      'Summit Log',
      'Wildlife ID',
    ]);
  });

  it('omits graduated features — they are free, so they sell nothing', () => {
    const features = [
      feature({ key: 'summit-log', earlyAccessUntil: PAST, label: 'Summit Log' }),
      feature({ key: 'wildlife-id', earlyAccessUntil: FUTURE, label: 'Wildlife ID' }),
    ];
    expect(otherEarlyAccessFeatureNames(features, { now: NOW })).toEqual(['Wildlife ID']);
  });

  it('omits features with no window at all', () => {
    const features = [
      feature({ key: 'always-free', earlyAccessUntil: null, label: 'Always Free' }),
      feature({ key: 'gated', earlyAccessUntil: FUTURE, label: 'Gated' }),
    ];
    expect(otherEarlyAccessFeatureNames(features, { now: NOW })).toEqual(['Gated']);
  });

  it('sorts by key so the order does not reshuffle between renders', () => {
    const features = [
      feature({ key: 'zebra', earlyAccessUntil: FUTURE, label: 'Zebra' }),
      feature({ key: 'alpha', earlyAccessUntil: FUTURE, label: 'Alpha' }),
      feature({ key: 'middle', earlyAccessUntil: FUTURE, label: 'Middle' }),
    ];
    expect(otherEarlyAccessFeatureNames(features, { now: NOW })).toEqual([
      'Alpha',
      'Middle',
      'Zebra',
    ]);
  });

  it('caps the list, because the point is breadth rather than a catalogue', () => {
    const features = Array.from({ length: 10 }, (_, i) =>
      feature({ key: `feature-${i}`, earlyAccessUntil: FUTURE, label: `Feature ${i}` }),
    );
    expect(otherEarlyAccessFeatureNames(features, { now: NOW })).toHaveLength(MAX_FEATURE_SLOTS);
  });

  it('honours an explicit limit', () => {
    const features = Array.from({ length: 5 }, (_, i) =>
      feature({ key: `feature-${i}`, earlyAccessUntil: FUTURE, label: `Feature ${i}` }),
    );
    expect(otherEarlyAccessFeatureNames(features, { now: NOW, limit: 2 })).toEqual([
      'Feature 0',
      'Feature 1',
    ]);
  });

  it('falls back to the key rather than dropping an unlabelled feature', () => {
    const features = [
      feature({ key: 'summit-log', earlyAccessUntil: FUTURE, label: null }),
      feature({ key: 'wildlife-id', earlyAccessUntil: FUTURE, label: '  ' }),
    ];
    expect(otherEarlyAccessFeatureNames(features, { now: NOW })).toEqual([
      'summit-log',
      'wildlife-id',
    ]);
  });

  it('returns nothing before the config has loaded', () => {
    expect(
      otherEarlyAccessFeatureNames(undefined, { excludingKey: 'summit-log', now: NOW }),
    ).toEqual([]);
  });
});
