import { describe, expect, it } from 'vitest';
import {
  cancelledMessage,
  checkedInMessage,
  describeGear,
  formatClockTime,
  formatDistance,
  formatDuration,
  formatMessageTime,
  introMessage,
  offRouteMessage,
  overdueMessage,
  returnExtendedMessage,
  safeMessage,
  tripStartedMessage,
} from '../messages';

// 2026-09-14T02:00Z is Sun 13 Sep, 7:00 PM in Los Angeles (PDT, UTC-7).
const RETURN = new Date('2026-09-14T02:00:00.000Z');
const LA = 'America/Los_Angeles';

describe('formatMessageTime / formatClockTime', () => {
  it('formats in the user time zone', () => {
    expect(formatMessageTime(RETURN, LA)).toBe('Sun, Sep 13, 7:00 PM');
    expect(formatClockTime(RETURN, LA)).toBe('7:00 PM');
  });

  it('falls back to UTC for an invalid time zone', () => {
    expect(formatMessageTime(RETURN, 'Not/AZone')).toBe('Mon, Sep 14, 2:00 AM');
    expect(formatClockTime(RETURN, 'Not/AZone')).toBe('2:00 AM');
  });
});

describe('describeGear', () => {
  it('prefixes the note and joins items', () => {
    expect(
      describeGear([
        { name: 'Big Agnes tent', note: 'orange' },
        { name: ' rain jacket ', note: '  ' },
        { name: 'pack', note: null },
      ]),
    ).toBe('orange Big Agnes tent, rain jacket, pack');
  });

  it('returns null when there is nothing to describe', () => {
    expect(describeGear([])).toBeNull();
    expect(describeGear([{ name: '   ' }])).toBeNull();
  });
});

describe('formatDuration', () => {
  it.each([
    [0.2, '1 minute'],
    [1, '1 minute'],
    [45, '45 minutes'],
    [60, '1 hour'],
    [150, '3 hours'],
    [120, '2 hours'],
  ])('%s minutes → %s', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});

describe('formatDistance', () => {
  it('shows miles and kilometres', () => {
    expect(formatDistance(3400)).toBe('about 2.1 mi (3.4 km)');
  });
});

describe('message builders', () => {
  it('introMessage explains the role', () => {
    const m = introMessage({ userName: 'Alex' });
    expect(m.subject).toBe('Alex added you as an emergency contact');
    expect(m.text).toContain("If you weren't expecting this, you can ignore it.");
  });

  it('tripStartedMessage includes return time, gear and link', () => {
    const m = tripStartedMessage({
      userName: 'Alex',
      tripName: 'Enchantments',
      expectedReturnAt: RETURN,
      timeZone: LA,
      gear: [{ name: 'tent', note: 'orange' }],
      link: 'https://x/l',
    });
    expect(m.text).toBe(
      'Alex has started their trip: Enchantments. Expected return: Sun, Sep 13, 7:00 PM. ' +
        'They are carrying: orange tent. Track live progress: https://x/l',
    );
  });

  it('tripStartedMessage omits the carrying clause without gear', () => {
    const m = tripStartedMessage({
      userName: 'Alex',
      tripName: 'T',
      expectedReturnAt: RETURN,
      timeZone: LA,
      gear: [],
      link: 'L',
    });
    expect(m.text).not.toContain('carrying');
  });

  it('checkedInMessage uses place name and note', () => {
    const m = checkedInMessage({
      userName: 'Alex',
      tripName: 'T',
      location: { latitude: 1, longitude: 2, placeName: 'Colchuck Lake', recordedAt: RETURN },
      note: ' All good ',
      timeZone: LA,
      link: 'L',
    });
    expect(m.text).toBe(
      'Alex checked in at 7:00 PM near Colchuck Lake. "All good" Track progress: L',
    );
  });

  it('checkedInMessage falls back to coordinates without a note', () => {
    const m = checkedInMessage({
      userName: 'Alex',
      tripName: 'T',
      location: { latitude: 47.52, longitude: -120.81, recordedAt: RETURN },
      timeZone: LA,
      link: 'L',
    });
    expect(m.text).toBe('Alex checked in at 7:00 PM at 47.5200, -120.8100. Track progress: L');
  });

  it('returnExtendedMessage names the new time', () => {
    expect(
      returnExtendedMessage({
        userName: 'Alex',
        tripName: 'T',
        expectedReturnAt: RETURN,
        timeZone: LA,
        link: 'L',
      }).text,
    ).toBe(
      'Alex has updated their expected return from T to Sun, Sep 13, 7:00 PM. Trip details: L',
    );
  });

  it('offRouteMessage states the distance', () => {
    expect(
      offRouteMessage({ userName: 'Alex', tripName: 'T', distanceMeters: 3400, link: 'L' }).text,
    ).toBe('Alex is about 2.1 mi (3.4 km) off their planned route for T. Latest location: L');
  });

  it('overdueMessage includes the last known location', () => {
    const m = overdueMessage({
      userName: 'Alex',
      tripName: 'T',
      overdueMinutes: 120,
      lastKnown: { latitude: 1, longitude: 2, placeName: 'Colchuck Lake', recordedAt: RETURN },
      timeZone: LA,
      link: 'L',
    });
    expect(m.subject).toBe('Alex is overdue on T');
    expect(m.text).toBe(
      'Alex is overdue on T by 2 hours. Last known location: 7:00 PM near Colchuck Lake. ' +
        'Full gear list and trip details: L. Please contact the authorities.',
    );
  });

  it('overdueMessage says when no location was shared', () => {
    const m = overdueMessage({
      userName: 'Alex',
      tripName: 'T',
      overdueMinutes: 30,
      lastKnown: null,
      timeZone: LA,
      link: 'L',
    });
    expect(m.text).toContain('by 30 minutes. No location has been shared since they set out.');
  });

  it('safeMessage differs after an overdue alert', () => {
    expect(safeMessage({ userName: 'A', tripName: 'T', afterOverdueAlert: false })).toMatchObject({
      subject: 'A is back safe',
      text: 'A is back safe from T. Thanks for keeping an eye out.',
      email: { tone: 'success', heading: 'A is back safe' },
    });
    expect(safeMessage({ userName: 'A', tripName: 'T', afterOverdueAlert: true })).toMatchObject({
      subject: 'Update: A is safe',
      text: 'Update: A has marked themselves safe after T. No further action is needed.',
      email: { tone: 'success', heading: 'A is safe' },
    });
  });

  it('cancelledMessage says updates stop', () => {
    expect(cancelledMessage({ userName: 'A', tripName: 'T' }).text).toBe(
      "A has called off the safety check-in for T. You won't receive further updates for this trip.",
    );
  });
});
