import type { TripConditions } from 'expo-app/features/trips/utils/tripConditions';
import { describe, expect, it } from 'vitest';
import { appendSamples, newTrack, type RecordedTrack } from '../recordedTrack';
import { compassName, routeProgress } from '../routeProgress';
import {
  checkedIn,
  confirmCheckIn,
  confirmExtend,
  confirmFinish,
  confirmNotify,
  confirmSafe,
  dueBackAnswer,
  extended,
  markedSafe,
  movingTime,
  newReturnTime,
  notified,
  onRouteAnswer,
  remainingAnswer,
  type SpeechClock,
  speakable,
  spokenDistance,
  spokenDuration,
  spokenHeight,
  spokenTime,
  trackingOtherTrip,
  trackingStopped,
  trackSoFar,
  VoiceAnswers,
  waypointMarked,
  weatherAnswer,
  whereAmIAnswer,
} from '../voiceAnswers';

const pacific: SpeechClock = { locale: 'en-US', timeZone: 'America/Los_Angeles' };
const british: SpeechClock = { locale: 'en-GB', timeZone: 'America/Los_Angeles' };

/** 2026-09-14 (a Monday) at the given time in Los Angeles, which is UTC-7 that day. */
function date(hour: number, minute = 0): Date {
  return new Date(Date.UTC(2026, 8, 14, hour + 7, minute));
}

/** The same, `days` later. */
function later(days: number, hour: number): Date {
  return new Date(date(hour).getTime() + days * 86_400_000);
}

// A straight route running north for about 2.2 km.
const route = [
  { latitude: 47.0, longitude: -120.0 },
  { latitude: 47.01, longitude: -120.0 },
  { latitude: 47.02, longitude: -120.0 },
];

describe('routeProgress', () => {
  it('measures along and left to go on the line', () => {
    const progress = routeProgress({ position: { latitude: 47.005, longitude: -120.0 }, route });
    expect(progress?.offRouteMeters).toBeLessThan(1);
    expect(progress?.alongMeters).toBeCloseTo(556, -1);
    expect(progress?.remainingMeters).toBeCloseTo(1_668, -1);
  });

  it('points back west from east of the line', () => {
    const progress = routeProgress({ position: { latitude: 47.01, longitude: -119.996 }, route });
    if (!progress) throw new Error('expected progress');
    expect(progress.offRouteMeters).toBeCloseTo(303, -1);
    expect(compassName(progress.bearingToRoute)).toBe('west');
    expect(onRouteAnswer({ progress, metric: false })).toBe(
      "You're about 1,000 feet east of your route. Head west to rejoin it.",
    );
    expect(remainingAnswer({ progress, metric: true })).toBe(
      "1.1 kilometres to go to the end of your route. You're 300 metres off it.",
    );
  });

  it('needs two points, and copes with a repeated one', () => {
    const [first] = route;
    if (!first) throw new Error('route');
    expect(routeProgress({ position: first, route: [first] })).toBeNull();
    const progress = routeProgress({ position: first, route: [first, first, ...route] });
    expect(progress?.alongMeters).toBe(0);
  });

  it.each<[number, string]>([
    [0, 'north'],
    [44, 'north-east'],
    [90, 'east'],
    [200, 'south'],
    [350, 'north'],
    [-90, 'west'],
  ])('names a %i° bearing %s', (bearing, name) => {
    expect(compassName(bearing)).toBe(name);
  });
});

