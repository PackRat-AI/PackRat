import { describe, expect, it } from 'vitest';
import {
  addWaypointToLog,
  clipUtf16,
  namedWaypoint,
  removeWaypointFromLog,
  type TripWaypoint,
  WAYPOINT_LIMITS,
} from '../tripWaypoints';

const at = new Date('2026-11-13T22:14:00Z');
const base = { latitude: 47.5, longitude: -120.8, elevation: 1_200, at, timeLabel: '2:14 PM' };

describe('namedWaypoint', () => {
  it('names an unnamed waypoint by the time', () => {
    const waypoint = namedWaypoint({ ...base, id: 'w1', name: null });
    expect(waypoint).toEqual({
      id: 'w1',
      name: 'Waypoint 2:14 PM',
      note: null,
      latitude: 47.5,
      longitude: -120.8,
      elevationMeters: 1_200,
      createdAt: '2026-11-13T22:14:00.000Z',
    });
  });

  it('treats a blank name as no name and keeps a note', () => {
    const waypoint = namedWaypoint({ ...base, id: 'w2', name: '  ', note: 'Washed out' });
    expect(waypoint.name).toBe('Waypoint 2:14 PM');
    expect(waypoint.note).toBe('Washed out');
  });

  it('clips a long name and note to the server limits', () => {
    const waypoint = namedWaypoint({
      ...base,
      id: 'w3',
      name: 'a'.repeat(300),
      note: 'b'.repeat(3_000),
    });
    expect(waypoint.name).toHaveLength(WAYPOINT_LIMITS.nameLength);
    expect(waypoint.note).toHaveLength(WAYPOINT_LIMITS.noteLength);
  });
});

describe('clipUtf16', () => {
  it('never splits a character made of two UTF-16 units', () => {
    expect(clipUtf16({ text: 'ab🏔️', limit: 3 })).toBe('ab');
    expect(clipUtf16({ text: 'short', limit: 10 })).toBe('short');
  });
});

describe('trip log waypoints', () => {
  const waypoint = (id: string): TripWaypoint => namedWaypoint({ ...base, id, name: id });

  it('adds to a trip with no log yet', () => {
    expect(addWaypointToLog({ log: null, waypoint: waypoint('a') })).toEqual({
      activities: [],
      waypoints: [waypoint('a')],
    });
  });

  it('refuses a waypoint past the limit', () => {
    const full = {
      activities: [],
      waypoints: Array.from({ length: WAYPOINT_LIMITS.perTrip }, (_, i) => waypoint(`w${i}`)),
    };
    expect(addWaypointToLog({ log: full, waypoint: waypoint('extra') })).toBeNull();
  });

  it('removes only the waypoint asked for', () => {
    const log = { activities: ['hiking'], waypoints: [waypoint('a'), waypoint('b')] };
    expect(removeWaypointFromLog({ log, id: 'a' })).toEqual({
      activities: ['hiking'],
      waypoints: [waypoint('b')],
    });
  });
});
