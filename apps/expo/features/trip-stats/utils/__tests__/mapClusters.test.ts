import { describe, expect, it } from 'vitest';
import { clusterPins, isStacked } from '../mapClusters';

const region = { latitude: 40, longitude: -110, latitudeDelta: 8, longitudeDelta: 8 };
const pins = [
  { id: 'a', latitude: 40.1, longitude: -110.1 },
  { id: 'b', latitude: 40.2, longitude: -110.2 },
  { id: 'c', latitude: 43, longitude: -107 },
];

describe('clusterPins', () => {
  it('merges pins in one cell into a count at their middle and keeps lone pins', () => {
    const clusters = clusterPins({ pins, region });
    expect(clusters.map((cluster) => cluster.members)).toEqual([['a', 'b'], ['c']]);
    const [merged, lone] = clusters;
    expect(merged?.id.startsWith('cluster:')).toBe(true);
    expect(merged?.latitude).toBeCloseTo(40.15, 6);
    expect(merged?.longitude).toBeCloseTo(-110.15, 6);
    expect(lone).toMatchObject({ id: 'c', latitude: 43, longitude: -107 });
  });

  it('splits them apart once zoomed in', () => {
    const close = { ...region, latitudeDelta: 0.4, longitudeDelta: 0.4 };
    expect(clusterPins({ pins, region: close }).map((cluster) => cluster.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('leaves every pin alone without a frame', () => {
    expect(clusterPins({ pins, region: null }).map((cluster) => cluster.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});

describe('isStacked', () => {
  it('lists trips when zooming would barely move the map', () => {
    expect(isStacked({ current: region, next: { ...region, latitudeDelta: 7.5 } })).toBe(true);
    expect(isStacked({ current: region, next: { ...region, latitudeDelta: 2 } })).toBe(false);
  });
});