describe('spoken distances', () => {
  it('says distances the way a hiker would', () => {
    expect(spokenDistance({ meters: 800, metric: false })).toBe('half a mile');
    expect(spokenDistance({ meters: 450, metric: false })).toBe('a quarter of a mile');
    expect(spokenDistance({ meters: 1_300, metric: false })).toBe('three quarters of a mile');
    expect(spokenDistance({ meters: 5_150, metric: false })).toBe('3.2 miles');
    expect(spokenDistance({ meters: 1_609, metric: false })).toBe('1 mile');
    expect(spokenDistance({ meters: 91, metric: false })).toBe('300 feet');
    expect(spokenDistance({ meters: 2, metric: false })).toBe('50 feet');
    expect(spokenDistance({ meters: 800, metric: true })).toBe('800 metres');
    expect(spokenDistance({ meters: 1, metric: true })).toBe('10 metres');
    expect(spokenDistance({ meters: 1_400, metric: true })).toBe('1.4 kilometres');
    expect(spokenDistance({ meters: 2_000, metric: true })).toBe('2 kilometres');
    expect(spokenHeight({ meters: 1_707, metric: false })).toBe('5,600 feet');
    expect(spokenHeight({ meters: 1_707, metric: true })).toBe('1,710 metres');
  });

  it('says durations in the two units that matter', () => {
    expect(spokenDuration(45 * 60_000)).toBe('45 minutes');
    expect(spokenDuration(60_000)).toBe('1 minute');
    expect(spokenDuration(0)).toBe('1 minute');
    expect(spokenDuration(60 * 60_000)).toBe('1 hour');
    expect(spokenDuration(80 * 60_000)).toBe('1 hour 20 minutes');
    expect(spokenDuration(121 * 60_000)).toBe('2 hours 1 minute');
    expect(spokenDuration(6 * 60 * 60_000 + 10 * 60_000)).toBe('6 hours');
  });
});

describe('where am I', () => {
  it('falls back from a place name to the route, then to coordinates', () => {
    expect(
      whereAmIAnswer({
        placeName: 'Colchuck Lake',
        progress: null,
        latitude: 47.5,
        longitude: -120.8,
        altitudeMeters: 1_707,
        metric: false,
      }),
    ).toBe("You're near Colchuck Lake, at 5,600 feet.");
    expect(
      whereAmIAnswer({
        placeName: null,
        progress: routeProgress({ position: { latitude: 47.005, longitude: -120 }, route }),
        latitude: 47.005,
        longitude: -120,
        altitudeMeters: null,
        metric: false,
      }),
    ).toBe("You're a quarter of a mile along your route, with 1 mile to go.");
    expect(
      whereAmIAnswer({
        placeName: null,
        progress: null,
        latitude: -47.5,
        longitude: 120.8,
        altitudeMeters: undefined,
        metric: false,
      }),
    ).toBe("You're at 47.500 degrees south, 120.800 degrees east.");
  });

  it('says when the user is on the route or at its end', () => {
    const onLine = routeProgress({ position: { latitude: 47.005, longitude: -120 }, route });
    const atEnd = routeProgress({ position: { latitude: 47.02, longitude: -120 }, route });
    if (!onLine || !atEnd) throw new Error('expected progress');
    expect(onRouteAnswer({ progress: onLine, metric: false })).toBe("Yes, you're on your route.");
    expect(remainingAnswer({ progress: onLine, metric: false })).toBe(
      '1 mile to go to the end of your route.',
    );
    expect(remainingAnswer({ progress: atEnd, metric: false })).toBe(
      "You're at the end of your route.",
    );
  });
});

