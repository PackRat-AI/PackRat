import { decodePolyline } from 'expo-app/features/trip-stats/utils/polyline';
import { describe, expect, it } from 'vitest';
import {
  appendSamples,
  applyTrackToLog,
  lastSample,
  newTrack,
  pauseTrack,
  resumeTrack,
  type TrackSample,
  trackLogRoute,
  trackSamples,
} from '../recordedTrack';

/** About 11 m north per step, every 10 s: a steady walk. */
function walk({
  from = 0,
  count,
  altitude = () => null,
  start = 0,
}: {
  from?: number;
  count: number;
  altitude?: (i: number) => number | null;
  start?: number;
}): TrackSample[] {
  return Array.from({ length: count }, (_, i) => ({
    latitude: 47 + (from + i) * 0.0001,
    longitude: -120,
    altitude: altitude(i),
    time: start + i * 10_000,
  }));
}

const fresh = () => newTrack({ tripId: 't1', tripName: 'Enchantments', now: 0 });

describe('appendSamples', () => {
  it('adds distance and moving time for a steady walk', () => {
    const track = appendSamples({ track: fresh(), samples: walk({ count: 11 }) });
    expect(track.distanceMeters).toBeCloseTo(111.2, 0);
    expect(track.movingSeconds).toBe(100);
    expect(trackSamples(track)).toHaveLength(11);
  });

  it('counts no moving time while standing still or across a long gap', () => {
    const still = appendSamples({
      track: fresh(),
      samples: [
        { latitude: 47, longitude: -120, altitude: null, time: 0 },
        { latitude: 47, longitude: -120, altitude: null, time: 10_000 },
        { latitude: 47.001, longitude: -120, altitude: null, time: 400_000 },
      ],
    });
    expect(still.movingSeconds).toBe(0);
    expect(still.distanceMeters).toBeGreaterThan(100);
  });

  it('drops a fix older than the last one', () => {
    const track = appendSamples({ track: fresh(), samples: walk({ count: 2, start: 20_000 }) });
    const after = appendSamples({ track, samples: walk({ count: 1, from: 5, start: 0 }) });
    expect(trackSamples(after)).toHaveLength(2);
  });

  it('counts a climb only once the average of five fixes rises 10 m above its low point', () => {
    const heights = [100, 100, 100, 100, 100, 105, 110, 115, 120, 120, 120];
    const track = appendSamples({
      track: fresh(),
      samples: walk({ count: heights.length, altitude: (i) => heights[i] ?? null }),
    });
    // Averages run 100, 101, 103, 106, 110 (counted: +10), 114, 117 (under 10 more).
    expect(track.elevationGainMeters).toBe(10);
  });

  it('counts no climbing from GPS height noise while standing still', () => {
    // Heights recorded outdoors on flat ground: 21 minutes inside a 15 m square.
    const heights = [382.0, 395.5, 402.6, 393.9, 394.1, 398.6, 395.5, 398.1, 397.4, 393.6, 392.2];
    const track = appendSamples({
      track: fresh(),
      samples: walk({ count: heights.length, altitude: (i) => heights[i] ?? null }),
    });
    expect(track.elevationGainMeters).toBe(0);
  });

  it('ignores fixes while paused', () => {
    const paused = pauseTrack(appendSamples({ track: fresh(), samples: walk({ count: 2 }) }));
    expect(appendSamples({ track: paused, samples: walk({ from: 2, count: 3 }) })).toBe(paused);
  });
});

describe('pause and resume', () => {
  it('never counts the distance between pause and resume', () => {
    let track = appendSamples({ track: fresh(), samples: walk({ count: 2 }) });
    track = resumeTrack(pauseTrack(track));
    track = appendSamples({ track, samples: walk({ from: 1_000, count: 2, start: 60_000 }) });
    expect(track.stretches).toHaveLength(2);
    expect(track.distanceMeters).toBeCloseTo(22.2, 0);
    expect(lastSample(track)?.time).toBe(70_000);
  });

  it('starts no empty stretch when resumed before any fix', () => {
    expect(resumeTrack(pauseTrack(fresh())).stretches).toHaveLength(1);
  });

  it('leaves a running track alone on resume and a paused one on pause', () => {
    const running = fresh();
    const paused = pauseTrack(running);
    expect(resumeTrack(running)).toBe(running);
    expect(pauseTrack(paused)).toBe(paused);
  });
});

describe('trip log', () => {
  it('has no route with fewer than two points', () => {
    const one = appendSamples({ track: fresh(), samples: walk({ count: 1 }) });
    expect(trackLogRoute(one)).toBeNull();
    expect(applyTrackToLog({ track: one, log: null })).toEqual({ activities: [] });
  });

  it('writes distance, climbing and route, and keeps what the user entered', () => {
    const track = appendSamples({ track: fresh(), samples: walk({ count: 5 }) });
    const log = applyTrackToLog({
      track,
      log: { activities: ['hiking'], distanceMeters: 9_000, source: 'manual' },
    });
    expect(log.activities).toEqual(['hiking']);
    expect(log.source).toBe('track');
    expect(log.distanceMeters).toBeCloseTo(track.distanceMeters);
    const line = decodePolyline(log.route ?? '');
    expect(line[0]).toEqual({ latitude: 47, longitude: -120 });
    expect(line[line.length - 1]?.latitude).toBeCloseTo(47.0004, 5);
  });
});