describe('times', () => {
  it("follows the phone's 12- or 24-hour clock", () => {
    expect(spokenTime({ date: date(19), now: date(15), clock: pacific })).toBe('at 7 PM');
    expect(spokenTime({ date: date(19, 30), now: date(15), clock: pacific })).toBe('at 7:30 PM');
    expect(spokenTime({ date: date(19), now: date(15), clock: british })).toBe('at 19:00');
    expect(spokenTime({ date: date(19, 30), now: date(15), clock: british })).toBe('at 19:30');
    expect(spokenTime({ date: later(1, 9), now: date(15), clock: pacific })).toBe(
      'tomorrow at 9 AM',
    );
    expect(spokenTime({ date: later(3, 9), now: date(15), clock: pacific })).toBe(
      'Thursday at 9 AM',
    );
  });

  it('reads 24-hour times aloud the way people say them', () => {
    expect(speakable("Tell Imran you're due back Sunday at 19:00?")).toBe(
      "Tell Imran you're due back Sunday at 7 PM?",
    );
    expect(speakable('Back at 07:30 or 00:15.')).toBe('Back at 7:30 AM or 12:15 AM.');
    expect(speakable('Due back at 7:30 PM.')).toBe('Due back at 7:30 PM.');
  });

  it('counts down to the return, then to the alert', () => {
    expect(
      dueBackAnswer({ expectedReturn: date(19), graceMinutes: 120, now: date(15), clock: pacific }),
    ).toBe("You're due back at 7 PM. That's 4 hours from now.");
    expect(
      dueBackAnswer({
        expectedReturn: date(19),
        graceMinutes: 120,
        now: date(19, 30),
        clock: pacific,
      }),
    ).toBe('You were due back at 7 PM. Your contacts get an overdue alert in 1 hour 30 minutes.');
    expect(
      dueBackAnswer({ expectedReturn: date(19), graceMinutes: 120, now: date(22), clock: pacific }),
    ).toBe('You were due back at 7 PM. Your contacts have been sent an overdue alert.');
  });

  it('reads a spoken time already past today as tomorrow', () => {
    const now = new Date(2026, 8, 14, 21, 0);
    const current = new Date(2026, 8, 14, 19, 0);
    expect(newReturnTime({ command: { kind: 'extendBy', minutes: 60 }, current, now })).toEqual(
      new Date(2026, 8, 14, 22, 0),
    );
    expect(
      newReturnTime({
        command: { kind: 'extendBy', minutes: 60 },
        current: new Date(2026, 8, 14, 23, 0),
        now,
      }),
    ).toEqual(new Date(2026, 8, 15, 0, 0));
    expect(
      newReturnTime({ command: { kind: 'extendUntil', hour: 22, minute: 30 }, current, now }),
    ).toEqual(new Date(2026, 8, 14, 22, 30));
    expect(
      newReturnTime({ command: { kind: 'extendUntil', hour: 8, minute: 0 }, current, now }),
    ).toEqual(new Date(2026, 8, 15, 8, 0));
  });
});

describe('read-backs and results', () => {
  it('names the contacts and the place', () => {
    expect(confirmCheckIn({ contacts: 'Sam and Jo', placeName: 'Colchuck Lake' })).toBe(
      'Checking in with Sam and Jo near Colchuck Lake. Send it?',
    );
    expect(confirmCheckIn({ contacts: 'Sam', placeName: null })).toBe(
      'Checking in with Sam. Send it?',
    );
    expect(confirmSafe('Enchantments Traverse')).toBe(
      'Mark yourself safe and end Enchantments Traverse?',
    );
    expect(confirmFinish('Mailbox Peak')).toBe('End Mailbox Peak?');
    expect(confirmExtend({ to: date(20), contacts: 'Mom', now: date(15), clock: pacific })).toBe(
      'Change your return to 8 PM and tell Mom?',
    );
    expect(
      confirmNotify({ contact: 'Mom', expectedReturn: date(19), now: date(15), clock: pacific }),
    ).toBe("Trip started. Tell Mom you're due back at 7 PM?");
  });

  it('says when something is waiting for signal', () => {
    expect(checkedIn(true)).toBe('Checked in.');
    expect(checkedIn(false)).toBe(VoiceAnswers.queued);
    expect(markedSafe(true)).toBe("Welcome back. Your contacts have been told you're safe.");
    expect(markedSafe(false)).toBe(
      "You're marked safe. Your contacts will be told when you have signal.",
    );
    expect(extended({ to: date(20), online: true, now: date(15), clock: pacific })).toBe(
      'Your return is now at 8 PM.',
    );
    expect(extended({ to: date(20), online: false, now: date(15), clock: pacific })).toBe(
      `Your return is now at 8 PM. ${VoiceAnswers.queued}`,
    );
    expect(notified({ contact: 'mom', online: true })).toBe('Mom has your plan.');
    expect(notified({ contact: 'mom', online: false })).toBe(VoiceAnswers.queued);
  });
});

describe('weather', () => {
  const base: TripConditions = {
    tripId: 't',
    sourceKey: 'k',
    fetchedAt: date(14).getTime(),
    coveredDays: 1,
    tripDays: 1,
    lowF: 41.4,
    highF: 63.6,
    lowC: 5.2,
    highC: 17.6,
    maxChanceOfRain: 40,
    maxChanceOfSnow: 0,
    conditionText: 'partly cloudy',
    alerts: [],
    attribution: null,
  };

  it('reads the forecast in the user units, with rain or snow and any alert', () => {
    expect(weatherAnswer({ conditions: base, metric: false, now: date(15) })).toBe(
      'Partly cloudy. Between 41 and 64 degrees. 40 percent chance of rain.',
    );
    expect(
      weatherAnswer({
        conditions: {
          ...base,
          conditionText: null,
          maxChanceOfSnow: 60,
          alerts: [{ id: 'a', event: 'Winter Storm Warning', severity: 'severe' }],
        },
        metric: true,
        now: date(15),
      }),
    ).toBe('Between 5 and 18 degrees. 60 percent chance of snow. Alert: Winter Storm Warning.');
    expect(
      weatherAnswer({ conditions: { ...base, maxChanceOfRain: 0 }, metric: false, now: date(19) }),
    ).toBe('Partly cloudy. Between 41 and 64 degrees. This forecast is from 5 hours ago.');
  });
});

describe('tracking answers', () => {
  const walked = (overrides: Partial<RecordedTrack>): RecordedTrack =>
    appendSamples({
      track: { ...newTrack({ tripId: 't', tripName: 'Mailbox Peak', now: 0 }), ...overrides },
      samples: [
        { latitude: 47, longitude: -120, altitude: null, time: 0 },
        { latitude: 47.001, longitude: -120, altitude: null, time: 60_000 },
      ],
    });

  it('reads totals on stop, leaving out climbing and time that round to nothing', () => {
    const track = {
      ...walked({}),
      distanceMeters: 13_518,
      elevationGainMeters: 884,
      movingSeconds: 15_000,
    };
    expect(trackingStopped({ track, metric: false })).toBe(
      'Stopped. 8.4 miles, 2,900 feet of climbing, 4 hours 10 moving. Saved to your trip log.',
    );
    const short = {
      ...walked({}),
      distanceMeters: 1_400,
      elevationGainMeters: 4,
      movingSeconds: 30,
    };
    expect(trackingStopped({ track: short, metric: true })).toBe(
      'Stopped. 1.4 kilometres. Saved to your trip log.',
    );
  });

  it('says nothing was saved when too little was recorded', () => {
    const empty = newTrack({ tripId: 't', tripName: 'x', now: 0 });
    expect(trackingStopped({ track: empty, metric: false })).toBe(
      'Stopped. Too little was recorded to save a route.',
    );
  });

  it('reads progress so far, and says when paused', () => {
    expect(trackSoFar({ track: newTrack({ tripId: 't', tripName: 'x' }), metric: false })).toBe(
      "You've only just started.",
    );
    const track = { ...walked({}), distanceMeters: 5_150, movingSeconds: 4_800, isPaused: true };
    expect(trackSoFar({ track, metric: false })).toBe(
      "You've gone 3.2 miles, 1 hour 20 moving. Tracking is paused.",
    );
  });

  it('reads moving time the way a watch does', () => {
    expect(movingTime(45 * 60)).toBe('45 minutes');
    expect(movingTime(60)).toBe('1 minute');
    expect(movingTime(3_600)).toBe('1 hour');
    expect(movingTime(15_000)).toBe('4 hours 10');
  });

  it('names the trip being tracked and the waypoint marked', () => {
    expect(trackingOtherTrip('Mailbox Peak')).toBe(
      "You're tracking Mailbox Peak. Stop that first.",
    );
    expect(waypointMarked('Water source')).toBe('Marked Water source.');
  });
});
